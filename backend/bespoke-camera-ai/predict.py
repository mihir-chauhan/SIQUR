#!/usr/bin/env python3
"""
predict.py — Edge inference for CrimePredictor ONNX model.

Accepts a video file, RTSP stream, or webcam index.
Runs a sliding window of 8 frames through the INT8 ONNX model,
outputs danger score + class label per window.

Usage:
    python predict.py --model exported/global_int8.onnx --video clip.mp4
    python predict.py --model exported/global_int8.onnx --video rtsp://192.168.1.10/stream1
    python predict.py --model exported/global_int8.onnx --video 0          # webcam
    python predict.py --model exported/global_int8.onnx --video clip.mp4 --overlay  # draw HUD
    python predict.py --model exported/global_int8.onnx --video clip.mp4 --json     # JSON output

Does NOT require PyTorch — only onnxruntime + opencv-python + numpy.
"""

import argparse
import json
import sys
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

# ── Constants (must match model.py) ──────────────────────────────────────────
NUM_FRAMES   = 8
FRAME_SIZE   = (112, 112)
LABELS       = ["normal", "loitering", "theft", "disturbance"]
DANGER_W     = np.array([0.0, 0.45, 1.0, 0.9], dtype=np.float32)

# ImageNet normalisation
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Danger threshold for alert overlay
ALERT_THRESHOLD = 0.5

# HUD colours (BGR)
_COL_SAFE    = (80, 200, 80)
_COL_WARN    = (40, 200, 220)
_COL_ALERT   = (50, 50, 230)


# ── Preprocessing ─────────────────────────────────────────────────────────────

def preprocess_frame(frame_bgr: np.ndarray) -> np.ndarray:
    """BGR uint8 → float32 CHW normalised."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, FRAME_SIZE, interpolation=cv2.INTER_AREA)
    f = resized.astype(np.float32) / 255.0
    f = (f - _MEAN) / _STD
    return f.transpose(2, 0, 1)   # HWC → CHW


def build_clip(frames: list) -> np.ndarray:
    """List of CHW float32 → (1, T, C, H, W) batch for ONNX."""
    clip = np.stack(frames, axis=0)          # (T, C, H, W)
    return clip[np.newaxis].astype(np.float32)  # (1, T, C, H, W)


# ── Inference ─────────────────────────────────────────────────────────────────

def run_inference(session: ort.InferenceSession, clip: np.ndarray) -> dict:
    logits = session.run(["logits"], {"clip": clip})[0][0]   # (4,)
    exp    = np.exp(logits - logits.max())
    probs  = exp / exp.sum()
    score  = float((probs * DANGER_W).sum())
    cls    = int(probs.argmax())
    return {
        "class_idx":    cls,
        "label":        LABELS[cls],
        "danger_score": score,
        "probabilities": {l: float(probs[i]) for i, l in enumerate(LABELS)},
    }


# ── Overlay ───────────────────────────────────────────────────────────────────

def _score_colour(score: float):
    if score < 0.3:
        return _COL_SAFE
    if score < ALERT_THRESHOLD:
        return _COL_WARN
    return _COL_ALERT


def draw_hud(frame: np.ndarray, result: dict, fps: float) -> np.ndarray:
    h, w = frame.shape[:2]
    score = result["danger_score"]
    label = result["label"].upper()
    col   = _score_colour(score)

    # Semi-transparent dark strip at top
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 56), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    # Danger score bar (0–w*0.4)
    bar_w = int(w * 0.4 * score)
    cv2.rectangle(frame, (10, 36), (10 + int(w * 0.4), 50), (60, 60, 60), -1)
    cv2.rectangle(frame, (10, 36), (10 + bar_w, 50), col, -1)

    # Text
    cv2.putText(frame, f"DANGER: {score:.2f}  [{label}]",
                (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, col, 2, cv2.LINE_AA)
    cv2.putText(frame, f"{fps:.0f} fps",
                (w - 80, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)

    # Red border on alert
    if score >= ALERT_THRESHOLD:
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), _COL_ALERT, 4)

    return frame


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="CrimePredictor edge inference")
    ap.add_argument("--model",   required=True, help="Path to ONNX model (int8 recommended)")
    ap.add_argument("--video",   required=True, help="Video file, RTSP URL, or webcam index (0)")
    ap.add_argument("--stride",  type=int, default=4,
                    help="Frame stride for sliding window (default: 4 = 50%% overlap)")
    ap.add_argument("--overlay", action="store_true",
                    help="Show annotated video window")
    ap.add_argument("--save",    default=None,
                    help="Save annotated video to file (requires --overlay path)")
    ap.add_argument("--json",    action="store_true",
                    help="Print JSON result per window instead of human text")
    ap.add_argument("--no-display", action="store_true",
                    help="Suppress cv2 window even with --overlay (useful for headless servers)")
    args = ap.parse_args()

    # ── Load model ──────────────────────────────────────────────────────────
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"ERROR: model not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading model: {model_path}", file=sys.stderr)
    session = ort.InferenceSession(
        str(model_path),
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    print("Model loaded.", file=sys.stderr)

    # ── Open video ──────────────────────────────────────────────────────────
    src = int(args.video) if args.video.isdigit() else args.video
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open video source: {args.video}", file=sys.stderr)
        sys.exit(1)

    src_fps    = cap.get(cv2.CAP_PROP_FPS) or 25.0
    src_w      = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Source: {src_w}×{src_h}  {src_fps:.1f}fps", file=sys.stderr)

    # ── Optional output writer ───────────────────────────────────────────────
    writer = None
    if args.save:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.save, fourcc, src_fps, (src_w, src_h))

    # ── Sliding window buffer ────────────────────────────────────────────────
    buffer: deque = deque(maxlen=NUM_FRAMES)
    frame_idx     = 0
    last_result   = None
    last_infer_t  = time.time()
    infer_fps     = 0.0

    try:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break

            frame_idx += 1
            buffer.append(preprocess_frame(bgr))

            # Run inference every `stride` frames once buffer is full
            if len(buffer) == NUM_FRAMES and frame_idx % args.stride == 0:
                clip        = build_clip(list(buffer))
                last_result = run_inference(session, clip)
                now         = time.time()
                infer_fps   = 1.0 / max(now - last_infer_t, 1e-6)
                last_infer_t = now

                if args.json:
                    rec = {"frame": frame_idx, **last_result}
                    print(json.dumps(rec), flush=True)
                else:
                    score = last_result["danger_score"]
                    label = last_result["label"]
                    print(
                        f"frame {frame_idx:6d}  danger={score:.3f}  "
                        f"class={label:<12}  "
                        + "  ".join(
                            f"{l}={last_result['probabilities'][l]:.2f}"
                            for l in LABELS
                        ),
                        flush=True,
                    )

            # Overlay / display
            if args.overlay or args.save:
                disp = bgr.copy()
                if last_result is not None:
                    disp = draw_hud(disp, last_result, infer_fps)

                if args.save and writer:
                    writer.write(disp)

                if args.overlay and not args.no_display:
                    cv2.imshow("CrimePredictor", disp)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

    finally:
        cap.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()
        print(f"\nProcessed {frame_idx} frames.", file=sys.stderr)


if __name__ == "__main__":
    main()
