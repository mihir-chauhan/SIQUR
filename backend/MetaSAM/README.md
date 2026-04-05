# MetaSAM — SAM2 Role Highlighter

Segments people in a video and color-codes them by role (Robber, Victim, Security Guard, etc.) using Meta's SAM 2 and a YOLO person detector. People are tracked across frames with histogram-based re-identification so each person keeps their assigned color even if they leave and re-enter the frame.

## How it works

1. **YOLO detection + ByteTrack** — `yolo11n` detects all `person` boxes each frame and maintains persistent track IDs via ByteTrack.
2. **Re-identification** — When a track ID reappears after a gap, HSV histogram similarity (`cv2.compareHist`) is used to match it to a previously-seen track. If similarity exceeds `REID_HIST_THRESHOLD` (0.40) and the spatial gap is within `REID_MAX_DIST` (500 px), the old color index is inherited.
3. **SAM 2 segmentation** — `sam2.1_b` refines each YOLO bounding box into a precise pixel mask.
4. **Color overlay** — Each mask is blended onto the frame at `ALPHA=0.5` using the role color mapped to that track's index.
5. **Legend** — Role name + color swatch is drawn in the top-left corner for every role seen so far.

## Usage

```bash
python app.py
```

Open the Gradio URL printed in the terminal (e.g. `http://localhost:7860`), then:

1. Upload a video
2. Edit role names and pick colors for up to 5 roles (defaults: Robber, Victim, Security Guard, Bystander, Other)
3. Click **Process**
4. Download `output.mp4`

People are assigned roles in order of first appearance — the first person detected gets Role 1, the second gets Role 2, and so on.

## Setup

```bash
pip install ultralytics gradio opencv-python numpy
```

Model weights (`sam2.1_b.pt`, `yolo11n.pt`) are included in this directory. If they are missing, Ultralytics downloads them automatically on first run.

## Files

| File | Purpose |
|------|---------|
| `app.py` | Gradio UI, YOLO tracking, SAM 2 segmentation, re-ID, video I/O |
| `sam2.1_b.pt` | SAM 2.1 Base checkpoint |
| `yolo11n.pt` | YOLOv11 Nano checkpoint (person detection) |
| `output.mp4` | Last processed video (overwritten on each run) |

## Key constants

| Constant | Default | Description |
|----------|---------|-------------|
| `ALPHA` | `0.5` | Mask overlay opacity |
| `REID_HIST_THRESHOLD` | `0.40` | Min HSV histogram correlation to accept a re-ID match |
| `REID_MAX_GAP` | `120` | Frames to remember a lost track for re-ID |
| `REID_MAX_DIST` | `500` | Max pixel distance for re-ID spatial gate |
| `HIST_BUILD_FRAMES` | `10` | Frames to average before using histogram for re-ID |
