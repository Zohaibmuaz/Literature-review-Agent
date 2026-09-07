from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv, find_dotenv

# Load environment variables FIRST, before importing any agents that rely on them
load_dotenv(find_dotenv(usecwd=True))
load_dotenv("../.env") # Fallback to parent dir just in case

# Import the DB initialization and compiled LangGraph workflow
from agent.qdrant_db import init_qdrant
from agent.graph import research_graph
from agent.state import ResearchState

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- STARTING UP: Initializing Qdrant DB ---")
    init_qdrant()
    yield
    print("--- SHUTTING DOWN ---")

app = FastAPI(title="LitReviewer AI API", lifespan=lifespan)

# Allow CORS so Next.js can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ResearchRequest(BaseModel):
    topic: str
    author: str = "LitReviewer AI"
    institution: str = "Department of Advanced AI Research"
    citation_style: str = "APA"  # Default to APA
    mode: str = "full"  # "full" or "preview"

# In-memory history of generated papers
paper_history = []

@app.get("/")
def read_root():
    return {"message": "Welcome to the LitReviewer AI API"}

@app.get("/history")
def get_history():
    return {"history": paper_history}

from fastapi.responses import StreamingResponse
import queue
import threading
import json

@app.post("/generate-review")
def generate_review(request: ResearchRequest):
    print(f"\n[API] Received request to generate review for topic: '{request.topic}', style: '{request.citation_style}'")
    
    # Set the initial state
    initial_state: ResearchState = {
        "research_topic": request.topic,
        "author": request.author,
        "institution": request.institution,
        "paper_list": [],
        "final_draft": None,
        "citation_style": request.citation_style,
        "ui_queue": None,
        "mode": request.mode
    }
    
    # Execute the LangGraph workflow
    result = research_graph.invoke(initial_state)
    final_review = result.get("final_draft")
    
    # Save to history silently (bounded)
    paper_history.insert(0, {
        "topic": request.topic,
        "author": request.author,
        "institution": request.institution,
        "review": final_review
    })
    if len(paper_history) > 20:
        paper_history.pop()
    
    return {
        "topic": request.topic,
        "review": final_review
    }

@app.post("/stream-review")
async def stream_review(request: ResearchRequest, req: getattr(__import__('fastapi'), 'Request')):
    print(f"\n[API] Received STREAM request for topic: '{request.topic}'")
    q = queue.Queue(maxsize=10)
    
    # Custom queue wrapper to kill the background thread if the client disconnects
    class StopExecution(Exception): pass
    
    class SafeQueue:
        def __init__(self, q):
            self.q = q
            self.stop = False
            
        def put(self, item):
            if self.stop:
                raise StopExecution("Client disconnected. Halting AI generation to save credits.")
            try:
                # If the queue is full for 15 seconds, it means the client stopped reading
                self.q.put(item, timeout=15)
            except queue.Full:
                self.stop = True
                raise StopExecution("Client disconnected. Halting AI generation to save credits.")
                
    safe_q = SafeQueue(q)

    def run_graph():
        initial_state: ResearchState = {
            "research_topic": request.topic,
            "author": request.author,
            "institution": request.institution,
            "paper_list": [],
            "final_draft": None,
            "citation_style": request.citation_style,
            "ui_queue": safe_q,
            "mode": request.mode
        }
        try:
            result = research_graph.invoke(initial_state)
            safe_q.put({"type": "done", "review": result.get("final_draft"), "mode": request.mode})
            
            # Save to history silently (bounded)
            paper_history.insert(0, {
                "topic": request.topic,
                "author": request.author,
                "institution": request.institution,
                "review": result.get("final_draft"),
                "mode": request.mode
            })
            if len(paper_history) > 20:
                paper_history.pop()
        except StopExecution as e:
            print(f"--- THREAD KILLED: {e} ---")
        except Exception as e:
            try: safe_q.put({"type": "error", "message": str(e)})
            except: pass
            
    threading.Thread(target=run_graph, daemon=True).start()
    
    async def event_stream():
        import asyncio
        try:
            while True:
                try:
                    # Non-blocking get with short sleep for asyncio context switch
                    msg = q.get_nowait()
                    yield f"data: {json.dumps(msg)}\n\n"
                    if msg["type"] in ["done", "error"]:
                        break
                except queue.Empty:
                    # Send a valid JSON keep-alive ping. 
                    # This prevents browser timeouts and safely tests for disconnects.
                    ping_msg = {"type": "ping"}
                    yield f"data: {json.dumps(ping_msg)}\n\n"
                    await asyncio.sleep(1.0)
                    
        except Exception as e:
            safe_q.stop = True
                
    return StreamingResponse(event_stream(), media_type="text/event-stream")

