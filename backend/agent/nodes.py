import os
import uuid
import requests
import xml.etree.ElementTree as ET
from typing import Dict, Any

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from qdrant_client.models import PointStruct
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from .state import ResearchState
from .qdrant_db import qdrant_client, COLLECTION_NAME

# Initialize the embedding model via Free Cloud API to save RAM
embedding_model = HuggingFaceEndpointEmbeddings(
    model="BAAI/bge-small-en-v1.5",
    huggingfacehub_api_token=os.getenv("HF_TOKEN")
)

def fetch_arxiv(query: str, max_results: int = 10) -> list:
    # Use OR logic but sort by RELEVANCE to ensure we don't get 0 results for long queries
    arxiv_query = query.replace(" ", "+")
    url = f"http://export.arxiv.org/api/query?search_query=all:{arxiv_query}&start=0&max_results={max_results}&sortBy=relevance&sortOrder=descending"
    response = requests.get(url)
    papers = []
    
    if response.status_code == 200:
        root = ET.fromstring(response.text)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns).text.strip() if entry.find('atom:title', ns) is not None else ""
            summary = entry.find('atom:summary', ns).text.strip() if entry.find('atom:summary', ns) is not None else ""
            link = entry.find('atom:id', ns).text.strip() if entry.find('atom:id', ns) is not None else ""
            
            # Extract Year
            published = entry.find('atom:published', ns)
            year = published.text[:4] if (published is not None and published.text) else "n.d."
            
            # Extract Authors for Citations securely
            authors_elements = entry.findall('atom:author', ns)
            author_names = [a.find('atom:name', ns).text for a in authors_elements if a.find('atom:name', ns) is not None]
            
            # Clean author names to prevent "None"
            author_names = [n for n in author_names if n]
            
            if not author_names:
                author_str = "Unknown"
            elif len(author_names) == 1:
                author_str = author_names[0]
            elif len(author_names) == 2:
                author_str = f"{author_names[0]} & {author_names[1]}"
            else:
                first_name = author_names[0]
                first_author_last = first_name.split()[-1]
                author_str = f"{first_author_last} et al."
            
            papers.append({
                "source": "arxiv",
                "title": title,
                "abstract": summary,
                "url": link,
                "year": year,
                "authors": author_str
            })
            
    return papers

def fetch_semantic_scholar(query: str, max_results: int = 10) -> list:
    # Use year=2020- parameter to ensure we only fetch modern papers from the last few years
    # Semantic Scholar uses spaces for intelligent keyword matching by default
    query_encoded = query.replace(" ", "+")
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query_encoded}&limit={max_results}&fields=title,abstract,url,year,authors&year=2020-"
    response = requests.get(url)
    papers = []
    
    if response.status_code == 200:
        data = response.json()
        for item in data.get('data', []):
            if item.get('abstract'):
                # Extract Authors for Citations securely
                authors_list = item.get('authors')
                
                # Robust extraction to avoid "None"
                valid_authors = []
                if authors_list:
                    valid_authors = [a.get('name') for a in authors_list if a.get('name')]
                
                if not valid_authors:
                    author_str = "Unknown"
                elif len(valid_authors) == 1:
                    author_str = valid_authors[0]
                elif len(valid_authors) == 2:
                    author_str = f"{valid_authors[0]} & {valid_authors[1]}"
                else:
                    first_author_last = valid_authors[0].split()[-1]
                    author_str = f"{first_author_last} et al."
                
                # Fix year None
                raw_year = item.get('year')
                final_year = str(raw_year) if raw_year is not None else "n.d."
                
                papers.append({
                    "source": "semantic_scholar",
                    "title": item.get('title') or "",
                    "abstract": item.get('abstract') or "",
                    "url": item.get('url') or "",
                    "year": final_year,
                    "authors": author_str
                })
                
    return papers

def search_node(state: ResearchState) -> Dict[str, Any]:
    topic = state.get("research_topic", "")
    print(f"--- SEARCHING FOR RECENT PAPERS: {topic} ---")
    
    arxiv_papers = fetch_arxiv(topic, max_results=10)
    semantic_papers = fetch_semantic_scholar(topic, max_results=10)
    
    combined_papers = arxiv_papers + semantic_papers
    print(f"--- FOUND {len(combined_papers)} RECENT PAPERS ---")
    
    return {"paper_list": combined_papers}

def reader_node(state: ResearchState) -> Dict[str, Any]:
    print("--- READER NODE: Chunking and Embedding ---")
    paper_list = state.get("paper_list", [])
    
    docs = []
    metadata = []
    ids = []
    
    for paper in paper_list:
        docs.append(f"Title: {paper['title']}\nAuthors: {paper['authors']}\nYear: {paper['year']}\nAbstract: {paper['abstract']}")
        metadata.append({
            "source": paper["source"], 
            "title": paper["title"], 
            "url": paper["url"],
            "year": paper["year"],
            "authors": paper["authors"],
            "query_topic": state.get("research_topic", "")
        })
        ids.append(str(uuid.uuid4()))
        
    if docs:
        print(f"Generating embeddings for {len(docs)} documents...")
        embeddings = embedding_model.embed_documents(docs)
        
        points = [
            PointStruct(
                id=id_, 
                vector=vector, 
                payload={"document": doc, **meta}
            )
            for id_, vector, doc, meta in zip(ids, embeddings, docs, metadata)
        ]
        
        print(f"Upserting {len(docs)} documents to Qdrant...")
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
    return {}

from qdrant_client.http import models

def writer_node(state: ResearchState) -> Dict[str, Any]:
    print("--- WRITER NODE: Drafting Academic Review ---")
    topic = state.get("research_topic", "")
    user_author = state.get("author", "AI PhD Research Automation")
    user_institution = state.get("institution", "Department of Advanced AI Research")
    
    print("Querying Qdrant for relevant context...")
    # Embed the query
    query_vector = embedding_model.embed_query(topic)
    
    # Retrieve top 15 most relevant chunks EXCLUSIVELY for this topic
    search_result = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="query_topic",
                    match=models.MatchValue(value=topic)
                )
            ]
        ),
        limit=15
    )
    
    context = ""
    for hit in search_result.points:
        meta = hit.payload
        context += f"Paper: {meta.get('title')}\nAuthors: {meta.get('authors')} ({meta.get('year')})\nURL: {meta.get('url')}\nAbstract: {meta.get('document')}\n\n"
        
    print("Calling OpenRouter LLM with PhD Persona...")
    llm = ChatOpenAI(
        model="google/gemini-2.5-flash",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base="https://openrouter.ai/api/v1"
    )
    
    prompt = f"""You are a world-class PhD researcher and academic writer. 
Write a highly standard, comprehensive, and authentic Review Paper on the topic: '{topic}'.

You must use the provided context (which contains modern, recently published papers) to write the review.
Follow the exact structure and standards of a top-tier peer-reviewed journal.

CRITICAL INSTRUCTIONS FOR DEPTH AND RELEVANCE:
- EXTREME TOPIC FOCUS: Focus ONLY on the field of the requested topic. If the topic is Biology, DO NOT insert concepts from Computer Science, AI, or Quantum Physics unless the topic explicitly asks for it.
- NO FORCED ANALOGIES: If a paper in the context is completely irrelevant to the main topic, completely IGNORE IT. Do not force irrelevant papers into the review using weird metaphors or stretched analogies.
- HANDLE IRRELEVANT CONTEXT: If ALL provided papers are completely irrelevant to the topic '{topic}', DO NOT write a fake review. Instead, exactly output this single sentence and nothing else: "The retrieved research papers do not match the requested topic. Please refine your search query."
- AVOID shallow, general summaries. You MUST include extreme technical depth, specific metrics, datasets, clinical trial names (if present in context), and exact methodologies.
- If the topic bridges two fields (e.g., AI and Biology), explicitly discuss the mathematical/architectural models used to solve the biological problem. Do not just state that "AI helps biology"; explain exactly HOW.
- If the topic is purely biological, include specific mutations, molecular pathways, and precise limitations.

STRUCTURE & FORMATTING REQUIREMENTS:
1. Header: 
   - Start with a single `# ` for the Title (e.g. `# The Title of the Paper`).
   - Immediately below it, put the Author and Institution on the next line formatted exactly like this: `**Author:** {user_author} | **Institution:** {user_institution}`.
2. Abstract: Create a heading `## Abstract` and write a 150-250 word summary.
3. Introduction: Create a numbered heading `## 1. Introduction`.
4. Thematic Analysis / Literature Review: Create numbered headings for sections and subsections (e.g., `## 2. Thematic Analysis`, `### 2.1 Theme One`). Synthesize the papers. DO NOT just list them.
5. Research Gaps & Future Directions: Numbered heading (e.g., `## 3. Research Gaps`).
6. Conclusion: Numbered heading (e.g., `## 4. Conclusion`).
7. References: Heading `## 5. References`. Proper APA-style bibliography.
8. Math & Formulas: If applicable, use standard LaTeX syntax (e.g., $E=mc^2$ or $$...$$).

CITATION RULES:
- Use strict APA in-text citations, e.g., (Smith et al., 2023).
- Only cite papers provided in the context below.

CONTEXT PAPERS:
{context}

Write the paper in professional academic Markdown format. Do not use markdown horizontal rules (---) before the title.
"""
    
    response = llm.invoke([
        SystemMessage(content="You are a strict, world-class PhD academic researcher."),
        HumanMessage(content=prompt)
    ])
    
    print("Draft generation complete!")
    return {"final_draft": response.content}
