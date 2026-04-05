#!/usr/bin/env python3
"""
Watchman footage test.

Downloads frames from two real CCTV clips and runs them through
Qwen2.5-VL to verify:

  TEST 1 — Normal footage  (normal_hallway.mp4)
            Expected: NO incident detected across sampled frames.
            PASS if alarm rate < 30%.

  TEST 2 — Intruder footage (intruder_breakin.mp4)
            Expected: Incident detected in at least one frame.
            PASS if alarm rate >= 1 detection.

Usage:
    python test_footage.py
    python test_footage.py --frames 5        # frames to sample per video
    python test_footage.py --verbose         # print raw model output
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
FOOTAGE_DIR = ROOT / "test_footage"
BACKEND_DIR = ROOT / "backend"

NORMAL_VIDEO   = FOOTAGE_DIR / "normal_hallway.mp4"
INTRUDER_VIDEO = FOOTAGE_DIR / "intruder_breakin.mp4"

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Watchman real-footage test")
parser.add_argument("--frames", type=int, default=6,
                    help="Number of frames to sample per video (default: 6)")
parser.add_argument("--verbose", action="store_true",
                    help="Print raw model JSON output for every frame")
args = parser.parse_args()

# ── Ensure backend is on the path ──────────────────────────────────────────────
sys.path.insert(0, str(BACKEND_DIR))

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def green(s):  return f"{GREEN}{s}{RESET}"
def red(s):    return f"{RED}{s}{RESET}"
def yellow(s): return f"{YELLOW}{s}{RESET}"
def cyan(s):   return f"{CYAN}{s}{RESET}"
def bold(s):   return f"{BOLD}{s}{RESET}"


# ── Frame extraction ──────────────────────────────────────────────────────────

def get_video_duration(path: Path) -> float:
    """Return video duration in seconds via ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())


def extract_frames(video: Path, n: int, tmpdir: str) -> list[Path]:
    """
    Extract n evenly-spaced frames from video into tmpdir.
    Returns sorted list of frame paths.
    """
    duration = get_video_duration(video)
    # Skip the first and last 10% to avoid title cards / end cards
    start = duration * 0.10
    end   = duration * 0.90
    usable = end - start
    interval = usable / max(n - 1, 1)

    frames = []
    for i in range(n):
        ts = start + i * interval
        out = Path(tmpdir) / f"frame_{i:03d}.jpg"
        subprocess.run(
            ["ffmpeg", "-ss", str(ts), "-i", str(video),
             "-frames:v", "1", "-q:v", "2", str(out), "-y"],
            capture_output=True
        )
        if out.exists():
            frames.append(out)
    return sorted(frames)


# ── Model loading ─────────────────────────────────────────────────────────────

def load():
    """Load Qwen2.5-VL once. Returns (model module, already_running_server)."""
    print(f"\n{cyan('▶ Loading Qwen2.5-VL…')}")
    t0 = time.time()
    import model as m
    m.load_model()
    elapsed = time.time() - t0
    print(f"  Model ready ({elapsed:.1f}s)")
    return m


# ── Per-frame analysis ─────────────────────────────────────────────────────────

def analyse_frame(m, frame_path: Path, verbose: bool) -> dict | None:
    """Run Qwen on one frame. Returns parsed dict or None."""
    from PIL import Image
    img = Image.open(frame_path).convert("RGB")
    raw = m.run_analysis_image(img)
    result = m.parse_response(raw)
    if verbose:
        print(f"    raw → {raw[:120]}")
    return result


# ── Test runner ───────────────────────────────────────────────────────────────

def run_test(m, label: str, video: Path, n: int, expect_incident: bool, verbose: bool) -> bool:
    """
    Run one test: extract n frames, analyse each, report pass/fail.
    Returns True if test passed.
    """
    print(f"\n{'─'*60}")
    print(f"  {bold(label)}")
    print(f"  Video  : {video.name}")
    print(f"  Frames : {n} sampled")
    print(f"  Expect : {'INCIDENT detected' if expect_incident else 'NO incident (quiet)'}")
    print(f"{'─'*60}")

    with tempfile.TemporaryDirectory() as tmpdir:
        frames = extract_frames(video, n, tmpdir)
        if not frames:
            print(red("  ERROR: could not extract frames"))
            return False

        detections = 0
        duration = get_video_duration(video)
        usable_start = duration * 0.10
        interval = (duration * 0.80) / max(n - 1, 1)

        for i, frame in enumerate(frames):
            ts = usable_start + i * interval
            mm, ss = int(ts // 60), int(ts % 60)
            print(f"\n  Frame {i+1}/{n} @ {mm}:{ss:02d}", end="  ", flush=True)

            t0 = time.time()
            result = analyse_frame(m, frame, verbose)
            elapsed = time.time() - t0

            if result is None:
                print(yellow(f"[PARSE ERROR] ({elapsed:.1f}s)"))
                continue

            if result.get("incident"):
                detections += 1
                itype = result.get("type", "unknown")
                sev   = result.get("severity", "?")
                desc  = result.get("description", "")
                print(red(f"🚨 INCIDENT — {itype} [{sev}]") + f" ({elapsed:.1f}s)")
                print(f"     └─ {desc}")
            else:
                print(green(f"✓  CLEAR") + f" ({elapsed:.1f}s)")

    print(f"\n  {'─'*40}")
    print(f"  Detections : {detections} / {n} frames")

    if expect_incident:
        passed = detections >= 1
        verdict = green("PASS ✓") if passed else red("FAIL ✗")
        reason = (
            "At least one incident detected" if passed
            else "Expected an incident but none detected"
        )
    else:
        false_positive_rate = detections / n
        passed = false_positive_rate < 0.30   # < 30% false positive rate = pass
        verdict = green("PASS ✓") if passed else red("FAIL ✗")
        reason = (
            f"False positive rate {false_positive_rate:.0%} < 30%" if passed
            else f"Too many false positives: {detections}/{n} frames flagged"
        )

    print(f"  Result     : {verdict}  ({reason})")
    return passed


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(bold(f"\n{'═'*60}"))
    print(bold(f"  WATCHMAN — Real CCTV Footage Test"))
    print(bold(f"  Frames per video : {args.frames}"))
    print(bold(f"{'═'*60}"))

    # Verify footage exists
    for path in (NORMAL_VIDEO, INTRUDER_VIDEO):
        if not path.exists():
            print(red(f"\nMissing footage: {path}"))
            print("Run from /backend/Watchman/ and ensure test_footage/ contains both clips.")
            sys.exit(1)

    # Load model
    m = load()

    results = {}

    # Test 1 — Normal footage
    results["normal"] = run_test(
        m, "TEST 1 — Normal Footage (empty hallway)",
        NORMAL_VIDEO, args.frames,
        expect_incident=False,
        verbose=args.verbose
    )

    # Test 2 — Intruder footage
    results["intruder"] = run_test(
        m, "TEST 2 — Intruder Footage (break-in)",
        INTRUDER_VIDEO, args.frames,
        expect_incident=True,
        verbose=args.verbose
    )

    # Summary
    print(f"\n{'═'*60}")
    print(bold("  SUMMARY"))
    print(f"{'─'*60}")
    for name, passed in results.items():
        label = f"  {'Normal (no alarm)' if name == 'normal' else 'Intruder (alarm)':<30}"
        print(f"{label}{green('PASS ✓') if passed else red('FAIL ✗')}")

    total = len(results)
    passed = sum(results.values())
    print(f"{'─'*60}")
    print(f"  {passed}/{total} tests passed")
    print(f"{'═'*60}\n")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
