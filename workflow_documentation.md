# Workflow Documentation: A2A Security System

## 1. Detection Phase
A security camera or external service detects a potential threat (e.g., a weapon). The external system sends a `POST /analyze` request to the **Personal Agent (Orchestrator)** on port 8000.

**Request Payload Example:**
```json
{
  "weapons_detected": {"gun": 0.95},
  "location": "North Entrance",
  "timestamp": "2026-03-06T15:00:00Z"
}
```

## 2. Risk Assessment Phase (`risk_node`)
The Orchestrator forwards this data to the **Risk Agent** on port 8001 via `POST /assess_risk`.
- The Risk Agent determines the highest confidence score among the detected items.
- If confidence > 0.8: `HIGH` risk.
- If confidence > 0.5: `MEDIUM` risk.
- Otherwise: `LOW` risk.
- The Gemini model generates a simple JSON explanation for the decision.
- The Risk Agent returns an `incident_id`, the `risk_level`, and the `risk_reasoning`.

## 3. Workflow Routing (`risk_router`)
Once the Risk Agent responds, the LangGraph `risk_router` evaluates the `risk_level`:
- **If `LOW` risk:** The workflow immediately concludes (`END`), preventing unnecessary panic or processing.
- **If `MEDIUM` or `HIGH` risk:** The workflow transitions to the SOP processing node (`sop_node`).

## 4. SOP Retrieval Phase (`sop_node`)
For non-low risks, the Orchestrator sends the incident details (incident ID, risk level, location) to the **SOP Agent** on port 8002 via `POST /retrieve_sop`.
- The SOP Agent forms a query: `"Emergency protocol for {risk_level} risk level."`
- The query searches the Chroma vector database to find the most relevant emergency protocols (loaded from `sop_docs/emergency_protocols.txt`).
- Using Gemini, the SOP agent structures the relevant protocols into practical, actionable steps (`sop_steps`) and provides a `justification` for these steps.

## 5. Notification Phase (`notify_node`)
After obtaining the SOPs, the Orchestrator moves to the `notify_node`.
- It sends the final package (incident ID, risk level, location, and SOP steps) to the **Notification Agent** on port 8003 via `POST /notify`.
- The Notification Agent compiles a complete alert message and prints it to the terminal/logs.
- The agent returns a success status back to the Orchestrator.

## 6. Workflow Conclusion
The Orchestrator receives the final response from the Notification node, compiles the complete `state` of the incident timeline, and returns the aggregated data to the originating external system that made the `POST /analyze` call.
