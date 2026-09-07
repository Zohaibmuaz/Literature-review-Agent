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
    import time
    arxiv_query = query.replace(" ", "+")
    url = f"https://export.arxiv.org/api/query?search_query=all:{arxiv_query}&start=0&max_results={max_results}&sortBy=relevance&sortOrder=descending"
    
    headers = {
        "User-Agent": "LitReviewerAI/1.0 (academic-research-agent; mailto:support@litreviewer.ai)"
    }
    
    for attempt in range(3):
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                root = ET.fromstring(response.text)
                ns = {'atom': 'http://www.w3.org/2005/Atom'}
                papers = []
                
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
                    
                if papers:
                    return papers
        except Exception as e:
            print(f"[ArXiv Attempt {attempt+1}/3 failed]: {e}")
            time.sleep(1.5)
            
    print("[ArXiv] All attempts failed or returned no papers.")
    return []

def fetch_semantic_scholar(query: str, max_results: int = 10) -> list:
    query_encoded = query.replace(" ", "+")
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query_encoded}&limit={max_results}&fields=title,abstract,url,year,authors&year=2020-"
    papers = []
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get('data', []):
                if item.get('abstract'):
                    authors_list = item.get('authors')
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
    except Exception as e:
        print(f"[Semantic Scholar] Error fetching: {e}")
        
    return papers

def search_node(state: ResearchState) -> Dict[str, Any]:
    topic = state.get("research_topic", "")
    ui_queue = state.get("ui_queue")
    mode = state.get("mode", "full")
    max_target = 5 if mode == "preview" else 20
    print(f"--- SEARCHING FOR RECENT PAPERS ({mode.upper()} MODE, target: {max_target}): {topic} ---")
    
    if ui_queue:
        ui_queue.put({"type": "status", "agent": "Research Crawler", "message": f"Searching research papers ({'5 papers in Preview — 20 in Full Version' if mode == 'preview' else '20 papers in Full Version'})..."})
    
    # Fetch papers from ArXiv
    arxiv_papers = fetch_arxiv(topic, max_results=max_target)
    semantic_papers = fetch_semantic_scholar(topic, max_results=3 if mode == "preview" else 5)
    
    combined_papers = arxiv_papers + semantic_papers
    combined_papers = combined_papers[:max_target]
    
    print(f"--- FOUND {len(combined_papers)} RECENT PAPERS ---")
    
    if ui_queue:
        ui_queue.put({
            "type": "status", 
            "agent": "Research Crawler", 
            "message": f"Found {len(combined_papers)} papers.",
            "data": {"paper_count": len(combined_papers), "papers": combined_papers}
        })
    
    return {"paper_list": combined_papers}

def reader_node(state: ResearchState) -> Dict[str, Any]:
    print("--- READER NODE: Chunking and Embedding ---")
    paper_list = state.get("paper_list", [])
    ui_queue = state.get("ui_queue")
    
    if not paper_list:
        return {}
        
    if ui_queue:
        ui_queue.put({"type": "status", "agent": "Data Engineer", "message": f"Vectorizing {len(paper_list)} papers in Qdrant ({'Preview Mode' if state.get('mode') == 'preview' else 'Full Version'})..."})
    
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
        
        print(f"Upserting {len(docs)} documents to Qdrant...")
        points = [
            PointStruct(id=ids[i], vector=embeddings[i], payload={"document": docs[i], **metadata[i]})
            for i in range(len(docs))
        ]
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
        
        if ui_queue:
            ui_queue.put({"type": "status", "agent": "Data Engineer", "message": f"Vectorized and stored {len(docs)} papers successfully."})
            
    return {}

from qdrant_client.http import models

def metadata_grouped_retrieval(topic: str, paper_list: list, query_vector: list, limit_per_paper: int = 3) -> list:
    """
    Retrieves highly relevant chunks for EACH distinct paper using its title as a metadata filter.
    Injects a unique Citation Tag [paper_X] into the context.
    """
    grouped_chunks = []
    for paper in paper_list:
        title = paper.get('title')
        cite_key = paper.get('cite_key')
        
        search_result = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="query_topic",
                        match=models.MatchValue(value=topic)
                    ),
                    models.FieldCondition(
                        key="title",
                        match=models.MatchValue(value=title)
                    )
                ]
            ),
            limit=limit_per_paper
        )
        
        paper_context = ""
        for hit in search_result.points:
            meta = hit.payload
            paper_context += f"Citation Tag: {cite_key}\nPaper: {meta.get('title')}\nAuthors: {meta.get('authors')} ({meta.get('year')})\nContent: {meta.get('document')}\n\n"
            
        if paper_context:
            grouped_chunks.append(paper_context)
            
    return grouped_chunks

def generate_mini_synthesis(topic: str, chunks_batch: list, llm: ChatOpenAI) -> str:
    """
    Generates a mini-synthesis for a batch of retrieved chunks to avoid context overload.
    """
    context = "".join(chunks_batch)
    prompt = f"""You are an expert academic researcher.
Topic: '{topic}'

Analyze the following retrieved research paper chunks and synthesize their key findings, methodologies, and conclusions relevant to the topic. Keep all specific details, datasets, and metrics.
IMPORTANT: You MUST retain the 'Citation Tag' (e.g., [paper_X]) for every finding so the writer knows which paper it came from. Do NOT use real author names for citations, ONLY use the tags.
Do NOT hallucinate. Only use the provided context.

Context Papers:
{context}

Provide a detailed synthesis with Citation Tags:"""
    
    response = llm.invoke([
        SystemMessage(content="You are a strict, world-class PhD academic researcher."),
        HumanMessage(content=prompt)
    ])
    return response.content

def map_reduce_synthesis(topic: str, grouped_chunks: list, llm: ChatOpenAI, batch_size: int = 5, ui_queue=None) -> list:
    """
    Batches the retrieved chunks and generates a mini-synthesis for each batch.
    """
    mini_syntheses = []
    total_batches = (len(grouped_chunks) + batch_size - 1) // batch_size
    for i in range(0, len(grouped_chunks), batch_size):
        batch = grouped_chunks[i:i + batch_size]
        batch_num = i // batch_size + 1
        print(f"Generating mini-synthesis for batch {batch_num}/{total_batches} ({len(batch)} papers)...")
        if ui_queue:
            ui_queue.put({"type": "status", "agent": "Content Writer", "message": f"Synthesizing batch {batch_num}/{total_batches}..."})
        synthesis = generate_mini_synthesis(topic, batch, llm)
        mini_syntheses.append(synthesis)
    return mini_syntheses

def generate_section(section_name: str, topic: str, context: str, llm: ChatOpenAI, author: str, institution: str, ui_queue=None) -> str:
    """
    Generates a specific section of the paper using the synthesized context.
    Streams tokens to the ui_queue if provided.
    """
    print(f"Generating section: {section_name}...")
    
    specific_instruction = ""
    if section_name == "Header & Abstract":
        inst_block = f" | **Institution:** {institution.strip()}" if institution and institution.strip() else ""
        specific_instruction = f"1. Header:\n   - Start with a single `# ` for the Title.\n   - Immediately below it: `**Author:** {author}{inst_block}`.\n2. Abstract: Create a heading `## Abstract` and write a 150-250 word summary of the entire review."
    elif section_name == "Introduction":
        specific_instruction = "Create a numbered heading `## 1. Introduction`. Introduce the background, significance, and scope of the review."
    elif section_name == "Thematic Analysis":
        specific_instruction = "Create numbered headings (e.g., `## 2. Thematic Analysis`, `### 2.1 ...`). Synthesize the findings from the papers. DO NOT just list them."
    elif section_name == "Methodological Review":
        specific_instruction = "Create a numbered heading (e.g., `## 3. Methodological Review`). Critically evaluate the methods, datasets, and architectures used in the reviewed papers."
    elif section_name == "Discussion":
        specific_instruction = "Create a numbered heading (e.g., `## 4. Discussion & Research Gaps`). Identify patterns, limitations, and future directions."
    elif section_name == "Conclusion":
        specific_instruction = "Create a numbered heading (e.g., `## 5. Conclusion`). Summarize the main takeaways."
    elif section_name == "Executive Research Blueprint":
        specific_instruction = "Create a numbered heading `## 1. Executive Research Blueprint & Thematic Taxonomy`. Provide a concise, high-level breakdown of the core research pillars and taxonomy (maximum 150 words). Use bullet points and citation tags."
    elif section_name == "Core Literature Synthesis":
        specific_instruction = "Create a numbered heading `## 2. Core Literature Synthesis (Key Findings & Evidence)`. Provide a concise comparative synthesis of the 5 papers (maximum 200 words). Highlight key methodologies and findings using their exact citation tags. Keep it strictly concise."
    
    prompt = f"""You are a world-class PhD researcher and academic writer. 
Write the '{section_name}' section of a Review Paper on the topic: '{topic}'.

CRITICAL INSTRUCTIONS:
- Focus ONLY on the field of the requested topic.
- Include technical depth, specific metrics, and methodologies where appropriate.
- You MUST cite sources using their exact Citation Tags provided in the context, e.g., '...quantum speedup [paper_0]'. DO NOT use author names or real numbers for citations.

SECTION-SPECIFIC INSTRUCTIONS:
{specific_instruction}

CONTEXT (Mini-Syntheses with Citation Tags):
{context}

Provide ONLY the text for the '{section_name}' section, formatted in professional academic Markdown:"""

    response_content = ""
    if ui_queue:
        # Stream text token by token
        for chunk in llm.stream([
            SystemMessage(content="You are a strict, world-class PhD academic researcher."),
            HumanMessage(content=prompt)
        ]):
            token = chunk.content
            response_content += token
            ui_queue.put({"type": "token", "content": token})
        
        # Add a couple of newlines between sections for streaming visual separation
        ui_queue.put({"type": "token", "content": "\n\n"})
    else:
        # Fallback to standard synchronous invoke
        response = llm.invoke([
            SystemMessage(content="You are a strict, world-class PhD academic researcher."),
            HumanMessage(content=prompt)
        ])
        response_content = response.content
        
    return response_content

def apply_citations(generated_sections: dict, paper_list: list, citation_style: str) -> str:
    """
    Parses the generated sections for [paper_X] tags in order of appearance (including grouped tags like [paper_0, paper_1]).
    Replaces them with [1], [2] for IEEE or (Author, Year) for APA.
    Generates properly formatted reference list with individual paragraphs.
    """
    import re
    print(f"Applying citations and formatting References in {citation_style} style...")
    
    # 1. Join everything except References
    draft_body = "\n\n".join(generated_sections.values())
    
    # 2. Find all unique paper keys in strict order of appearance (handles [paper_0], [paper_0, paper_1], etc.)
    keys_in_order = []
    for match in re.finditer(r'paper_\d+', draft_body):
        key = match.group()
        if key not in keys_in_order:
            keys_in_order.append(key)
            
    # Append any uncited papers at the end just in case
    for p in paper_list:
        cite_key = p.get('cite_key', '').strip('[]')
        if cite_key and cite_key not in keys_in_order:
            keys_in_order.append(cite_key)
            
    key_to_paper = {p.get('cite_key', '').strip('[]'): p for p in paper_list}
    key_to_index = {key: idx for idx, key in enumerate(keys_in_order, 1)}
    
    # 3. Replace tags and build reference list
    if citation_style.upper() == "IEEE":
        # Handler to replace bracketed groups e.g. [paper_0, paper_1] -> [1], [2]
        def replace_ieee_bracket(match):
            content = match.group(0)
            found_keys = re.findall(r'paper_\d+', content)
            if not found_keys:
                return content
            nums = [str(key_to_index[k]) for k in found_keys if k in key_to_index]
            return ", ".join(f"[{n}]" for n in nums)
            
        draft_body = re.sub(r'\[[^\]]*?paper_\d+[^\]]*?\]', replace_ieee_bracket, draft_body)
        # Fallback for any naked paper_X tags left without brackets
        draft_body = re.sub(r'paper_\d+', lambda m: f"[{key_to_index.get(m.group(), m.group())}]", draft_body)
        
        # Build IEEE References with double newlines so Word & Markdown format them as separate entries
        ref_num = len(generated_sections)
        ref_text = f"## {ref_num}. References\n\n"
        for idx, key in enumerate(keys_in_order, 1):
            paper = key_to_paper.get(key)
            if not paper: continue
            
            authors = paper.get('authors', 'Unknown')
            authors_clean = authors.replace(" & ", " and ")
            year = paper.get('year', 'n.d.')
            title = paper.get('title', 'Untitled')
            url = paper.get('url', '')
            source = paper.get('source', '')
            
            pub_info = "arXiv preprint" if (source == "arxiv" or "arxiv.org" in url) else "[Online]. Available"
            ref_text += f"[{idx}] {authors_clean}, \"{title},\" *{pub_info}*, {year}. Available: {url}\n\n"
            
    else:  # APA Style
        # Handler to replace bracketed groups e.g. [paper_0, paper_1] -> (Author 1, Year; Author 2, Year)
        def replace_apa_bracket(match):
            content = match.group(0)
            found_keys = re.findall(r'paper_\d+', content)
            if not found_keys:
                return content
            cites = []
            for k in found_keys:
                paper = key_to_paper.get(k)
                if paper:
                    authors = paper.get('authors', 'Unknown')
                    year = paper.get('year', 'n.d.')
                    cites.append(f"{authors}, {year}")
            if cites:
                return f"({'; '.join(cites)})"
            return content
            
        draft_body = re.sub(r'\[[^\]]*?paper_\d+[^\]]*?\]', replace_apa_bracket, draft_body)
        
        # Build APA References with double newlines
        ref_num = len(generated_sections)
        ref_text = f"## {ref_num}. References\n\n"
        apa_papers = sorted(paper_list, key=lambda x: x.get('authors', ''))
        for paper in apa_papers:
            authors = paper.get('authors', 'Unknown')
            year = paper.get('year', 'n.d.')
            title = paper.get('title', 'Untitled')
            url = paper.get('url', '')
            source = paper.get('source', '')
            
            pub_info = "arXiv preprint" if (source == "arxiv" or "arxiv.org" in url) else "[Online]. Available"
            ref_text += f"- {authors} ({year}). *{title}*. {pub_info}: {url}\n\n"
            
    return draft_body + "\n\n" + ref_text


def writer_node(state: ResearchState) -> Dict[str, Any]:
    print("--- WRITER NODE: Drafting Academic Review ---")
    topic = state.get("research_topic", "")
    user_author = state.get("author", "LitReviewer AI")
    user_institution = state.get("institution", "Department of Advanced AI Research")
    paper_list = state.get("paper_list", [])
    citation_style = state.get("citation_style", "APA")
    ui_queue = state.get("ui_queue")
    
    if ui_queue:
        ui_queue.put({"type": "status", "agent": "Content Writer", "message": "Reading vectorized documents..."})
    
    # Assign citation IDs to paper_list
    for idx, p in enumerate(paper_list):
        p['cite_key'] = f"[paper_{idx}]"
    
    print("Instantiating LLM...")
    llm = ChatOpenAI(
        model="google/gemini-2.5-flash",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base="https://openrouter.ai/api/v1"
    )
    
    print("Querying Qdrant for relevant context using Metadata-Grouped Retrieval...")
    query_vector = embedding_model.embed_query(topic)
    grouped_chunks = metadata_grouped_retrieval(topic, paper_list, query_vector)
    
    if ui_queue:
        ui_queue.put({"type": "status", "agent": "Content Writer", "message": "Synthesizing research into mini-batches..."})
        
    mini_syntheses = map_reduce_synthesis(topic, grouped_chunks, llm, 5, ui_queue)
    context = "\n\n--- MINI-SYNTHESIS ---\n\n".join(mini_syntheses)
        
    print("Executing Sequential Generation Workflow...")
    mode = state.get("mode", "full")
    if mode == "preview":
        sections = [
            "Header & Abstract",
            "Executive Research Blueprint",
            "Core Literature Synthesis"
        ]
    else:
        sections = [
            "Header & Abstract",
            "Introduction",
            "Thematic Analysis",
            "Methodological Review",
            "Discussion",
            "Conclusion"
        ]
    
    if ui_queue:
        ui_queue.put({"type": "status", "agent": "Content Writer", "message": "Drafting paper sequentially..."})
    
    generated_sections = {}
    for idx, section in enumerate(sections):
        if ui_queue:
            if idx > 0:
                ui_queue.put({"type": "token", "content": "\n\n"})
            ui_queue.put({"type": "status", "agent": "Content Writer", "message": f"Writing {section}..."})
        generated_sections[section] = generate_section(section, topic, context, llm, user_author, user_institution, ui_queue)
    
    # Final Stitching and Citation Application
    print("Finalizing Draft and Applying Citations...")
    final_draft = apply_citations(generated_sections, paper_list, citation_style)
    
    print("Draft generation complete!")
    if ui_queue:
        ui_queue.put({"type": "status", "agent": "Content Writer", "message": "Draft complete. Formatting citations..."})
        
    return {"final_draft": final_draft}
