from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
import os
import uuid
import cv2
import time
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from app.core.detector import detect_and_annotate
from app.core.alert import save_alert_frame
from app.config import OUTPUT_DIR

router = APIRouter()

@router.post("/")
async def detect_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        npimg = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        original_path = f"outputs/images/{uuid.uuid4()}_original.jpg"
        cv2.imwrite(original_path, img)
        time.sleep(1.5)

        resized = cv2.resize(img, (640, 640))
        resized_path = f"outputs/images/{uuid.uuid4()}_resized.jpg"
        cv2.imwrite(resized_path, resized)
        time.sleep(1.5)

        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        gray_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        gray_path = f"outputs/images/{uuid.uuid4()}_gray.jpg"
        cv2.imwrite(gray_path, gray_bgr)
        time.sleep(1.5)

        blurred = cv2.GaussianBlur(gray_bgr, (5, 5), 0)
        blurred_path = f"outputs/images/{uuid.uuid4()}_blurred.jpg"
        cv2.imwrite(blurred_path, blurred)
        time.sleep(1.5)

        edges = cv2.Canny(gray, 100, 200)
        edges_bgr = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        edges_path = f"outputs/images/{uuid.uuid4()}_edges.jpg"
        cv2.imwrite(edges_path, edges_bgr)
        time.sleep(1.5)

        # Unpack both the annotated frame AND detections list
        annotated_frame, detections = detect_and_annotate(resized)
        annotated_path = f"outputs/images/{uuid.uuid4()}_annotated.jpg"
        cv2.imwrite(annotated_path, annotated_frame)
        time.sleep(1.5)

        # Encode annotated frame as base64 for AI agent vision input
        _, img_buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        scene_image_b64 = base64.b64encode(img_buffer).decode('utf-8')

        # Build response
        response_data = {
            "original": original_path,
            "resized": resized_path,
            "gray": gray_path,
            "blurred": blurred_path,
            "edges": edges_path,
            "annotated": annotated_path,
        }

        # Add detections with class/confidence keys for frontend
        if detections:
            response_data["detections"] = [
                {"class": d["weapon_type"], "confidence": round(d["confidence"], 2)}
                for d in detections
            ]
            # Include base64 scene image for AI agents to analyze visually
            response_data["scene_image_b64"] = scene_image_b64

            # Generate prediction chart
            labels = [d["weapon_type"] for d in detections]
            scores = [d["confidence"] for d in detections]

            fig, ax = plt.subplots(figsize=(8, 4))
            bars = ax.barh(labels, scores, color=["#e74c3c" if s > 0.7 else "#f39c12" for s in scores])
            ax.set_xlim(0, 1)
            ax.set_xlabel("Confidence")
            ax.set_title("Weapon Detection Predictions")
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
        return JSONResponse(content={"error": str(e)}, status_code=500)
