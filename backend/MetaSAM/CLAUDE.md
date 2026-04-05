# SAM2 person highlighter

Segment and highlight all people in a video using Meta's SAM 2 and a YOLO person detector.

## Stack

- `ultralytics` — wraps SAM 2 and YOLO, handles model downloads automatically
- `gradio` — browser UI with color picker, opacity slider, video upload/download
- `opencv-python` — video reading and writing

## Setup

```bash
pip install ultralytics gradio opencv-python
```

No manual model downloads needed. Both `sam2.1_b.pt` and `yolo11n.pt` download
automatically on first run.

> **Windows users:** run inside WSL (Ubuntu) for best compatibility.

## Usage

Run the app:

```bash
python app.py
```

Open the URL printed in the terminal (e.g. `http://localhost:7860`), then:

1. Upload your video
2. Pick a highlight color
3. Adjust opacity
4. Click **Process**
5. Download the output

## app.py

```python
import gradio as gr
import cv2
import numpy as np
from ultralytics import SAM, YOLO

sam = SAM("sam2.1_b.pt")
detector = YOLO("yolo11n.pt")

def process_video(video_path, color_hex, alpha):
    color_hex = color_hex.lstrip("#")
    r, g, b = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
    color = [b, g, r]

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(3)), int(cap.get(4))
    out_path = "output.mp4"
    out = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        detections = detector(frame, classes=[0], verbose=False)[0]
        boxes = detections.boxes.xyxy.cpu().numpy() if len(detections.boxes) else []
        if len(boxes):
            results = sam(frame, bboxes=boxes)
            if results[0].masks:
                overlay = frame.copy()
                for mask in results[0].masks.data.cpu().numpy():
                    color_mask = np.zeros_like(frame)
                    color_mask[mask.astype(bool)] = color
                    overlay = cv2.addWeighted(overlay, 1.0, color_mask, alpha, 0)
                frame = overlay
        out.write(frame)

    cap.release()
    out.release()
    return out_path

with gr.Blocks() as demo:
    gr.Markdown("## SAM2 Person Highlighter")
    with gr.Row():
        video_in = gr.Video(label="Upload Video")
        color_pick = gr.ColorPicker(label="Highlight Color", value="#00FF64")
        alpha_slider = gr.Slider(0.1, 1.0, value=0.5, label="Opacity")
    run_btn = gr.Button("Process")
    video_out = gr.Video(label="Output")
    run_btn.click(process_video, [video_in, color_pick, alpha_slider], video_out)

demo.launch()
```

## Tips

- Use a GPU for real-time speed (~44 fps). CPU works but is slower — swap to
  `sam2.1_t.pt` (tiny model) if CPU inference is too slow.
- To change highlight color per person instead of one color for all, generate a
  random color per detected box and apply it to that person's mask only.
- To process multiple videos in a batch, loop over files and call
  `process_video()` directly without the Gradio UI.
- Output is saved as `output.mp4` in the same directory you run the script from.
