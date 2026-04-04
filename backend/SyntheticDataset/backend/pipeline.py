"""
Video generation pipeline wrapper.

Supported models:
  Wan I2V  : Wan-AI/Wan2.2-I2V-A14B-Diffusers  (default)
           : Wan-AI/Wan2.1-I2V-14B-720P-Diffusers
           : Wan-AI/Wan2.1-I2V-14B-480P-Diffusers
  Wan T2V  : Wan-AI/Wan2.1-T2V-14B-Diffusers
  HunyuanV : hunyuanvideo-community/HunyuanVideo-I2V
"""

from __future__ import annotations

import asyncio
import gc
import time
from typing import Callable, Optional

import numpy as np
import torch
from PIL import Image

# TF32 gives ~3× faster matmul on Ampere/Hopper/Blackwell with negligible accuracy loss.
torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32       = True

# ---------------------------------------------------------------------------
_loaded_id: str | None = None
_pipeline = None


def _free_pipeline() -> None:
    global _pipeline, _loaded_id
    if _pipeline is not None:
        del _pipeline
        _pipeline = None
        _loaded_id = None
        gc.collect()
        torch.cuda.empty_cache()


def _is_i2v(model_id: str) -> bool:
    return "I2V" in model_id or "i2v" in model_id or "image" in model_id.lower()


def _is_hunyuan(model_id: str) -> bool:
    return "hunyuan" in model_id.lower()


# ---------------------------------------------------------------------------
# Load + optimise pipeline
# ---------------------------------------------------------------------------

def load_pipeline(model_id: str):
    global _pipeline, _loaded_id

    if _loaded_id == model_id and _pipeline is not None:
        return _pipeline

    _free_pipeline()
    print(f"[pipeline] loading {model_id} …")
    t0 = time.time()

    if _is_hunyuan(model_id):
        from diffusers import HunyuanVideoImageToVideoPipeline
        pipe = HunyuanVideoImageToVideoPipeline.from_pretrained(
            model_id, torch_dtype=torch.bfloat16,
        )
    else:
        from diffusers import WanImageToVideoPipeline, WanPipeline
        cls = WanImageToVideoPipeline if _is_i2v(model_id) else WanPipeline
        pipe = cls.from_pretrained(model_id, torch_dtype=torch.bfloat16)

    pipe.to("cuda")

    # ── VAE tiling: decodes large spatial maps in tiles, saves peak memory ──
    if hasattr(pipe, "vae"):
        pipe.vae.enable_tiling()

    # ── SDPA attention backend ───────────────────────────────────────────
    # Flash attention and memory-efficient attention are both faster than
    # the naive math path. Enabling both lets PyTorch pick the best one.
    torch.backends.cuda.enable_flash_sdp(True)
    torch.backends.cuda.enable_mem_efficient_sdp(True)

    # ── Verify the transformer is actually on CUDA ───────────────────────
    _verify_cuda(pipe)

    allocated = torch.cuda.memory_allocated() / 1e9
    reserved  = torch.cuda.memory_reserved()  / 1e9
    print(f"[pipeline] ready in {time.time() - t0:.1f}s  "
          f"(CUDA alloc {allocated:.1f} GB / reserved {reserved:.1f} GB)")

    _pipeline = pipe
    _loaded_id = model_id
    return pipe


def _verify_cuda(pipe) -> None:
    """Confirm transformer weights are on a CUDA device and log."""
    target = getattr(pipe, "transformer", None) or getattr(pipe, "unet", None)
    if target is None:
        return
    try:
        p = next(target.parameters())
        print(f"[pipeline] transformer device={p.device}  dtype={p.dtype}")
        if p.device.type != "cuda":
            print("[pipeline] WARNING: transformer is NOT on CUDA — inference will be very slow")
    except StopIteration:
        pass


# ---------------------------------------------------------------------------
# Preview decode  (best-effort — silently skips on error)
# ---------------------------------------------------------------------------

def _try_preview(pipe, latents: torch.Tensor) -> Optional[Image.Image]:
    """Decode a single preview frame from denoising latents."""
    try:
        with torch.no_grad():
            sf = getattr(pipe.vae.config, "scaling_factor", 1.0)
            z  = (latents[:1, :, :1] if latents.ndim == 5 else latents[:1])
            z  = z.to(torch.bfloat16) / sf

            decoded = pipe.vae.decode(z).sample
            frame   = decoded[0, :, 0] if decoded.ndim == 5 else decoded[0]
            frame   = ((frame + 1.0) / 2.0).clamp(0.0, 1.0)
            arr     = (frame.permute(1, 2, 0).cpu().float().numpy() * 255).astype(np.uint8)
            return Image.fromarray(arr)
    except Exception as exc:
        print(f"[pipeline] preview skip: {exc}")
        return None


# ---------------------------------------------------------------------------
# Generation entry-point  (runs in thread-pool executor)
# ---------------------------------------------------------------------------

def run_generation(
    prompt: str,
    image: Optional[Image.Image],
    num_frames: int,
    steps: int,
    guidance_scale: float,
    model_id: str,
    preview_every: int,
    progress_cb: Callable,
    loop: asyncio.AbstractEventLoop,
    width: int,
    height: int,
    seed: int,
) -> list[Image.Image]:

    pipe = load_pipeline(model_id)
    generator = torch.Generator(device="cuda").manual_seed(seed) if seed >= 0 else None

    step_times: list[float] = []
    last_t = [time.time()]

    def _cb(pipe, step: int, timestep, cb_kwargs: dict) -> dict:
        now  = time.time()
        dt   = now - last_t[0]
        last_t[0] = now
        step_times.append(dt)

        latents = cb_kwargs.get("latents")
        preview: Optional[Image.Image] = None
        if latents is not None and step % preview_every == 0:
            preview = _try_preview(pipe, latents)

        remaining = (steps - step - 1) * (sum(step_times) / len(step_times)) if step_times else 0
        print(f"[pipeline] step {step+1}/{steps}  {dt:.1f}s/step  ETA {remaining:.0f}s")

        asyncio.run_coroutine_threadsafe(
            progress_cb(step + 1, steps, preview), loop
        )
        return cb_kwargs

    gen_kwargs: dict = dict(
        prompt=prompt,
        num_frames=num_frames,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        callback_on_step_end=_cb,
        callback_on_step_end_tensor_inputs=["latents"],
        output_type="pil",
    )
    if generator is not None:
        gen_kwargs["generator"] = generator
    if image is not None:
        gen_kwargs["image"] = image.resize((width, height), Image.LANCZOS)
    gen_kwargs["width"]  = width
    gen_kwargs["height"] = height

    output = pipe(**gen_kwargs)
    avg = sum(step_times) / len(step_times) if step_times else 0
    print(f"[pipeline] done — avg {avg:.1f}s/step")
    return output.frames[0]
