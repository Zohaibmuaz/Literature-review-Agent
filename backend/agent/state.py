from typing import TypedDict, List, Dict, Any, Optional

class ResearchState(TypedDict):
    research_topic: str
    author: str
    institution: str
    paper_list: List[Dict[str, Any]]
    final_draft: Optional[str]
    citation_style: str
    ui_queue: Optional[Any]
    mode: Optional[str]
