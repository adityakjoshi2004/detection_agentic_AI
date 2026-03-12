# Project Documentation: A2A Security System

## Overview
The A2A Security System (CCTV Live Detection) is a multi-agent backend architecture designed to process live security detections (e.g., weapons), assess the risk level, retrieve standard operating procedures (SOPs), and notify relevant personnel.

## Architecture
The system consists of the following microservice agents, built using FastAPI, LangChain, LangGraph, and Google Gemini:

1. **Personal Agent (Orchestrator - Port 8000)**
   - Acts as the central orchestrator using `LangGraph`.
   - Receives the initial `DetectionRequest` containing details like weapons detected, location, timestamp, and an optional base64 encoded image (`scene_image_b64`).
   - Routes the request sequentially through the other agents based on the assessed risk level.
   - Includes a real-time SSE endpoint (`/analyze_stream`) to stream live workflow execution events to the frontend.

2. **Risk Agent (Port 8001)**
   - Performs risk assessment based on detection confidence scores.
   - Classifies risk into `LOW`, `MEDIUM`, or `HIGH`.
   - Utilizes `gemini-2.5-flash`'s multimodal vision capabilities to analyze the scene image (if provided) alongside the detection data.
   - Generates natural language reasoning for the assigned risk level, incorporating visual observations of the threat context.
   
3. **SOP Agent (Port 8002)**
   - Employs an AI-first approach, supplementing Retrieval-Augmented Generation (RAG) (using `Chroma` vector store and `gemini-2.5-flash`).
   - Uses retrieved company emergency protocols as a starting point.
   - Expands the response beyond standard limits using its security expertise, adding immediate actions, communication chains, estimated response times, and AI-recommended steps.

4. **Notification Agent (Port 8003)**
   - Functions as an expert emergency communication AI using `gemini-2.5-flash`.
   - Receives the final consolidated incident data (incident ID, risk level, location, and structured SOPs).
   - Generates comprehensive, targeted notification content: a broad alert message, recipient-specific SMS templates, relevant emergency helplines, escalation triggers, and a notification priority list.

## Detailed End-to-End Detection Flow

The system operates in a multi-stage pipeline, beginning with raw optical input on the frontend and concluding with AI-generated security alerts.

### Phase 1: Image / Video Processing (Frontend to Backend)
1. **Input Submission**: A user uploads an image or video to the React frontend (`ImageDetection.jsx` or `VideoDetection.jsx`).
2. **Preprocessing API**: The frontend sends the media to the FastAPI detection backend (`app/routes/`) running on port 8004.
   - For **Images**: The script generates multiple transformed frames to aid human analysts (resized, grayscale, gaussian blur, edge detection maps).
   - For **Videos**: The script extracts frames sequentially via OpenCV.

### Phase 2: YOLOv8 Inference (`best.pt`)
1. **Model Loading**: The backend loads the custom-trained YOLOv8 weights file (`best.pt`) via the `ultralytics` library.
2. **Bounding Box Generation**: Each frame is passed into `best.pt`. The model identifies items matching its training classes (e.g., guns, knives) and maps bounding boxes alongside a confidence score (0.0 to 1.0).
3. **Thresholding**: The `core/detector.py` script filters out false positives by imposing a confidence threshold (e.g., `confidence > 0.25`).
4. **Annotation**: OpenCV draws the bounding boxes and confidence labels directly onto the frame, generating an `annotated` image/video.
5. **Data Extraction**: The highest confidence scores for each weapon class are aggregated into a JSON dictionary (e.g., `{"gun": 0.95}`).

### Phase 3: AI Agent Orchestration (LangGraph)
Once the YOLO model confirms a threat, the frontend takes the structured detection payload (weapons, location, timestamp, and an encoded scene image) and initiates a Server-Sent Events (SSE) stream request to the **Orchestrator Agent** (Port 8000).

1. **Risk Node**: The orchestrator routes the payload to the Risk Agent. The Risk Agent deterministically tags the risk (High/Medium/Low) based on YOLO confidence scores. Concurrently, it feeds the annotated scene image into Gemini 2.5 Flash's Vision model to generate a natural language explanation of the context (proxemics, body language, scene layout).
2. **Conditional Routing**: LangGraph evaluates the risk level. If `LOW`, the workflow terminates immediately. If `MEDIUM` or `HIGH`, it proceeds to the SOP node.
3. **SOP Node**: The Orchestrator forwards to the SOP Agent. The agent queries the Chroma vector database to find the baseline company procedures. Gemini uses these as a starting point and outputs an expanded, structured JSON of immediate actions, communication chains, and AI-recommended actions.
4. **Notify Node**: The Orchestrator feeds the combined incident details and SOPs into the Notification Agent. Gemini generates broadcast-ready alerts, role-specific SMS templates, prioritization chains, and relevant emergency helplines.

### Phase 4: Frontend Delivery
As LangGraph executes, it yields intermediate `processing` and `done` events back to the frontend via the SSE stream, creating a live Chain-of-Thought UI. Once the graph is fully resolved, a flattened JSON package is returned, populating the final "Incident Report" dashboard.

## Orchestrator Core Logic
- The **Orchestrator** receives the detection event and coordinates the LangGraph workflow.
- If the **Risk Agent** determines the risk level is `LOW`, the orchestrator immediately terminates the workflow (preventing unnecessary SOP retrieval or notifications).
- If the risk level is `MEDIUM` or `HIGH`, the workflow proceeds to the **SOP Agent** to formulate dynamic mitigation actions, and then to the **Notification Agent** to generate the alert package.
- The Orchestrator aggregates all AI insights and returns them in a structured response to the caller.

## Technology Stack
- **Frameworks:** FastAPI, LangChain, LangGraph
- **AI/LLM:** Google Generative AI (gemini-2.5-flash) with Multimodal Vision Support
- **Vector Database:** Chroma
- **Embeddings:** HuggingFace (`sentence-transformers/all-MiniLM-L6-v2`)
