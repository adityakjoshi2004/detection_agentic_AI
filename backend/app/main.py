from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
from app.routes import image_detect, video_detect, live_detect, webcam_detect

app = FastAPI(title="Weapon Detection API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#  Absolute path for static files
BASE_DIR = Path(__file__).resolve().parent.parent  # points to `backend/`
STATIC_DIR = BASE_DIR / "outputs"  # full path to `backend/outputs`

app.mount("/outputs", StaticFiles(directory=os.path.join("outputs")), name="outputs")

# Routers
app.include_router(image_detect.router, prefix="/api")
app.include_router(video_detect.router, prefix="/api/video")
app.include_router(live_detect.router, prefix="/api")
app.include_router(webcam_detect.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Weapon Detection Backend Running"}
