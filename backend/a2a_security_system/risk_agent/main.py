import os
import json
import uuid
import base64
from pathlib import Path
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

# ----------------------------
# Load Environment Variables
# ----------------------------
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash")

# ----------------------------
# Request Schema
# ----------------------------
class RiskRequest(BaseModel):
    weapons_detected: dict
    location: str
    timestamp: str
    scene_image_b64: Optional[str] = None


# ----------------------------
# Risk Assessment Endpoint
# ----------------------------
@app.post("/assess_risk")
async def assess_risk(request: RiskRequest):

    # -----------------------------------
    #  Deterministic Risk Classification
    # -----------------------------------
    max_conf = max(request.weapons_detected.values()) if request.weapons_detected else 0

    if max_conf > 0.8:
        risk_level = "HIGH"
    elif max_conf > 0.5:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    incident_id = str(uuid.uuid4())

    # -----------------------------------
    #  Use Gemini for explanation (with optional vision)
    # -----------------------------------
    has_image = bool(request.scene_image_b64)

    image_instruction = """
You have also been provided with the actual annotated CCTV capture from the detection system.
Carefully analyze the image:
- Describe what you see in the scene (people, weapons, environment, positioning)
- Note the type and appearance of any weapons visible
- Assess the threat context based on body language, proximity, and scene layout
- Use these visual observations to strengthen your reasoning
""" if has_image else ""

    prompt = f"""
You are a professional AI security assistant for a weapon detection system.

The risk level has already been deterministically classified as: {risk_level}

Detected weapons (from YOLO model):
{request.weapons_detected}

Location: {request.location}
Timestamp: {request.timestamp}
{image_instruction}
Explain in detail why this risk level is appropriate. Cover:
- The nature and severity of the detected threat
- Potential harms and risks to people in the vicinity
- Contextual factors that influence the threat level
- Observable scene details (if image provided)

Respond ONLY in valid JSON:

{{
  "risk_level": "{risk_level}",
  "reasoning": "..."
}}
"""

    if has_image:
        # Multimodal call — Gemini Vision sees the actual annotated scene
        img_bytes = base64.b64decode(request.scene_image_b64)
        image_part = {"mime_type": "image/jpeg", "data": img_bytes}
        response = model.generate_content([prompt, image_part])
    else:
        # Text-only fallback (backward compatible)
        response = model.generate_content(prompt)
    raw_text = response.text.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(raw_text)
        reasoning = parsed.get("reasoning", "No reasoning provided.")

    except Exception:
        reasoning = "AI explanation parsing failed."

    # -----------------------------------
    #  Return risk assessment only
    # (Orchestration is handled by personal_agent's LangGraph workflow)
    # -----------------------------------
    return {
        "incident_id": incident_id,
        "risk_level": risk_level,
        "risk_reasoning": reasoning,
    }