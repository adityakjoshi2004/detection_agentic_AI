# app/routes/live_detect.py

from fastapi import APIRouter, Query
from app.core.live import start_live_detection, stop_live_detection

router = APIRouter()

@router.post("/start")
async def start_live(stream_url: str = Query(..., description="Stream URL (e.g. from mobile IP Webcam)")):
    success = start_live_detection(stream_url)
    if success:
        return {"status": "Live detection started"}
    return {"status": "Already running or failed to start"}

@router.post("/stop")
async def stop_live():
    saved_path = stop_live_detection()
    return {
        "status": "Live detection stopped",
        "video_saved": f"/{saved_path}" if saved_path else "N/A"
    }
