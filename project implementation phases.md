✅ **Phase 1: Environment & Repository Setup** (Completed)
- Initialize a monorepo structure with two folders: `/frontend` (Next.js) and `/backend` (Python).
- Use Antigravity CLI for scaffolding.
- Set up `.env` for OpenRouter and Qdrant API keys.

✅ **Phase 2: Backend - FastAPI & LangGraph Foundation** (Completed)
- Create a FastAPI app instance.
- Define LangGraph `TypedDict` state (`research_topic`, `paper_list`, `final_draft`).
- Build the **Search Node** to fetch metadata from ArXiv and Semantic Scholar.

✅ **Phase 3: Backend - Reader & Writer Agents** (Completed)
- Initialize Qdrant client.
- Build the **Reader Node** to chunk abstracts, generate embeddings, and upsert to Qdrant with metadata.
- Build the **Writer Node** to perform vector search and call OpenRouter LLM to draft the literature review.
- *Upgrade:* Implemented Advanced PhD-level Academic Paper Generation (fetching 20+ recent papers, strict APA citations, structural analysis, and research gap identification).

✅ **Phase 4: Backend - Workflow Compilation & API Endpoint** (Completed)
- Tie nodes together: `START -> Search -> Reader -> Writer -> END`.
- Expose the compiled LangGraph workflow through a FastAPI `POST /generate-review` endpoint.

**Phase 5: Frontend - Next.js Setup**
- Initialize Next.js project with Tailwind CSS.
- Build a clean dashboard UI with an input form and a markdown rendering area for the final output.

**Phase 6: Integration & Deployment**
- Connect Next.js frontend to the FastAPI endpoint using `fetch` or Axios.
- Deploy the `/backend` to Render as a Web Service.
- Deploy the `/frontend` to Vercel and link the Render API URL.