#!/usr/bin/env python3
"""
export_onnx.py — Export trained CrimePredictor to ONNX for edge deployment.

Produces two files:
  {name}.onnx         full fp32 model   (~10 MB)
  {name}_int8.onnx    INT8 quantized     (~2-3 MB)  ← deploy this on edge

Usage:
    python export_onnx.py --checkpoint checkpoints/global_best.pt
    python export_onnx.py --checkpoint checkpoints/cam1_best.pt --name cam1
"""

import argparse
import sys
from pathlib import Path

import torch
import onnx
import onnxruntime as ort
import numpy as np
from onnxruntime.quantization import quantize_dynamic, QuantType

_HERE    = Path(__file__).parent
OUT_DIR  = _HERE / "exported"
OUT_DIR.mkdir(exist_ok=True)

from model import CrimePredictor, NUM_FRAMES, FRAME_SIZE, LABELS, crime_score


def export(checkpoint: Path, name: str):
    print(f"\nLoading checkpoint: {checkpoint}")
    ckpt  = torch.load(checkpoint, map_location="cpu")
    model = CrimePredictor()
    model.load_state_dict(ckpt["model"])
    model.eval()

    # Dummy input: batch=1, T frames, RGB, 112×112
    dummy = torch.randn(1, NUM_FRAMES, 3, *FRAME_SIZE)

    fp32_path = OUT_DIR / f"{name}.onnx"
    int8_path = OUT_DIR / f"{name}_int8.onnx"

    # ── Export fp32 ONNX ────────────────────────────────────────────────────
    print(f"Exporting fp32 → {fp32_path}")
    torch.onnx.export(
        model,
        dummy,
        str(fp32_path),
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["clip"],
        output_names=["logits"],
        dynamic_axes={
            "clip":   {0: "batch"},
            "logits": {0: "batch"},
        },
    )

    # Verify
    onnx.checker.check_model(str(fp32_path))
    fp32_mb = fp32_path.stat().st_size / 1e6
    print(f"  fp32: {fp32_mb:.1f} MB  ✓")

    # ── INT8 dynamic quantization (CPU-friendly, no calibration data needed) ─
    print(f"Quantizing INT8 → {int8_path}")
    quantize_dynamic(
        str(fp32_path),
        str(int8_path),
        weight_type=QuantType.QInt8,
    )
    int8_mb = int8_path.stat().st_size / 1e6
    print(f"  int8: {int8_mb:.1f} MB  ✓")

    # ── Sanity check: run a forward pass through each ────────────────────────
    dummy_np = dummy.numpy()
    for path, tag in [(fp32_path, "fp32"), (int8_path, "int8")]:
        sess    = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        logits  = sess.run(["logits"], {"clip": dummy_np})[0]
        probs   = np.exp(logits) / np.exp(logits).sum(-1, keepdims=True)
        pred    = LABELS[int(probs.argmax(-1)[0])]
        weights = np.array([0.0, 0.45, 1.0, 0.9])
        score   = float((probs[0] * weights).sum())
        print(f"  [{tag}] pred={pred}  danger={score:.3f}")

    print(f"\nDeploy the INT8 model for edge:")
    print(f"  {int8_path.resolve()}")
    print(f"\nRun inference:")
    print(f"  python predict.py --model {int8_path} --video <file_or_rtsp>")

    return int8_path


def main():
    ap = argparse.ArgumentParser(description="Export CrimePredictor to ONNX")
    ap.add_argument("--checkpoint", required=True, help="Path to .pt checkpoint")
    ap.add_argument("--name", default=None,
                    help="Output basename (default: derived from checkpoint name)")
    args = ap.parse_args()

    ckpt = Path(args.checkpoint)
    if not ckpt.exists():
        print(f"ERROR: checkpoint not found: {ckpt}")
        sys.exit(1)

    name = args.name or ckpt.stem.replace("_best", "")
    export(ckpt, name)


if __name__ == "__main__":
    main()
