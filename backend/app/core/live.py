# app/core/live.py

import cv2
from threading import Thread
from app.config import OUTPUT_DIR, YOLO_MODEL_PATH
from ultralytics import YOLO
import os
import time

model = YOLO(YOLO_MODEL_PATH)

is_streaming = False
stream_thread = None
video_writer = None
output_path = None
cap = None

def _detect_and_record_stream(stream_url: str):
    global is_streaming, video_writer, output_path, cap

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print(f"[ERROR] Failed to open stream: {stream_url}")
        is_streaming = False
        return

    # Output folder
    output_dir = os.path.join(OUTPUT_DIR, "live")
    os.makedirs(output_dir, exist_ok=True)

    # Video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 20  # fallback

    # Output path
    timestamp = int(time.time())
    output_path = os.path.join(output_dir, f"live_{timestamp}.mp4")

    # Video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video_writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    print(f"[INFO] Recording started to: {output_path}")

    while is_streaming:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame)
        annotated = results[0].plot()

        video_writer.write(annotated)

        # Optional: display window
        cv2.imshow("Live Detection", annotated)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    print("[INFO] Recording stopped.")

def start_live_detection(stream_url: str):
    global is_streaming, stream_thread
    if is_streaming:
        return False

    is_streaming = True
    stream_thread = Thread(target=_detect_and_record_stream, args=(stream_url,))
    stream_thread.start()
    return True

def stop_live_detection():
    global is_streaming, video_writer, cap
    is_streaming = False
    time.sleep(2)

    if video_writer:
        video_writer.release()
        video_writer = None

    if cap:
        cap.release()
        cap = None

    cv2.destroyAllWindows()

    return output_path  # return saved video path
