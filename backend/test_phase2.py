from agent.state import ResearchState
from agent.nodes import search_node

def test_search():
    initial_state: ResearchState = {
        "research_topic": "quantum computing applications",
        "paper_list": [],
        "final_draft": None
    }
    
    result = search_node(initial_state)
    
    print("\nSearch Node Results:")
    for i, paper in enumerate(result.get("paper_list", [])):
        print(f"\n[{i+1}] Source: {paper['source']}")
        print(f"Title: {paper['title']}")
        print(f"URL: {paper['url']}")
        print(f"Abstract Snippet: {paper['abstract'][:100]}...")

if __name__ == "__main__":
    test_search()
