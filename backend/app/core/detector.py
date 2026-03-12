from ultralytics import YOLO
from app.config import YOLO_MODEL_PATH

# model = YOLO(YOLO_MODEL_PATH)

# def detect_and_annotate(frame):
#     results = model(frame)
#     return results[0].plot()
model = YOLO(YOLO_MODEL_PATH)

def detect_and_annotate(frame):

    results = model(frame)
    boxes = results[0].boxes

    detections = []

    if boxes is not None and len(boxes) > 0:
        for box in boxes:
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            weapon_name = model.names[class_id]

            # lower threshold if you want knife included
            if confidence > 0.25:
                detections.append({
                    "weapon_type": weapon_name,
                    "confidence": confidence
                })

    annotated_frame = results[0].plot()

    return annotated_frame, detections