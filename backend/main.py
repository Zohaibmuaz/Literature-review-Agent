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

app = FastAPI(title="AI PhD Research Automation API", lifespan=lifespan)

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
    author: str = "AI PhD Research Agent"
    institution: str = "Department of Advanced AI Research"

# In-memory history of generated papers
paper_history = []

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI PhD Research Automation API"}

@app.get("/history")
def get_history():
    return {"history": paper_history}

@app.post("/generate-review")
def generate_review(request: ResearchRequest):
    print(f"\n[API] Received request to generate review for topic: '{request.topic}'")
    
    # Set the initial state
    initial_state: ResearchState = {
        "research_topic": request.topic,
        "author": request.author,
        "institution": request.institution,
        "paper_list": [],
        "final_draft": None
    }
    
    # Execute the LangGraph workflow
    result = research_graph.invoke(initial_state)
    final_review = result.get("final_draft")
    
    # Save to history
    paper_history.insert(0, {
        "topic": request.topic,
        "author": request.author,
        "institution": request.institution,
        "review": final_review
    })
    
    return {
        "topic": request.topic,
        "review": final_review
    }
