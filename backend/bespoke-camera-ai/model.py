"""
model.py — Lightweight crime prediction model for edge deployment.

Architecture:
  MobileNetV3-Small (pretrained) → per-frame spatial features
  Single-layer LSTM              → temporal reasoning across frames
  Small MLP head                 → 4-class output

Input:  (B, T, C, H, W)  — batch of T-frame clips, C=3, H=W=112
Output: (B, 4)            — logits for [normal, loitering, theft, disturbance]

Exported to ONNX + INT8 quantization → ~2-3 MB on disk.
"""

import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

# ── Constants shared across the codebase ──────────────────────────────────────

NUM_CLASSES  = 4
LABELS       = ["normal", "loitering", "theft", "disturbance"]
LABEL_MAP    = {l: i for i, l in enumerate(LABELS)}
FRAME_SIZE   = (112, 112)   # spatial resize for each frame
NUM_FRAMES   = 8            # frames sampled per clip during training/inference

# Crime danger weights per class (used to compute a [0,1] score at deploy time)
DANGER_WEIGHTS = torch.tensor([0.0, 0.45, 1.0, 0.9])


# ── Model ─────────────────────────────────────────────────────────────────────

class CrimePredictor(nn.Module):
    """
    Lightweight video classifier for suspicious activity detection.

    Total params: ~2.7M  (~10 MB fp32, ~2.7 MB int8 after quantization)
    Latency (CPU, 1 clip): ~30-80 ms depending on hardware
    """

    _FEAT_DIM = 576   # MobileNetV3-Small last conv output channels

    def __init__(self, num_classes: int = NUM_CLASSES, lstm_hidden: int = 128):
        super().__init__()

        # ── Spatial backbone ─────────────────────────────────────────────────
        backbone       = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)
        self.features  = backbone.features          # outputs (B, 576, H', W')
        self.pool      = nn.AdaptiveAvgPool2d(1)    # → (B, 576, 1, 1)

        # ── Temporal reasoning ───────────────────────────────────────────────
        self.lstm = nn.LSTM(
            input_size=self._FEAT_DIM,
            hidden_size=lstm_hidden,
            num_layers=1,
            batch_first=True,
        )

        # ── Classification head ──────────────────────────────────────────────
        self.head = nn.Sequential(
            nn.Linear(lstm_hidden, 64),
            nn.Hardswish(),
            nn.Dropout(0.2),
            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x: (B, T, C, H, W)
        returns logits: (B, num_classes)
        """
        B, T, C, H, W = x.shape

        # Extract per-frame spatial features
        frames = x.view(B * T, C, H, W)
        feats  = self.pool(self.features(frames))   # (B*T, 576, 1, 1)
        feats  = feats.view(B, T, self._FEAT_DIM)   # (B, T, 576)

        # Temporal aggregation — use final hidden state
        lstm_out, _ = self.lstm(feats)              # (B, T, hidden)
        context     = lstm_out[:, -1]               # (B, hidden)

        return self.head(context)                   # (B, num_classes)

    def predict(self, x: torch.Tensor) -> dict:
        """
        Convenience method: returns classes + danger score in one call.
        x: (1, T, C, H, W)  single clip
        """
        self.eval()
        with torch.no_grad():
            logits = self(x)
            probs  = torch.softmax(logits, dim=-1)[0]
            cls    = int(probs.argmax())
            score  = float((probs * DANGER_WEIGHTS.to(probs.device)).sum())
        return {
            "class_idx":   cls,
            "class_label": LABELS[cls],
            "probabilities": {l: float(probs[i]) for i, l in enumerate(LABELS)},
            "danger_score":  score,   # 0.0 = safe, 1.0 = high threat
        }


def crime_score(logits: torch.Tensor) -> torch.Tensor:
    """
    Batch danger score from raw logits.
    logits: (B, 4)  →  score: (B,)  in [0, 1]
    """
    probs = torch.softmax(logits, dim=-1)
    return (probs * DANGER_WEIGHTS.to(logits.device)).sum(dim=-1)


def param_count(model: nn.Module) -> str:
    total = sum(p.numel() for p in model.parameters())
    train = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return f"{total/1e6:.2f}M total, {train/1e6:.2f}M trainable"


if __name__ == "__main__":
    m = CrimePredictor()
    print("Params:", param_count(m))
    x = torch.randn(2, NUM_FRAMES, 3, *FRAME_SIZE)
    out = m(x)
    print("Output shape:", out.shape)
    print("Sample prediction:", m.predict(x[:1]))
