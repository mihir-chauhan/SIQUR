import gradio as gr
import cv2
import numpy as np
from ultralytics import SAM, YOLO

sam = SAM("sam2.1_b.pt")
detector = YOLO("yolo11n.pt")

ALPHA               = 0.5
REID_HIST_THRESHOLD = 0.40   # min histogram correlation to re-identify
REID_MAX_GAP        = 120    # frames to remember a lost track
REID_MAX_DIST       = 500    # loose spatial gate (pixels)
HIST_BUILD_FRAMES   = 10     # frames to average before using hist for re-ID

DEFAULT_ROLES = [
    ("Robber",         "#FF0000"),
    ("Victim",         "#FFFF00"),
    ("Security Guard", "#00FF00"),
    ("Bystander",      "#0088FF"),
    ("Other",          "#FF00FF"),
]

def hex_to_bgr(hex_color):
    hex_color = hex_color.lstrip("#")
    r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return [b, g, r]

def person_histogram(frame, box):
    x1, y1, x2, y2 = map(int, box)
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
    bw, bh = x2 - x1, y2 - y1
    if bw < 8 or bh < 8:
        return None
    px, py = int(bw * 0.2), int(bh * 0.1)
    crop = frame[y1 + py : y2 - py, x1 + px : x2 - px]
    if crop.size == 0:
        return None
    hsv  = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [18, 16], [0, 180, 0, 256])
    cv2.normalize(hist, hist, alpha=1, beta=0, norm_type=cv2.NORM_L1)
    return hist

def hist_sim(h1, h2):
    if h1 is None or h2 is None:
        return 0.0
    return float(cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL))

def draw_legend(frame, role_names, role_colors, seen_indices):
    if not seen_indices:
        return frame
    box_size, padding = 20, 8
    font, scale, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1
    for i, idx in enumerate(sorted(seen_indices)):
        name  = role_names[idx] if idx < len(role_names) else f"Person {idx+1}"
        color = role_colors[idx % len(role_colors)]
        y = padding + i * (box_size + 6)
        cv2.rectangle(frame, (padding, y), (padding + box_size, y + box_size), color, -1)
        cv2.putText(frame, name, (padding + box_size + 6, y + box_size - 4),
                    font, scale, (255, 255, 255), thick + 1, cv2.LINE_AA)
        cv2.putText(frame, name, (padding + box_size + 6, y + box_size - 4),
                    font, scale, (0, 0, 0), thick, cv2.LINE_AA)
    return frame

def process_video(video_path,
                  r1_name, r1_color, r2_name, r2_color,
                  r3_name, r3_color, r4_name, r4_color,
                  r5_name, r5_color):
    role_names  = [r1_name, r2_name, r3_name, r4_name, r5_name]
    role_colors = [hex_to_bgr(c) for c in [r1_color, r2_color, r3_color, r4_color, r5_color]]

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(3)), int(cap.get(4))
    out = cv2.VideoWriter("output.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    # YOLO track ID → color index (set once, never changes)
    id_to_color   = {}
    # Histogram accumulation for each live track
    id_hist_buf   = {}   # track_id -> list of histograms (up to HIST_BUILD_FRAMES)
    id_stable_hist= {}   # track_id -> averaged histogram
    # Memory of lost tracks for re-ID
    lost_tracks   = {}   # track_id -> {color_idx, hist, cx, cy, last_frame}

    next_color_idx = 0
    seen_colors    = set()
    frame_num      = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = detector.track(frame, classes=[0], persist=True,
                                 tracker="bytetrack.yaml", verbose=False)[0]

        if results.boxes and len(results.boxes):
            boxes     = results.boxes.xyxy.cpu().numpy()
            track_ids = results.boxes.id

            if track_ids is not None:
                track_ids  = track_ids.cpu().numpy().astype(int)
                active_ids = set(track_ids)

                for i, tid in enumerate(track_ids):
                    x1, y1, x2, y2 = boxes[i]
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    hist   = person_histogram(frame, boxes[i])

                    if tid not in id_to_color:
                        # --- Try appearance-based re-identification ---
                        best_old_tid, best_score = None, REID_HIST_THRESHOLD
                        for old_tid, info in lost_tracks.items():
                            if old_tid in active_ids:
                                continue
                            if frame_num - info["last_frame"] > REID_MAX_GAP:
                                continue
                            dist = ((cx - info["cx"]) ** 2 + (cy - info["cy"]) ** 2) ** 0.5
                            if dist > REID_MAX_DIST:
                                continue
                            score = hist_sim(hist, info["hist"])
                            if score > best_score:
                                best_score   = score
                                best_old_tid = old_tid

                        if best_old_tid is not None:
                            id_to_color[tid] = lost_tracks[best_old_tid]["color_idx"]
                            # Inherit stable histogram from the old track
                            id_stable_hist[tid] = lost_tracks[best_old_tid]["hist"]
                            id_hist_buf[tid]    = []
                        else:
                            id_to_color[tid]    = next_color_idx
                            id_stable_hist[tid] = hist
                            id_hist_buf[tid]    = []
                            next_color_idx     += 1

                    # Accumulate histogram to build a stable average
                    if hist is not None:
                        id_hist_buf[tid].append(hist)
                        if len(id_hist_buf[tid]) >= HIST_BUILD_FRAMES:
                            id_stable_hist[tid] = np.mean(id_hist_buf[tid], axis=0).astype(np.float32)
                            id_hist_buf[tid]    = []  # reset buffer, keep stable hist

                    # Keep lost_tracks updated so future re-ID can use it
                    lost_tracks[tid] = {
                        "color_idx":  id_to_color[tid],
                        "hist":       id_stable_hist.get(tid, hist),
                        "cx":         cx,
                        "cy":         cy,
                        "last_frame": frame_num,
                    }

                seen_colors.update(id_to_color[tid] for tid in track_ids)

                sam_results = sam(frame, bboxes=boxes)
                if sam_results[0].masks:
                    overlay = frame.copy()
                    for i, mask in enumerate(sam_results[0].masks.data.cpu().numpy()):
                        color = role_colors[id_to_color[track_ids[i]] % len(role_colors)]
                        cm = np.zeros_like(frame)
                        cm[mask.astype(bool)] = color
                        overlay = cv2.addWeighted(overlay, 1.0, cm, ALPHA, 0)
                    frame = overlay

        frame = draw_legend(frame, role_names, role_colors, seen_colors)
        frame_num += 1
        out.write(frame)

    cap.release()
    out.release()
    return "output.mp4"

with gr.Blocks(title="SAM2 Role Highlighter") as demo:
    gr.Markdown("## SAM2 Role Highlighter\nPeople are assigned roles in order of first appearance.")
    with gr.Row():
        video_in = gr.Video(label="Upload Video")
    gr.Markdown("### Role Colors")
    role_inputs = []
    for name, color in DEFAULT_ROLES:
        with gr.Row():
            role_inputs += [gr.Textbox(value=name,  label="Role name", scale=3),
                            gr.ColorPicker(value=color, label="Color",  scale=1)]
    run_btn   = gr.Button("Process", variant="primary")
    video_out = gr.Video(label="Output")
    run_btn.click(process_video, [video_in] + role_inputs, video_out)

demo.launch()
