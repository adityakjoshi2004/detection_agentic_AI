import os
import json
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI


env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()


# ── Embeddings for RAG retrieval ──────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


# ── Load & chunk SOP documents into ChromaDB ─────────────────────────────
DOCS_PATH = Path(__file__).parent / "sop_docs"
loader = TextLoader(str(DOCS_PATH / "emergency_protocols.txt"))
documents = loader.load()

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=50
)

docs = text_splitter.split_documents(documents)

CHROMA_DIR = str(Path(__file__).parent / "chroma_db")

vectorstore = Chroma.from_documents(
    documents=docs,
    embedding=embeddings,
    persist_directory=CHROMA_DIR
)

retriever = vectorstore.as_retriever()


# ── Gemini LLM ───────────────────────────────────────────────────────────
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.25
)


class SOPRequest(BaseModel):
    risk_level: str
    location: str
    incident_id: str


@app.post("/retrieve_sop")
async def retrieve_sop(request: SOPRequest):

    # Step 1: RAG retrieval — get relevant SOP chunks from the vector store
    query = f"Emergency protocol for {request.risk_level} risk level at {request.location}."
    relevant_docs = retriever.invoke(query)
    retrieved_context = "\n".join([doc.page_content for doc in relevant_docs])

    # Step 2: AI-first prompt — SOP chunks are reference, Gemini adds its expertise
    prompt = f"""
You are an expert corporate security AI advisor with deep knowledge of
emergency response, incident management, threat mitigation, and standard
operating procedures used by security operations centers worldwide.

─── INCIDENT DETAILS ───
• Incident ID : {request.incident_id}
• Risk Level  : {request.risk_level}
• Location    : {request.location}

─── COMPANY SOP REFERENCE (retrieved from internal documents) ───
The following are relevant excerpts from the company's own SOP documents.
Use these as a STARTING POINT and reference — pick the relevant pointers
from them, but DO NOT limit your response to only these points:

{retrieved_context}

─── YOUR TASK ───
1. Read the company SOP excerpts above and extract the relevant action items.
2. Now USE YOUR OWN EXPERTISE as a security AI to EXPAND and ENHANCE the
   response significantly. Think beyond the document and add:
   • Additional critical steps that the SOP document may have missed
   • Situation-specific actions based on the risk level and location
   • Communication chain (who to notify and in what order)
   • Evidence preservation steps (CCTV footage, access logs, physical evidence)
   • Evacuation or lockdown decisions based on severity
   • Coordination with law enforcement or emergency services
   • De-escalation strategies if applicable
   • Post-incident documentation and follow-up actions
   • Protection of critical assets and personnel safety
3. Tailor your response to the SPECIFIC risk level:
   - LOW    : monitoring, logging, routine checks, awareness alert
   - MEDIUM : heightened alertness, partial lockdown, supervisor notification
   - HIGH   : full emergency protocol, law enforcement, evacuation
   - CRITICAL: all-hands response, executive notification, media handling
4. Be practical and actionable — give steps that a security team can
   immediately execute on the ground.
5. Clearly distinguish which steps came from the company SOP and which
   are your additional expert recommendations.

Return ONLY valid JSON in this exact format:
{{
  "incident_id": "{request.incident_id}",
  "risk_level": "{request.risk_level}",
  "location": "{request.location}",
  "sop_steps": [
    "Step 1: <action from company SOP>",
    "Step 2: <action from company SOP>"
  ],
  "ai_recommended_steps": [
    "Step 1: <additional expert action not in SOP>",
    "Step 2: <additional expert action not in SOP>"
  ],
  "immediate_actions": [
    "Action that must happen within first 60 seconds"
  ],
  "communication_chain": [
    "First notify: ...",
    "Then notify: ..."
  ],
  "estimated_response_time": "<e.g. 1 minutes for HIGH>",
  "justification": "<explain your reasoning — which SOP points you used, what extra measures you added and why>"
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
        return parsed
    except Exception:
        return {
            "error": "Failed to parse SOP response",
            "raw_response": raw_text
        }