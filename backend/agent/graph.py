from langgraph.graph import StateGraph, START, END
from .state import ResearchState
from .nodes import search_node, reader_node, writer_node

# Initialize StateGraph with our TypedDict State
workflow = StateGraph(ResearchState)

# Add Nodes
workflow.add_node("search", search_node)
workflow.add_node("reader", reader_node)
workflow.add_node("writer", writer_node)

# Define the sequential edges
workflow.add_edge(START, "search")
workflow.add_edge("search", "reader")
workflow.add_edge("reader", "writer")
workflow.add_edge("writer", END)

# Compile the workflow graph
research_graph = workflow.compile()
