"""
Qwen2.5-VL model loader and inference.

Supports both:
  - run_analysis(scene_description)  — text-only, for mock camera feeds
  - run_analysis_image(pil_image)     — vision, for real CCTV frame analysis

Load once at startup via load_model(); all run_* functions are
synchronous and must be called from a ThreadPoolExecutor thread.
"""

from __future__ import annotations

import json
import os
import re

_model = None
_processor = None
_loaded = False

MODEL_ID = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen2.5-VL-7B-Instruct")

IMAGE_SYSTEM_PROMPT = """\
You are an AI security monitoring system analyzing a real surveillance camera frame.
Look carefully at the image and determine whether any of the following security incidents are occurring.""" + """

Respond ONLY with valid JSON in this exact format — nothing else:
{
  "incident": true or false,
  "type": one of ["crime_assault", "fire_smoke", "unauthorized_access", "medical_emergency"] or null,
  "severity": one of ["low", "medium", "high"] or null,
  "description": "one sentence, maximum 100 characters" or null
}

Rules:
- Set "incident" to false for routine, normal, or ambiguous scenes.
- Only set "incident" to true for clearly visible dangerous or emergency situations.
- "type" and "severity" must be null when "incident" is false.
- "description" must be null when "incident" is false.
- When "incident" is true, "description" must describe what you see in the image.
- Return NOTHING outside the JSON object — no preamble, no explanation.\
"""

SYSTEM_PROMPT = """\
You are an AI security monitoring system analyzing surveillance camera feeds.
You will be given a plain-text description of what a security camera is currently observing.

Respond ONLY with valid JSON in this exact format — nothing else:
{
  "incident": true or false,
  "type": one of ["crime_assault", "fire_smoke", "unauthorized_access", "medical_emergency"] or null,
  "severity": one of ["low", "medium", "high"] or null,
  "description": "one sentence, maximum 100 characters" or null
}

Rules:
- Set "incident" to false for routine, normal, or ambiguous scenes.
- Only set "incident" to true for clearly dangerous or emergency situations.
- "type" and "severity" must be null when "incident" is false.
- "description" must be null when "incident" is false.
- When "incident" is true, "description" must summarize the threat concisely.
- Return NOTHING outside the JSON object — no preamble, no explanation.\
"""


def load_model() -> None:
    """Blocking — run in executor thread during lifespan startup."""
    global _model, _processor, _loaded
    import torch
    from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

    print(f"[model] loading {MODEL_ID} …")
    _processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
    _model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.bfloat16,
        device_map="auto",   # splits across GPU + CPU RAM if GPU is too small
        trust_remote_code=True,
    )
    _model.eval()
    _loaded = True
    print(f"[model] {MODEL_ID} ready")


def run_analysis(scene_description: str) -> str:
    """
    Synchronous inference — call from ThreadPoolExecutor thread only.
    Returns raw model output string.
    """
    import torch

    if not _loaded:
        raise RuntimeError("Model not loaded — call load_model() first")

    messages = [
        {
            "role": "user",
            "content": SYSTEM_PROMPT + "\n\nCamera scene:\n" + scene_description,
        }
    ]

    text = _processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    # Send inputs to the same device as the model's first parameter
    device = next(_model.parameters()).device
    inputs = _processor(text=[text], return_tensors="pt").to(device)

    with torch.no_grad():
        output_ids = _model.generate(
            **inputs,
            max_new_tokens=180,
            do_sample=False,
            temperature=None,
            top_p=None,
        )

    # Decode only the newly generated tokens
    new_tokens = output_ids[0][inputs.input_ids.shape[1]:]
    return _processor.decode(new_tokens, skip_special_tokens=True).strip()


def run_analysis_image(image: "PIL.Image.Image") -> str:
    """
    Run visual analysis on a real PIL image frame from a camera.
    Uses Qwen2.5-VL's vision capabilities to detect incidents.
    Synchronous — call from ThreadPoolExecutor thread only.
    """
    import torch
    from qwen_vl_utils import process_vision_info

    if not _loaded:
        raise RuntimeError("Model not loaded — call load_model() first")

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": IMAGE_SYSTEM_PROMPT},
            ],
        }
    ]

    text = _processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)
    device = next(_model.parameters()).device
    inputs = _processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        output_ids = _model.generate(
            **inputs,
            max_new_tokens=180,
            do_sample=False,
            temperature=None,
            top_p=None,
        )

    new_tokens = output_ids[0][inputs.input_ids.shape[1]:]
    return _processor.decode(new_tokens, skip_special_tokens=True).strip()


def parse_response(raw: str) -> dict | None:
    """
    Parse Qwen's JSON response. Returns dict or None on failure.
    None is treated as incident=false by the caller.
    """
    # Strip markdown code fences Qwen sometimes wraps around JSON
    cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()

    # Try direct parse first
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: extract first {...} block
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group())
        except json.JSONDecodeError:
            return None

    # Validate required shape
    if not isinstance(data.get("incident"), bool):
        return None

    if data["incident"]:
        valid_types = {"crime_assault", "fire_smoke", "unauthorized_access", "medical_emergency"}
        if data.get("type") not in valid_types:
            return None
        valid_severities = {"low", "medium", "high"}
        if data.get("severity") not in valid_severities:
            data["severity"] = "medium"  # safe default

    return data


QUERY_SYSTEM_PROMPT = """\
You are Watchman, an AI security monitoring system. You have access to a log of all security incidents detected by surveillance cameras.

Answer the user's question based ONLY on the information in the provided incident log. Be concise and specific — cite exact times, camera names, and incident types when relevant.

If the answer is not in the log, say "No incidents matching that description have been recorded."
Do not speculate or invent details beyond what the log contains.\
"""


def run_query(question: str, context: str) -> str:
    """
    Answer a natural language question about the incident log.
    Synchronous — call from ThreadPoolExecutor thread only.
    """
    import torch

    if not _loaded:
        raise RuntimeError("Model not loaded — call load_model() first")

    messages = [
        {
            "role": "user",
            "content": (
                QUERY_SYSTEM_PROMPT
                + "\n\n"
                + context
                + "\n\n---\nUser question: "
                + question
            ),
        }
    ]

    text = _processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    device = next(_model.parameters()).device
    inputs = _processor(text=[text], return_tensors="pt").to(device)

    with torch.no_grad():
        output_ids = _model.generate(
            **inputs,
            max_new_tokens=300,
            do_sample=False,
            temperature=None,
            top_p=None,
        )

    new_tokens = output_ids[0][inputs.input_ids.shape[1]:]
    return _processor.decode(new_tokens, skip_special_tokens=True).strip()


def is_loaded() -> bool:
    return _loaded
