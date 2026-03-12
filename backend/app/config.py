# app/config.py

import os

# Base directory of the backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Path to your YOLO model
YOLO_MODEL_PATH = os.path.join(BASE_DIR, "models", "best.pt")

# Default IP camera URL (can be overridden by user input)
IP_CAMERA_URL = "http://192.168.0.xxx:8080/video"

# Output directories (these are relative to backend/)
OUTPUT_DIR = os.path.join(BASE_DIR, "..", "outputs")
SAVE_ALERTS_PATH = os.path.join(BASE_DIR, "static", "alerts")
SAVE_VIDEO_PATH = os.path.join(BASE_DIR, "static", "output.mp4")
