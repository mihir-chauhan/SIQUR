"""
dataset.py — Video dataset loader for crime prediction training.

Reads MP4 clips from SyntheticDataset/outputs/ and extracts frames.
Labels are derived directly from the filename convention:
    {camera}__{lighting}_{scenario}.mp4

Scenario → label:
    normal_traffic → 0  (normal)
    loitering      → 1  (suspicious)
    theft          → 2  (crime)
    disturbance    → 3  (crime/disturbance)
"""

from __future__ import annotations

import random
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset, WeightedRandomSampler
from torchvision import transforms

from model import FRAME_SIZE, LABELS, NUM_FRAMES

# ── Label extraction ───────────────────────────────────────────────────────────

SCENARIO_TO_LABEL: dict[str, int] = {
    "normal_traffic": 0,
    "loitering":      1,
    "theft":          2,
    "disturbance":    3,
}


def label_from_path(path: Path) -> Optional[int]:
    """
    cam1__daylight_normal_traffic.mp4  → 0
    cam2__night_theft.mp4              → 2
    Returns None if filename doesn't match the convention.
    """
    stem = path.stem
    if "__" not in stem:
        return None
    variation = stem.split("__", 1)[1]          # e.g. "daylight_normal_traffic"
    for scenario_tag, label in SCENARIO_TO_LABEL.items():
        if variation.endswith(scenario_tag):
            return label
    return None


def camera_from_path(path: Path) -> str:
    """cam1__daylight_theft.mp4 → 'cam1'"""
    stem = path.stem
    return stem.split("__")[0] if "__" in stem else stem


# ── Frame extraction ───────────────────────────────────────────────────────────

def load_frames(video_path: Path, n_frames: int = NUM_FRAMES) -> Optional[np.ndarray]:
    """
    Uniformly sample n_frames from a video.
    Returns uint8 array (T, H, W, C) in RGB, or None if video unreadable.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 1:
        cap.release()
        return None

    # Uniform sample indices across the video
    indices = np.linspace(0, max(0, total - 1), n_frames, dtype=int)

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok:
            # Repeat last good frame on read failure
            if frames:
                frames.append(frames[-1].copy())
            continue
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = cv2.resize(frame, FRAME_SIZE, interpolation=cv2.INTER_AREA)
        frames.append(frame)

    cap.release()

    if not frames:
        return None

    # Pad with last frame if we got fewer than needed
    while len(frames) < n_frames:
        frames.append(frames[-1].copy())

    return np.stack(frames[:n_frames])  # (T, H, W, C)


# ── Transforms ────────────────────────────────────────────────────────────────

def _make_transforms(augment: bool):
    ops = [transforms.ToTensor()]
    if augment:
        ops += [
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
            transforms.RandomGrayscale(p=0.1),
        ]
    ops.append(transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ))
    return transforms.Compose(ops)


# ── Dataset ────────────────────────────────────────────────────────────────────

class CrimeVideoDataset(Dataset):
    """
    Each item is one (clip, label) pair.

    Multiple temporal crops per video are used during training
    (n_crops > 1 augments effective dataset size).
    """

    def __init__(
        self,
        video_paths: list[Path],
        augment:     bool = False,
        n_crops:     int  = 3,          # temporal crops per video per epoch
        n_frames:    int  = NUM_FRAMES,
    ):
        self.augment   = augment
        self.n_crops   = n_crops
        self.n_frames  = n_frames
        self.tfm       = _make_transforms(augment)

        # Filter to labelled videos only
        self.items: list[tuple[Path, int]] = []
        skipped = 0
        for p in video_paths:
            lbl = label_from_path(p)
            if lbl is None:
                skipped += 1
                continue
            for _ in range(n_crops):
                self.items.append((p, lbl))

        if skipped:
            print(f"[dataset] skipped {skipped} unlabelled files")

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx: int):
        path, label = self.items[idx]

        frames_np = load_frames(path, self.n_frames)
        if frames_np is None:
            # Return zeros on unreadable video — shouldn't happen in practice
            frames_np = np.zeros((self.n_frames, *FRAME_SIZE, 3), dtype=np.uint8)

        if self.augment:
            # Random temporal jitter: randomly drop a frame and duplicate another
            if random.random() < 0.3 and self.n_frames > 2:
                drop = random.randint(0, self.n_frames - 1)
                dup  = random.randint(0, self.n_frames - 1)
                frames_np[drop] = frames_np[dup]

        # Apply per-frame spatial transforms
        clip = torch.stack([
            self.tfm(frames_np[t]) for t in range(self.n_frames)
        ])  # (T, C, H, W)

        return clip, label

    # ── Class info ────────────────────────────────────────────────────────────

    def label_counts(self) -> dict[str, int]:
        from collections import Counter
        c = Counter(lbl for _, lbl in self.items)
        return {LABELS[k]: v for k, v in sorted(c.items())}

    def weighted_sampler(self) -> WeightedRandomSampler:
        """
        Up-samples minority classes so each batch sees balanced classes.
        Critical because 'normal' examples outnumber crime examples.
        """
        from collections import Counter
        label_seq = [lbl for _, lbl in self.items]
        counts    = Counter(label_seq)
        weights   = [1.0 / counts[lbl] for lbl in label_seq]
        return WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)


# ── Helpers ────────────────────────────────────────────────────────────────────

def find_videos(outputs_dir: Path, camera: Optional[str] = None) -> list[Path]:
    """
    Find all labelled MP4s in outputs_dir.
    If camera is set, only return clips for that camera prefix.
    """
    vids = sorted(outputs_dir.glob("*.mp4"))
    vids = [v for v in vids if label_from_path(v) is not None]
    if camera:
        vids = [v for v in vids if camera_from_path(v) == camera]
    return vids


def train_val_split(
    videos: list[Path],
    val_fraction: float = 0.2,
    seed: int = 42,
) -> tuple[list[Path], list[Path]]:
    """
    Split at the video level (not frame level) to prevent data leakage.
    Stratified by label so val set covers all classes.
    """
    from collections import defaultdict
    rng = random.Random(seed)

    by_label: dict[int, list[Path]] = defaultdict(list)
    for v in videos:
        lbl = label_from_path(v)
        if lbl is not None:
            by_label[lbl].append(v)

    train, val = [], []
    for lbl, vids in by_label.items():
        rng.shuffle(vids)
        n_val = max(1, int(len(vids) * val_fraction))
        val  += vids[:n_val]
        train += vids[n_val:]

    return train, val
