
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
import os
import uuid
import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from app.agents.orchestrator import handle_detection
from datetime import datetime
from app.core.detector import detect_and_annotate
from app.config import OUTPUT_DIR

router = APIRouter()

@router.post("/")
async def process_video(file: UploadFile = File(...)):
    try:
        video_id = str(uuid.uuid4())
        input_path = os.path.join(OUTPUT_DIR, "videos", f"{video_id}_input.mp4")
        output_path = os.path.join(OUTPUT_DIR, "videos", f"{video_id}_output.mp4")

        # Save uploaded video
        with open(input_path, "wb") as f:
            f.write(await file.read())

        # Read input video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise Exception("Failed to open uploaded video.")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if fps == 0:
            fps = 24  # default fallback FPS

        print(f"[INFO] Video Resolution: {width}x{height}, FPS: {fps}")

        # Try writing with 'avc1' codec for H.264 support
        fourcc = cv2.VideoWriter_fourcc(*'avc1')  # Try H.264
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        # Fallback if failed to open
        if not out.isOpened():
            print("H.264 ('avc1') codec failed, falling back to 'mp4v'.")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            output_path = f"outputs/{video_id}_fallback_output.mp4"
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        detected_weapons = {}
        frames_processed = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            annotated, detections = detect_and_annotate(frame)

            for detection in detections:
                weapon = detection["weapon_type"]
                confidence = detection["confidence"]

                if weapon not in detected_weapons:
                    detected_weapons[weapon] = confidence
                else:
                    detected_weapons[weapon] = max(detected_weapons[weapon], confidence)

            out.write(annotated)
            frames_processed += 1

        cap.release()
        out.release()

        # Build response
        response_data = {
            "video": f"/outputs/videos/{video_id}_output.mp4",
            "video_info": {
                "width": width,
                "height": height,
                "fps": round(fps, 1),
                "total_frames": total_frames,
                "frames_processed": frames_processed,
            },
        }

        if detected_weapons:
            event = {
                "event_id": video_id,
                "weapons_detected": detected_weapons,
                "location": "Uploaded Video",
                "timestamp": datetime.utcnow().isoformat()
            }
            handle_detection(event)

            # Add detections for frontend
            response_data["detections"] = [
                {"class": wtype, "confidence": round(conf, 2)}
                for wtype, conf in detected_weapons.items()
            ]

            # Generate prediction chart
            labels = list(detected_weapons.keys())
            scores = list(detected_weapons.values())

            fig, ax = plt.subplots(figsize=(8, 4))
            bars = ax.barh(labels, scores, color=["#e74c3c" if s > 0.7 else "#f39c12" for s in scores])
            ax.set_xlim(0, 1)
            ax.set_xlabel("Confidence")
            ax.set_title("Video Weapon Detection — Peak Confidence")
            for bar, score in zip(bars, scores):
                ax.text(bar.get_width() + 0.02, bar.get_y() + bar.get_height() / 2,
                        f"{score:.2f}", va="center", fontweight="bold")
            plt.tight_layout()

            chart_path = f"outputs/images/{uuid.uuid4()}_prediction_chart.png"
            fig.savefig(chart_path, dpi=100)
            plt.close(fig)

            response_data["prediction_chart"] = chart_path

        return JSONResponse(response_data)

    except Exception as e:
        print("[ERROR]", e)
        return JSONResponse(status_code=500, content={"error": str(e)})
