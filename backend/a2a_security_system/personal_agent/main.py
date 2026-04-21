from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import json
import asyncio
from datetime import datetime
from typing import TypedDict, Any, Optional, List
from langgraph.graph import StateGraph, END
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# Graph State
# -----------------------

class GraphState(TypedDict, total=False):
    weapons_detected: dict
    location: str
    timestamp: str
    scene_image_b64: Optional[str]
    risk_result: dict
    risk_level: str
    sop_result: dict
    notify_result: dict

class DetectionRequest(BaseModel):
    weapons_detected: dict
    location: str
    timestamp: str
    scene_image_b64: Optional[str] = None


# -----------------------
# Event collector helper
# -----------------------

def make_event(agent: str, port: int, status: str, message: str, data: dict = None):
    """Create a timestamped agent event."""
    return {
        "agent": agent,
        "port": port,
        "status": status,
        "message": message,
        "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
        "data": data,
    }


# -----------------------
# Agent Nodes (with event collection)
# -----------------------

async def risk_node(state, events: list = None):

    if events is not None:
        events.append(make_event("orchestrator", 8000, "routing",
            f"Received detection payload. Routing to Risk Agent..."))
        events.append(make_event("risk", 8001, "processing",
            f"Analyzing weapons: {', '.join(f'{k} ({v*100:.0f}%)' for k,v in state['weapons_detected'].items())}"))

    start = datetime.now()

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "http://127.0.0.1:8001/assess_risk",
            json={
                "weapons_detected": state["weapons_detected"],
                "location": state["location"],
                "timestamp": state["timestamp"],
                "scene_image_b64": state.get("scene_image_b64"),
            }
        )

    elapsed = (datetime.now() - start).total_seconds()

    print(f"[risk_node] status={response.status_code} body={response.text}")

    if response.status_code != 200:
        if events is not None:
            events.append(make_event("risk", 8001, "error",
                f"Risk Agent returned HTTP {response.status_code}"))
        raise RuntimeError(
            f"risk_agent returned HTTP {response.status_code}: {response.text}"
        )

    data = response.json()

    if events is not None:
        events.append(make_event("risk", 8001, "done",
            f"Assessment complete: {data.get('risk_level', 'UNKNOWN')} risk ({elapsed:.2f}s)",
            {"risk_level": data.get("risk_level"), "elapsed": round(elapsed, 2)}))

    return {
        **state,
        "risk_result": data,
        "risk_level": data["risk_level"],
    }

async def sop_node(state, events: list = None):

    risk = state["risk_result"]

    if events is not None:
        events.append(make_event("orchestrator", 8000, "routing",
            f"Risk is {risk['risk_level']}. Routing to SOP Agent for response procedures..."))
        events.append(make_event("sop", 8002, "processing",
            f"Generating standard operating procedures for {risk['risk_level']} risk scenario at {state['location']}..."))

    start = datetime.now()

    async with httpx.AsyncClient(timeout=1000.0) as client:
        response = await client.post(
            "http://127.0.0.1:8002/retrieve_sop",
            json={
                "incident_id": risk["incident_id"],
                "risk_level": risk["risk_level"],
                "location": state["location"]
            }
        )

    elapsed = (datetime.now() - start).total_seconds()
    sop_data = response.json()

    step_count = len(sop_data.get("sop_steps", []))
    ai_count = len(sop_data.get("ai_recommended_steps", []))

    if events is not None:
        events.append(make_event("sop", 8002, "done",
            f"{step_count} SOP steps + {ai_count} AI recommendations generated ({elapsed:.2f}s)",
            {"sop_steps": step_count, "ai_steps": ai_count, "elapsed": round(elapsed, 2)}))

    return {
        **state,
        "sop_result": sop_data,
    }

async def notify_node(state, events: list = None):

    risk = state["risk_result"]
    sop = state["sop_result"]

    if events is not None:
        events.append(make_event("orchestrator", 8000, "routing",
            f"SOP complete. Routing to Notification Agent for alert generation..."))
        events.append(make_event("notify", 8003, "processing",
            f"Generating alerts, SMS templates, and emergency contacts for incident {risk.get('incident_id', 'N/A')}..."))

    start = datetime.now()

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "http://127.0.0.1:8003/notify",
            json={
                "incident_id": risk["incident_id"],
                "risk_level": risk["risk_level"],
                "location": state["location"],
                "timestamp": state.get("timestamp", ""),
                "sop_steps": sop.get("sop_steps", []),
                "ai_recommended_steps": sop.get("ai_recommended_steps", []),
                "immediate_actions": sop.get("immediate_actions", []),
                "risk_reasoning": risk.get("risk_reasoning", risk.get("reasoning", ""))
            }
        )

    elapsed = (datetime.now() - start).total_seconds()
    notify_data = response.json()

    sms_count = len(notify_data.get("sms_messages", {}))
    helpline_count = len(notify_data.get("emergency_helplines", []))

    if events is not None:
        events.append(make_event("notify", 8003, "done",
            f"Alerts ready: {sms_count} SMS templates, {helpline_count} helplines identified ({elapsed:.2f}s)",
            {"sms_count": sms_count, "helplines": helpline_count, "elapsed": round(elapsed, 2)}))

    return {
        **state,
        "notify_result": notify_data,
    }

# -----------------------
# Routing Logic
# -----------------------

def risk_router(state):

    if state["risk_level"] == "LOW":
        return END
    else:
        return "sop"


# -----------------------
# Build Graph (original — no events)
# -----------------------

graph = StateGraph(GraphState)

graph.add_node("risk", lambda s: risk_node(s))
graph.add_node("sop", lambda s: sop_node(s))
graph.add_node("notify", lambda s: notify_node(s))

graph.set_entry_point("risk")

graph.add_conditional_edges(
    "risk",
    risk_router,
    {
        "sop": "sop",
        END: END
    }
)

graph.add_edge("sop", "notify")
graph.add_edge("notify", END)

workflow = graph.compile()


# -----------------------
# Original API Endpoint (unchanged)
# -----------------------

@app.post("/analyze")
async def analyze(request: DetectionRequest):

    state = request.dict()

    result = await workflow.ainvoke(state)

    # Flatten the nested agent results into the shape the frontend expects
    risk = result.get("risk_result", {})
    sop = result.get("sop_result", {})
    notify = result.get("notify_result", {})

    return {
        "incident_id": risk.get("incident_id", ""),
        "risk_level": risk.get("risk_level", ""),
        "risk_reasoning": risk.get("risk_reasoning", risk.get("reasoning", "")),
        "location": result.get("location", ""),
        "timestamp": result.get("timestamp", ""),
        "sop_steps": sop.get("sop_steps", []),
        "ai_recommended_steps": sop.get("ai_recommended_steps", []),
        "immediate_actions": sop.get("immediate_actions", []),
        "communication_chain": sop.get("communication_chain", []),
        "estimated_response_time": sop.get("estimated_response_time", ""),
        "notification_status": notify.get("notification_status", notify.get("status", "")),
        "alert_message": notify.get("alert_message", ""),
        "sms_messages": notify.get("sms_messages", {}),
        "emergency_helplines": notify.get("emergency_helplines", []),
        "notification_priority": notify.get("notification_priority", []),
        "escalation_triggers": notify.get("escalation_triggers", []),
        "all_clear_message": notify.get("all_clear_message", ""),
        "ai_notes": notify.get("ai_notes", ""),
    }


# -----------------------
# NEW: SSE Streaming Endpoint
# -----------------------

def flatten_result(result: dict) -> dict:
    """Flatten agent results into the shape the frontend expects."""
    risk = result.get("risk_result", {})
    sop = result.get("sop_result", {})
    notify = result.get("notify_result", {})

    return {
        "incident_id": risk.get("incident_id", ""),
        "risk_level": risk.get("risk_level", ""),
        "risk_reasoning": risk.get("risk_reasoning", risk.get("reasoning", "")),
        "location": result.get("location", ""),
        "timestamp": result.get("timestamp", ""),
        "sop_steps": sop.get("sop_steps", []),
        "ai_recommended_steps": sop.get("ai_recommended_steps", []),
        "immediate_actions": sop.get("immediate_actions", []),
        "communication_chain": sop.get("communication_chain", []),
        "estimated_response_time": sop.get("estimated_response_time", ""),
        "notification_status": notify.get("notification_status", notify.get("status", "")),
        "alert_message": notify.get("alert_message", ""),
        "sms_messages": notify.get("sms_messages", {}),
        "emergency_helplines": notify.get("emergency_helplines", []),
        "notification_priority": notify.get("notification_priority", []),
        "escalation_triggers": notify.get("escalation_triggers", []),
        "all_clear_message": notify.get("all_clear_message", ""),
        "ai_notes": notify.get("ai_notes", ""),
    }


@app.post("/analyze_stream")
async def analyze_stream(request: DetectionRequest):
    """
    SSE streaming endpoint that emits agent events in real-time,
    then sends the final result.
    """

    async def event_generator():
        events: List[dict] = []
        state = request.dict()
        workflow_start = datetime.now()

        events.append(make_event("orchestrator", 8000, "start",
            f"Workflow initiated. Detected: {', '.join(state['weapons_detected'].keys())} at {state['location']}"))

        # ───── Run each agent manually with event collection ─────

        try:
            # Step 1: Risk Agent
            state = await risk_node(state, events)

            # Emit events collected so far
            for evt in events:
                yield f"data: {json.dumps(evt)}\n\n"
            events.clear()

            # Step 2: Check routing — LOW risk skips SOP & Notify
            if state["risk_level"] == "LOW":
                events.append(make_event("orchestrator", 8000, "routing",
                    "Risk is LOW. Skipping SOP and Notification agents."))
                events.append(make_event("sop", 8002, "skipped",
                    "Skipped — LOW risk does not require SOP activation"))
                events.append(make_event("notify", 8003, "skipped",
                    "Skipped — LOW risk does not require alert generation"))

                for evt in events:
                    yield f"data: {json.dumps(evt)}\n\n"
                events.clear()
            else:
                # Step 2: SOP Agent
                state = await sop_node(state, events)

                for evt in events:
                    yield f"data: {json.dumps(evt)}\n\n"
                events.clear()

                # Step 3: Notification Agent
                state = await notify_node(state, events)

                for evt in events:
                    yield f"data: {json.dumps(evt)}\n\n"
                events.clear()

            # ───── Final summary event ─────
            total_elapsed = (datetime.now() - workflow_start).total_seconds()
            agents_used = 3 if state.get("risk_level") != "LOW" else 1
            http_calls = agents_used

            summary_event = make_event("orchestrator", 8000, "complete",
                f"Workflow complete: {agents_used + 1} agents | {http_calls} HTTP calls | {total_elapsed:.2f}s total",
                {"total_elapsed": round(total_elapsed, 2), "agents_used": agents_used + 1, "http_calls": http_calls})
            yield f"data: {json.dumps(summary_event)}\n\n"

            # ───── Final result event ─────
            result_data = flatten_result(state)
            yield f"data: {json.dumps({'type': 'result', 'data': result_data})}\n\n"

        except Exception as e:
            error_event = make_event("orchestrator", 8000, "error",
                f"Workflow failed: {str(e)}")
            yield f"data: {json.dumps(error_event)}\n\n"

        # Signal end of stream
        yield f"data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )