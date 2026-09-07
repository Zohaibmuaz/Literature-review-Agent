import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(usecwd=True))

from langchain_openai import ChatOpenAI
from agent.nodes import generate_section, apply_citations

def run_test():
    llm = ChatOpenAI(
        model="google/gemini-2.5-flash",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base="https://openrouter.ai/api/v1"
    )
    
    topic = "Quantum Computing Applications"
    author = "AI PhD Research Automation"
    institution = "Test Lab"
    
    dummy_papers = [
        {"cite_key": "[paper_0]", "title": "Quantum Simulation Advancements", "authors": "Smith, J. et al.", "year": "2023", "url": "http://arxiv/1", "source": "arxiv"},
        {"cite_key": "[paper_1]", "title": "Error Correction in NISQ", "authors": "Doe, J. & Lee, A.", "year": "2024", "url": "http://arxiv/2", "source": "arxiv"}
    ]
    
    context = "Citation Tag: [paper_0]\nFindings: Smith discovered new simulation methods.\n\nCitation Tag: [paper_1]\nFindings: Doe proposed error correction techniques."

    print("\n====================================")
    print("TESTING IEEE FORMATTING (Sequential)")
    print("====================================")
    ieee_section = generate_section("Header & Abstract", topic, context, llm, author, institution)
    # Simulate a second section to prove sequential ordering
    ieee_intro = generate_section("Introduction", topic, context, llm, author, institution)
    
    ieee_draft = apply_citations({"Header & Abstract": ieee_section, "Introduction": ieee_intro}, dummy_papers, citation_style="IEEE")
    print("\n" + ieee_draft)

if __name__ == "__main__":
    run_test()
