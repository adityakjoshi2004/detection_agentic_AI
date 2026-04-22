# Workflow Documentation: A2A Security System

## 1. Input & Preprocessing Phase (Frontend -> Backend)
A security operator uploads an image or video via the React frontend (`ImageDetection.jsx` or `VideoDetection.jsx`). 
The media is sent via a `POST` request to the FastAPI detection backend on **port 8004** (`/api/` for images, `/api/video` for videos).

- **For Images**: The backend uses OpenCV to generate multiple versions of the frame (original, resized 640x640, grayscale, gaussian blur, and edge detection) to provide visual context for human operators.
- **For Videos**: The backend extracts frames sequentially using OpenCV (`cv2.VideoCapture`).

## 2. YOLOv8 Inference Phase (`best.pt`)
Each processed frame is passed to the custom-trained YOLOv8 model loaded from `best.pt` (`core/detector.py`).
- The model analyzes the frame and returns bounding boxes and confidence scores for learned classes (e.g., guns, knives).
- A confidence threshold filters out false positives (e.g., `confidence > 0.25`).
- Valid detections are drawn onto the frame using OpenCV (the `annotated` frame).
- The highest confidence scores for each detected weapon class are aggregated.

**Aggregated Detection Payload Example:**
```json
{
  "weapons_detected": {"gun": 0.95},
  "location": "North Entrance",
  "timestamp": "2026-03-06T15:00:00Z",
  "scene_image_b64": "<base64_encoded_string_optional>"
}
```
This payload is then sent to the **Personal Agent (Orchestrator)** on port 8000 via a `POST /analyze_stream` request to initiate the AI analysis.

## 3. Risk Assessment Phase (`risk_node`)
The Orchestrator forwards this data to the **Risk Agent** on port 8001 via `POST /assess_risk`.
- The Risk Agent determines the highest confidence score among the detected items.
- If confidence > 0.8: `HIGH` risk.
- If confidence > 0.5: `MEDIUM` risk.
- Otherwise: `LOW` risk.
- Using `gemma-3-4b-it`'s vision capabilities, the model analyzes the detection data and the actual scene image (if provided) to describe the threat context, scene layout, and proxemics.
- The Risk Agent returns an `incident_id`, the `risk_level`, and a detailed `risk_reasoning`.

## 3. Workflow Routing (`risk_router`)
Once the Risk Agent responds, the LangGraph `risk_router` evaluates the `risk_level`:
- **If `LOW` risk:** The workflow immediately concludes (`END`), preventing unnecessary panic or processing.
- **If `MEDIUM` or `HIGH` risk:** The workflow transitions to the SOP processing node (`sop_node`).

## 4. SOP Retrieval Phase (`sop_node`)
For non-low risks, the Orchestrator sends the incident details (incident ID, risk level, location) to the **SOP Agent** on port 8002 via `POST /retrieve_sop`.
- The SOP Agent forms a query: `"Emergency protocol for {risk_level} risk level at {location}."`
- The query searches the Chroma vector database to find the most relevant emergency protocols (loaded from `sop_docs/emergency_protocols.txt`).
- Using an AI-first prompt with Gemini, the agent uses the retrieved protocols purely as a baseline and significantly expands them using its own security expertise.
- It returns structured JSON including `sop_steps`, `ai_recommended_steps`, `immediate_actions`, `communication_chain`, and an `estimated_response_time`.

## 5. Notification Phase (`notify_node`)
After obtaining the SOPs, the Orchestrator moves to the `notify_node`.
- It sends the final package (incident details + all SOP structures) to the **Notification Agent** on port 8003 via `POST /notify`.
- The Notification Agent compiles a tailored alert message, specific SMS templates (team, management, occupants), emergency helpline numbers, and a notification priority list.
- The agent prints these details to the terminal/logs and returns the structured data back to the Orchestrator.

## 6. Workflow Conclusion
The Orchestrator receives the final algorithmic response from the Notification node, compiles the complete `state` of the incident timeline, and returns the aggregated rich data to the originating external system. For streaming requests (`/analyze_stream`), the SSE stream emits chronological events (`routing`, `processing`, `done`) and concludes with the final payload.

## 7. Operational Environment and Technical Nuances
Because the system operates in a decentralized microservice pattern, each AI agent operates as an isolated execution thread running on standalone ports.
- **Virtual Environments:** Python virtual environments (`venv`) establish boundaries so dependency requirements such as `sentence-transformers` (for the SOP Retrieval Phase Chroma embeddings), `google-generativeai` (for the LLM reasoning payload), and the native LangGraph orchestrator frameworks function without interference.
- **Static Assets Requirement:** A prerequisite for Phase 1 processing is an accessible `outputs` directory. The FastAPI instance automatically mounts this via `StaticFiles` rendering, enabling the frontend to properly retrieve locally generated annotated threat visualizations.
