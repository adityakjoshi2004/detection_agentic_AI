from ultralytics import YOLO
from app.config import YOLO_MODEL_PATH
import tempfile
from PIL import Image
import io

model = YOLO(YOLO_MODEL_PATH)
def detects_and_annotate(image_bytes: bytes) -> bytes:
    # Save uploaded image temporarily
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_file:
        tmp_file.write(image_bytes)
        tmp_path = tmp_file.name

    # Run YOLOv8 detection
    results = model(tmp_path)

    # Get annotated image (with bounding boxes drawn)
    result_image = results[0].plot()

    # Convert annotated image to bytes
    img = Image.fromarray(result_image)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
