import os
import json
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI


env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()


# ── Gemini LLM ───────────────────────────────────────────────────────────
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.25
)


class NotificationRequest(BaseModel):
    incident_id: str
    risk_level: str
    location: str
    sop_steps: list
    ai_recommended_steps: Optional[list] = []
    immediate_actions: Optional[list] = []
    risk_reasoning: Optional[str] = ""
    timestamp: Optional[str] = ""


@app.post("/notify")
async def notify(request: NotificationRequest):

    # Build context from all incoming data
    sop_summary = "\n".join(f"  - {s}" for s in request.sop_steps) if request.sop_steps else "None provided"
    ai_steps_summary = "\n".join(f"  - {s}" for s in request.ai_recommended_steps) if request.ai_recommended_steps else "None provided"
    immediate_summary = "\n".join(f"  - {s}" for s in request.immediate_actions) if request.immediate_actions else "None provided"

    prompt = f"""
You are an expert emergency notification and communication AI for a corporate
security operations center. Your job is to generate professional, actionable
notification messages that can be immediately dispatched to the right people.

─── INCIDENT DETAILS ───
• Incident ID : {request.incident_id}
• Risk Level  : {request.risk_level}
• Location    : {request.location}
• Timestamp   : {request.timestamp or "Not provided"}
• Risk Reasoning: {request.risk_reasoning or "Not provided"}

─── SOP STEPS (from company protocols) ───
{sop_summary}

─── AI RECOMMENDED STEPS ───
{ai_steps_summary}

─── IMMEDIATE ACTIONS ───
{immediate_summary}

─── YOUR TASK ───
Based on ALL the above information, generate a comprehensive notification
package. Use your own expertise to decide:

1. **Alert Message**: A clear, urgent, professional security alert message
   that summarizes the situation. This should be ready to broadcast over
   PA systems, walkie-talkies, or messaging platforms.

2. **SMS/WhatsApp Messages**: Short, tailored messages ready to send to:
   - Security team on ground
   - Management / shift supervisor
   - Building occupants (if evacuation needed)

3. **Emergency Helpline Numbers**: Based on the type of incident and risk
   level, provide relevant emergency contact categories with standard
   Indian emergency numbers:
   - Police: 100 / 112
   - Ambulance: 102 / 108
   - Fire Brigade: 101
   - Women Helpline: 1091
   - Disaster Management: 1078
   - Anti-Terror Squad (if applicable)
   - Local control room
   Pick ONLY the ones relevant to this specific incident type and risk level.

4. **Notification Priority List**: Who should be notified first, second,
   third etc. based on the severity.


Tailor EVERYTHING to the specific risk level:
- LOW: internal notification only, no external helplines
- MEDIUM: supervisor + security head, relevant helplines on standby
- HIGH: full emergency broadcast, all relevant helplines, law enforcement
- CRITICAL: all channels, executive leadership, media handling prep

Return ONLY valid JSON in this exact format:
{{
  "notification_status": "dispatched",
  "incident_id": "{request.incident_id}",
  "risk_level": "{request.risk_level}",
  "alert_message": "<professional broadcast-ready alert message>",
  "sms_messages": {{
    "security_team": "<short SMS for ground security>",
    "management": "<SMS for management/supervisor>",
    "occupants": "<SMS for building occupants if needed, or 'Not required for this risk level'>"
  }},
  "emergency_helplines": [
    {{"name": "<agency name>", "number": "<number>", "reason": "<why this is relevant>"}}
  ],
  "notification_priority": [
    "1. <who to notify first>",
    "2. <who to notify second>"
  ]
}}

Return ONLY the JSON object, no markdown fences, no extra text.
"""

    response = llm.invoke(prompt)
    raw_text = response.content.strip()

    # Clean markdown fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(raw_text)

        # Print the alert to the server console for visibility
        print("\n" + "=" * 60)
        print("🚨 SECURITY NOTIFICATION DISPATCHED")
        print("=" * 60)
        print(f"Incident: {request.incident_id}")
        print(f"Risk Level: {request.risk_level}")
        print(f"Location: {request.location}")
        print("-" * 60)
        print("ALERT MESSAGE:")
        print(parsed.get("alert_message", "N/A"))
        print("-" * 60)
        helplines = parsed.get("emergency_helplines", [])
        if helplines:
            print("EMERGENCY HELPLINES:")
            for h in helplines:
                print(f"  📞 {h.get('name', 'Unknown')}: {h.get('number', 'N/A')} — {h.get('reason', '')}")
        print("-" * 60)
        priority = parsed.get("notification_priority", [])
        if priority:
            print("NOTIFICATION PRIORITY:")
            for p in priority:
                print(f"  {p}")
        print("=" * 60 + "\n")

        return parsed

    except Exception:
        return {
            "error": "Failed to parse notification response",
            "raw_response": raw_text,
            "notification_status": "failed",
            "incident_id": request.incident_id
        }