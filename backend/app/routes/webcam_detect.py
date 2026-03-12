from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import cv2
from app.core.detector import detect_and_annotate

router = APIRouter()

def gen_frames():
    cap = cv2.VideoCapture(0)  # 0 is the default webcam

    if not cap.isOpened():
        raise RuntimeError("Could not access webcam")

    while True:
        success, frame = cap.read()
        if not success:
            break

        # Weapon detection
        annotated = detect_and_annotate(frame)

        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', annotated)
        frame_bytes = buffer.tobytes()

        # Yield as multipart stream
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )

    cap.release()

@router.get("/camera")
def live_camera_feed():
    return StreamingResponse(gen_frames(), media_type="multipart/x-mixed-replace; boundary=frame")
