#!/usr/bin/env python3
"""
generate_dataset.py — Batch CCTV variation generator

For every image in ./camera_images/, generates 16 five-second synthetic
CCTV clips via the running Wan worker on ws://127.0.0.1:8001/generate.

The 16 clips are a 4×4 grid of:
  LIGHTING  × SCENARIO
  (4 conds)   (4 types)

All prompts are grounded in a college campus context.

Usage:
    python generate_dataset.py [--images camera_images] [--steps 20] [--dry-run]

Outputs go to ./outputs/ with names like:
    {image_stem}__{lighting_tag}_{scenario_tag}.mp4
"""

import argparse
import asyncio
import base64
import io
import json
import sys
import time
from pathlib import Path

import websockets
import websockets.exceptions
from PIL import Image

# ── Config ────────────────────────────────────────────────────────────────────

WORKER_WS   = "ws://127.0.0.1:8001/generate"
OUTPUTS_DIR = Path(__file__).parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# 5 seconds at 16 fps — nearest valid Wan frame count (must be 4k+1)
NUM_FRAMES      = 81
FPS             = 16
WIDTH, HEIGHT   = 832, 480
GUIDANCE_SCALE  = 5.0
SEED            = 42          # fixed seed keeps lighting/appearance stable across cameras

# ── 16 prompt variations: 4 lighting × 4 scenarios ───────────────────────────

LIGHTING = [
    {
        "tag":  "daylight",
        "desc": "bright midday sunlight, sharp high-contrast shadows, clear blue sky visible, full daylight exposure",
    },
    {
        "tag":  "overcast",
        "desc": "overcast cloudy day, flat diffuse grey lighting, no shadows, muted colours",
    },
    {
        "tag":  "dusk",
        "desc": "dusk twilight, warm orange and amber tones, long diagonal shadows, sun low on horizon",
    },
    {
        "tag":  "night",
        "desc": "nighttime, dark exterior, only artificial campus streetlights and building lights, low ambient light, high noise grain",
    },
]

SCENARIOS = [
    {
        "tag":  "normal_traffic",
        "desc": (
            "college students walking through carrying backpacks and laptops, "
            "normal foot traffic between classes, some students on phones, "
            "no suspicious activity"
        ),
    },
    {
        "tag":  "loitering",
        "desc": (
            "a college student loitering suspiciously near the entrance, "
            "lingering without clear purpose, glancing around nervously, "
            "repeatedly checking surroundings as if watching for security, "
            "other students passing by normally"
        ),
    },
    {
        "tag":  "theft",
        "desc": (
            "a college student committing theft, reaching into an unattended bag "
            "or taking an item left on a bench, looking around to avoid detection, "
            "concealing the item quickly, then attempting to leave casually, "
            "other students unaware in the background"
        ),
    },
    {
        "tag":  "disturbance",
        "desc": (
            "two college students in a heated confrontation, aggressive posturing, "
            "raised voices implied by body language, other students stopping to watch "
            "or pulling out phones, one student attempting to intervene"
        ),
    },
]

assert len(LIGHTING) * len(SCENARIOS) == 16

# ── Prompt builder ────────────────────────────────────────────────────────────

CCTV_BASE = (
    "Security camera footage, CCTV surveillance, fixed wall-mounted camera, "
    "wide angle lens, monochrome timestamp and date overlay in corner, "
    "film grain, low dynamic range, college campus."
)

def build_prompt(lighting: dict, scenario: dict) -> str:
    return (
        f"{CCTV_BASE} "
        f"{lighting['desc'].capitalize()}. "
        f"{scenario['desc'].capitalize()}. "
        "Realistic surveillance footage."
    )

# ── Worker communication ──────────────────────────────────────────────────────

def encode_image(path: Path) -> str:
    img = Image.open(path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


async def generate_one(
    prompt: str,
    image_b64: str,
    steps: int,
    label: str,
) -> Path | None:
    """
    Send one job to the worker. Returns the saved output path, or None on failure.
    Renames the worker's output_{ts}.mp4 to a descriptive name immediately.
    """
    payload = {
        "prompt":         prompt,
        "image":          image_b64,
        "model_id":       "Wan-AI/Wan2.2-I2V-A14B-Diffusers",
        "num_frames":     NUM_FRAMES,
        "steps":          steps,
        "guidance_scale": GUIDANCE_SCALE,
        "fps":            FPS,
        "width":          WIDTH,
        "height":         HEIGHT,
        "seed":           SEED,
        "preview_every":  5,
    }

    try:
        async with websockets.connect(
            WORKER_WS, max_size=None, open_timeout=10, close_timeout=10,
        ) as ws:
            await ws.send(json.dumps(payload))

            async for raw in ws:
                if isinstance(raw, bytes):
                    continue
                msg = json.loads(raw)

                if msg["type"] == "progress":
                    step, total = msg["step"], msg["total"]
                    bar = "█" * (step * 20 // total) + "░" * (20 - step * 20 // total)
                    print(f"  [{bar}] {step}/{total}", end="\r", flush=True)

                elif msg["type"] == "done":
                    print(f"  {'█'*20} done{' '*20}")
                    # Worker saved to outputs/output_{ts}.mp4
                    worker_filename = Path(msg["url"]).name        # output_xxx.mp4
                    src = OUTPUTS_DIR / worker_filename
                    dst = OUTPUTS_DIR / f"{label}.mp4"

                    # Rename to descriptive name (retry briefly if file not flushed yet)
                    for _ in range(10):
                        if src.exists():
                            src.rename(dst)
                            return dst
                        time.sleep(0.3)

                    print(f"  WARNING: could not find {src}, keeping original name")
                    return OUTPUTS_DIR / worker_filename

                elif msg["type"] == "error":
                    print(f"  ERROR from worker: {msg['message']}")
                    return None

                elif msg["type"] in ("ping", "status"):
                    pass

    except websockets.exceptions.WebSocketException as exc:
        print(f"  WebSocket error: {exc}")
        return None

    return None


# ── Main loop ─────────────────────────────────────────────────────────────────

async def run(images_dir: Path, steps: int, dry_run: bool):
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    images = sorted(p for p in images_dir.iterdir() if p.suffix.lower() in exts)

    if not images:
        print(f"No images found in {images_dir}")
        sys.exit(1)

    total_jobs = len(images) * 16
    print(f"\nFound {len(images)} image(s) → {total_jobs} clips total")
    print(f"Steps: {steps}  |  {NUM_FRAMES} frames @ {FPS}fps (~5s)  |  {WIDTH}×{HEIGHT}")
    if dry_run:
        print("\nDRY RUN — printing prompts only, not connecting to worker\n")

    job_num = 0
    for img_path in images:
        print(f"\n{'═'*60}")
        print(f"Image: {img_path.name}")
        print(f"{'═'*60}")

        image_b64 = encode_image(img_path) if not dry_run else "dry"

        for li, light in enumerate(LIGHTING):
            for si, scene in enumerate(SCENARIOS):
                job_num += 1
                label = f"{img_path.stem}__{light['tag']}_{scene['tag']}"
                prompt = build_prompt(light, scene)
                dst    = OUTPUTS_DIR / f"{label}.mp4"

                print(f"\n[{job_num}/{total_jobs}] {light['tag']} × {scene['tag']}")
                print(f"  → {dst.name}")

                if dry_run:
                    print(f"  PROMPT: {prompt[:120]}...")
                    continue

                if dst.exists():
                    print(f"  SKIP — already exists")
                    continue

                t0 = time.time()
                result = await generate_one(prompt, image_b64, steps, label)
                elapsed = time.time() - t0

                if result:
                    print(f"  Saved: {result.name}  ({elapsed:.0f}s)")
                else:
                    print(f"  FAILED after {elapsed:.0f}s")

    print(f"\n{'═'*60}")
    print(f"Done. Outputs in: {OUTPUTS_DIR.resolve()}")


def main():
    ap = argparse.ArgumentParser(description="Batch CCTV variation generator")
    ap.add_argument("--images", default="camera_images",
                    help="Folder containing camera POV images (default: ./camera_images)")
    ap.add_argument("--steps", type=int, default=20,
                    help="Diffusion steps per clip (default: 20)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print prompts without generating")
    args = ap.parse_args()

    images_dir = Path(args.images)
    if not images_dir.is_absolute():
        images_dir = Path(__file__).parent / images_dir

    if not images_dir.exists():
        print(f"ERROR: images folder not found: {images_dir}")
        sys.exit(1)

    asyncio.run(run(images_dir, args.steps, args.dry_run))


if __name__ == "__main__":
    main()
