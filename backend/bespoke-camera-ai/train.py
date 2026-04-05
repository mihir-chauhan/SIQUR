#!/usr/bin/env python3
"""
train.py — Train the CrimePredictor model on synthetic CCTV dataset.

Usage:
    # Train on all cameras (global model)
    python train.py

    # Train per-camera (creates a separate checkpoint per camera)
    python train.py --camera cam1
    python train.py --camera cam2

    # Point to a custom videos folder
    python train.py --videos /path/to/outputs --epochs 30

Checkpoints saved to: ./checkpoints/{camera_or_global}_best.pt
"""

import argparse
import sys
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# ── Paths ──────────────────────────────────────────────────────────────────────
_HERE        = Path(__file__).parent
_SD_OUTPUTS  = _HERE.parent / "SyntheticDataset" / "outputs"
CKPT_DIR     = _HERE / "checkpoints"
CKPT_DIR.mkdir(exist_ok=True)

from model   import CrimePredictor, crime_score, LABELS, param_count
from dataset import CrimeVideoDataset, find_videos, train_val_split


# ── Training loop ──────────────────────────────────────────────────────────────

def train_one_epoch(model, loader, optimizer, criterion, device, scaler):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for clips, labels in loader:
        clips  = clips.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
            logits = model(clips)
            loss   = criterion(logits, labels)

        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optimizer)
        scaler.update()

        total_loss += loss.item() * len(labels)
        correct    += (logits.argmax(1) == labels).sum().item()
        total      += len(labels)

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    per_class = {l: {"tp": 0, "n": 0} for l in LABELS}

    for clips, labels in loader:
        clips  = clips.to(device)
        labels = labels.to(device)
        logits = model(clips)
        loss   = criterion(logits, labels)

        preds = logits.argmax(1)
        total_loss += loss.item() * len(labels)
        correct    += (preds == labels).sum().item()
        total      += len(labels)

        for gt, pred in zip(labels.tolist(), preds.tolist()):
            per_class[LABELS[gt]]["n"]  += 1
            per_class[LABELS[gt]]["tp"] += int(gt == pred)

    per_class_acc = {
        l: (v["tp"] / v["n"] if v["n"] > 0 else 0.0)
        for l, v in per_class.items()
    }
    return total_loss / total, correct / total, per_class_acc


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Train CrimePredictor")
    ap.add_argument("--videos",    default=str(_SD_OUTPUTS),
                    help="Folder containing labelled MP4s (default: SyntheticDataset/outputs/)")
    ap.add_argument("--camera",    default=None,
                    help="Train on a single camera only, e.g. cam1 (default: all cameras)")
    ap.add_argument("--epochs",    type=int,   default=30)
    ap.add_argument("--batch",     type=int,   default=4)
    ap.add_argument("--lr",        type=float, default=3e-4)
    ap.add_argument("--workers",   type=int,   default=2)
    ap.add_argument("--n-crops",   type=int,   default=4,
                    help="Temporal crops per video per epoch (augments effective dataset size)")
    ap.add_argument("--freeze-backbone", action="store_true",
                    help="Freeze MobileNet backbone, only train LSTM+head (faster, less VRAM)")
    ap.add_argument("--finetune",  default=None,
                    help="Path to checkpoint to fine-tune from (transfer to another camera)")
    args = ap.parse_args()

    videos_dir = Path(args.videos)
    if not videos_dir.exists():
        print(f"ERROR: videos folder not found: {videos_dir}")
        sys.exit(1)

    # ── Data ────────────────────────────────────────────────────────────────
    all_vids = find_videos(videos_dir, camera=args.camera)
    if not all_vids:
        print(f"ERROR: no labelled videos found in {videos_dir}"
              + (f" for camera '{args.camera}'" if args.camera else ""))
        sys.exit(1)

    train_vids, val_vids = train_val_split(all_vids, val_fraction=0.2)
    print(f"\nCamera: {args.camera or 'ALL'}")
    print(f"Videos — train: {len(train_vids)}  val: {len(val_vids)}")

    train_ds = CrimeVideoDataset(train_vids, augment=True,  n_crops=args.n_crops)
    val_ds   = CrimeVideoDataset(val_vids,   augment=False, n_crops=1)

    print(f"Samples — train: {len(train_ds)}  val: {len(val_ds)}")
    print(f"Train class dist: {train_ds.label_counts()}")

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch,
        sampler=train_ds.weighted_sampler(),
        num_workers=args.workers,
        pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=True,
    )

    # ── Model ────────────────────────────────────────────────────────────────
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = CrimePredictor().to(device)
    print(f"Params: {param_count(model)}")

    if args.finetune:
        ckpt = torch.load(args.finetune, map_location=device)
        model.load_state_dict(ckpt["model"], strict=False)
        print(f"Loaded weights from {args.finetune}")

    if args.freeze_backbone:
        for p in model.features.parameters():
            p.requires_grad = False
        print("Backbone frozen — only training LSTM + head")

    # ── Optimiser ────────────────────────────────────────────────────────────
    trainable  = [p for p in model.parameters() if p.requires_grad]
    optimizer  = torch.optim.AdamW(trainable, lr=args.lr, weight_decay=1e-4)
    scheduler  = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs, eta_min=1e-6,
    )
    criterion  = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler     = torch.GradScaler(device.type, enabled=device.type == "cuda")

    # ── Training loop ────────────────────────────────────────────────────────
    ckpt_name  = f"{args.camera or 'global'}_best.pt"
    ckpt_path  = CKPT_DIR / ckpt_name
    best_val   = 0.0

    print(f"\nTraining for {args.epochs} epochs  →  {ckpt_path}\n")
    print(f"{'Ep':>3}  {'TrainLoss':>9}  {'TrainAcc':>8}  {'ValLoss':>7}  {'ValAcc':>6}  {'LR':>8}")
    print("─" * 60)

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        tr_loss, tr_acc = train_one_epoch(
            model, train_loader, optimizer, criterion, device, scaler,
        )
        vl_loss, vl_acc, per_cls = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        lr = optimizer.param_groups[0]["lr"]
        print(
            f"{epoch:>3}  {tr_loss:>9.4f}  {tr_acc:>7.1%}  "
            f"{vl_loss:>7.4f}  {vl_acc:>5.1%}  {lr:>8.2e}  "
            f"({time.time()-t0:.0f}s)"
        )

        if epoch % 5 == 0 or epoch == args.epochs:
            cls_str = "  ".join(f"{l}:{a:.0%}" for l, a in per_cls.items())
            print(f"     Per-class val: {cls_str}")

        if vl_acc > best_val:
            best_val = vl_acc
            torch.save(
                {
                    "epoch":   epoch,
                    "model":   model.state_dict(),
                    "val_acc": vl_acc,
                    "camera":  args.camera or "global",
                    "labels":  LABELS,
                },
                ckpt_path,
            )
            print(f"     ✓ saved best ({vl_acc:.1%})")

    print(f"\nBest val acc: {best_val:.1%}")
    print(f"Checkpoint:  {ckpt_path.resolve()}")
    print("\nNext steps:")
    print(f"  Export to ONNX:  python export_onnx.py --checkpoint {ckpt_path}")
    print(f"  Run inference:   python predict.py --model exported/{args.camera or 'global'}.onnx --video <file>")


if __name__ == "__main__":
    main()
