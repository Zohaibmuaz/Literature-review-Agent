**1. Project Vision**
The AI PhD Research Automation system is a multi-agent AI copilot designed to automate the exhaustive literature review process for researchers. It operates on a decoupled architecture, ensuring full ownership and scalability.

**2. System Architecture (Decoupled)**
- **Frontend (Client):** Built with Next.js and Tailwind CSS, providing a polished UI for users to input topics and view generated reviews.
- **Backend (API):** A Python-based FastAPI server hosting the LangGraph multi-agent workflow. 
- **Agents:** 
  - Search Agent: Queries ArXiv & Semantic Scholar APIs.
  - Reader Agent: Chunks text and generates vector embeddings.
  - Writer Agent: Uses RAG to draft the final citation-heavy review.

**3. Technology Stack**
- **Frontend:** Next.js, React, Tailwind CSS
- **Backend Orchestration:** Python, FastAPI, LangGraph
- **LLM Provider:** OpenRouter
- **Vector Database:** Qdrant Cloud
- **Project Scaffolding:** Antigravity CLI

**4. Deployment Strategy**
- **Frontend Host:** Vercel (Custom domain, fast edge delivery).
- **Backend Host:** Render (Web Service for long-running Python/FastAPI processes).
- **Database:** Qdrant Cloud (Free tier).