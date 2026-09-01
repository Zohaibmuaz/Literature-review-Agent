import os
from dotenv import load_dotenv

# Load env variables before importing nodes
load_dotenv()

from agent.state import ResearchState
from agent.qdrant_db import init_qdrant
from agent.nodes import search_node, reader_node, writer_node

def test_phase3():
    # 1. Initialize Qdrant (creates collection)
    print("Initializing Qdrant Database...")
    init_qdrant()
    
    # 2. Setup State
    state: ResearchState = {
        "research_topic": "quantum computing applications",
        "paper_list": [],
        "final_draft": None
    }
    
    # 3. Run nodes sequentially for testing
    state.update(search_node(state))
    state.update(reader_node(state))
    state.update(writer_node(state))
    
    print("\n--- FINAL DRAFT ---")
    print(state.get("final_draft"))

if __name__ == "__main__":
    test_phase3()
