from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
from app.routes import image_detect, video_detect, live_detect, webcam_detect

app = FastAPI(title="Weapon Detection API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = Path(__file__).resolve().parent.parent  
STATIC_DIR = BASE_DIR / "outputs"  

app.mount("/outputs", StaticFiles(directory=os.path.join("outputs")), name="outputs")


app.include_router(image_detect.router, prefix="/api")
app.include_router(video_detect.router, prefix="/api/video")
app.include_router(live_detect.router, prefix="/api")
app.include_router(webcam_detect.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Weapon Detection Backend Running"}
