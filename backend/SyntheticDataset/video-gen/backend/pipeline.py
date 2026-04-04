"""
Video generation pipeline wrapper.

Supported models:
  Wan I2V  : Wan-AI/Wan2.2-I2V-A14B-Diffusers  (default)
           : Wan-AI/Wan2.1-I2V-14B-720P-Diffusers
           : Wan-AI/Wan2.1-I2V-14B-480P-Diffusers
  Wan T2V  : Wan-AI/Wan2.2-T2V-A14B-Diffusers
  Wan 2.7  : Wan-AI/Wan2.7-I2V-A27B-Diffusers  (27B MoE, needs ~55 GB BF16)
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

# ---------------------------------------------------------------------------
# Global model cache  (one model at a time to save VRAM)
# ---------------------------------------------------------------------------
_loaded_id: str | None = None
_pipeline = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
# Load pipeline
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
            model_id,
            torch_dtype=torch.bfloat16,
        )
        pipe.vae.enable_tiling()
    else:
        from diffusers import WanImageToVideoPipeline, WanPipeline

        cls = WanImageToVideoPipeline if _is_i2v(model_id) else WanPipeline
        pipe = cls.from_pretrained(model_id, torch_dtype=torch.bfloat16)

    pipe.to("cuda")
    _pipeline = pipe
    _loaded_id = model_id
    print(f"[pipeline] ready in {time.time() - t0:.1f}s")
    return pipe


# ---------------------------------------------------------------------------
# Preview decode  (best-effort — silently skips on error)
# ---------------------------------------------------------------------------

def _try_preview(pipe, latents: torch.Tensor) -> Optional[Image.Image]:
    """
    Decode a single preview frame from the current denoising latents.

    For Wan's 3D VAE the latent shape is [B, C, T_lat, H_lat, W_lat].
    We take only the first temporal slice to save memory.
    """
    try:
        with torch.no_grad():
            sf = getattr(pipe.vae.config, "scaling_factor", 1.0)

            if latents.ndim == 5:
                # Take first temporal slice: [1, C, 1, H_lat, W_lat]
                z = latents[:1, :, :1].float() / sf
            else:
                z = latents[:1].float() / sf

            decoded = pipe.vae.decode(z).sample  # [1, C, (T), H, W]

            if decoded.ndim == 5:
                frame = decoded[0, :, 0]   # first temporal frame, [C, H, W]
            else:
                frame = decoded[0]          # [C, H, W]

            frame = ((frame + 1.0) / 2.0).clamp(0.0, 1.0)
            arr = (frame.permute(1, 2, 0).cpu().float().numpy() * 255).astype(np.uint8)
            return Image.fromarray(arr)

    except Exception as exc:
        print(f"[pipeline] preview skip: {exc}")
        return None


# ---------------------------------------------------------------------------
# Main generation entry-point  (runs in thread-pool)
# ---------------------------------------------------------------------------

def run_generation(
    prompt: str,
    image: Optional[Image.Image],
    num_frames: int,
    steps: int,
    guidance_scale: float,
    model_id: str,
    preview_every: int,
    # progress_cb is an async coroutine function —
    # call via asyncio.run_coroutine_threadsafe
    progress_cb: Callable,
    loop: asyncio.AbstractEventLoop,
    width: int,
    height: int,
    seed: int,
) -> list[Image.Image]:

    pipe = load_pipeline(model_id)

    generator = torch.Generator(device="cuda").manual_seed(seed) if seed >= 0 else None

    # ------------------------------------------------------------------ #
    # Step callback: fires on every denoising step                         #
    # ------------------------------------------------------------------ #
    def _cb(pipe, step: int, timestep, cb_kwargs: dict) -> dict:
        latents = cb_kwargs.get("latents")
        preview: Optional[Image.Image] = None

        if latents is not None and step % preview_every == 0:
            preview = _try_preview(pipe, latents)

        # Schedule async send from this thread (non-blocking)
        asyncio.run_coroutine_threadsafe(
            progress_cb(step + 1, steps, preview),
            loop,
        )
        return cb_kwargs

    # ------------------------------------------------------------------ #
    # Build call kwargs                                                    #
    # ------------------------------------------------------------------ #
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
        # Resize reference image to the target resolution
        img = image.resize((width, height), Image.LANCZOS)

        if _is_hunyuan(model_id):
            gen_kwargs["image"] = img
        else:
            # Wan I2V: pass as `image`
            gen_kwargs["image"] = img
            gen_kwargs["width"] = width
            gen_kwargs["height"] = height
    else:
        gen_kwargs["width"] = width
        gen_kwargs["height"] = height

    output = pipe(**gen_kwargs)
    return output.frames[0]   # list[PIL.Image]
