# Project Documentation: A2A Security System

## Overview
The A2A Security System (CCTV Live Detection) is a multi-agent backend architecture designed to process live security detections (e.g., weapons), assess the risk level, retrieve standard operating procedures (SOPs), and notify relevant personnel.

## Architecture
The system consists of the following microservice agents, built using FastAPI, LangChain, LangGraph, and Google Gemini:

1. **Personal Agent (Orchestrator - Port 8000)**
   - Acts as the central orchestrator using `LangGraph`.
   - Receives the initial `DetectionRequest` containing details like weapons detected, location, and timestamp.
   - Routes the request sequentially through the other agents based on the assessed risk level.

2. **Risk Agent (Port 8001)**
   - Performs risk assessment based on detection confidence scores.
   - Classifies risk into `LOW`, `MEDIUM`, or `HIGH`.
   - Utilizes `gemini-2.5-flash` to generate a natural language reasoning for the assigned risk level.
   
3. **SOP Agent (Port 8002)**
   - Uses Retrieval-Augmented Generation (RAG) with `Chroma` vector store and `gemini-2.5-flash`.
   - Retrieves the appropriate company emergency protocols based on the risk level.
   - Generates a structured list of actionable SOP steps and their justification.

4. **Notification Agent (Port 8003)**
   - Receives the final consolidated alert including incident ID, risk level, location, and SOP steps.
   - Responsible for logging or sending out the security alert to the appropriate personnel.

## Core Flow
- If the **Risk Agent** determines the risk level is `LOW`, the orchestrator immediately terminates the workflow without triggering an SOP retrieval or notification.
- If the risk level is `MEDIUM` or `HIGH`, the workflow proceeds to the **SOP Agent** to gather actions, and then to the **Notification Agent** to issue the alert.

## Technology Stack
- **Frameworks:** FastAPI, LangChain, LangGraph
- **AI/LLM:** Google Generative AI (gemini-2.5-flash)
- **Vector Database:** Chroma
- **Embeddings:** HuggingFace (`sentence-transformers/all-MiniLM-L6-v2`)
