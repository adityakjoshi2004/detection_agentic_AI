import os
import time
import cv2
from app.config import OUTPUT_DIR

def save_alert_frame(frame, tag="weapon"):
    timestamp = int(time.time())
    filename = f"{tag}_{timestamp}.jpg"
    path = os.path.join(OUTPUT_DIR, "live_frames", filename)
    cv2.imwrite(path, frame)
    return path
