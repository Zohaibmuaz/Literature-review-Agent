import os
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PayloadSchemaType

# Initialize Qdrant client using credentials from environment variables
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    timeout=60.0  # Increased timeout to 60 seconds to prevent ReadTimeout
)

COLLECTION_NAME = "research_papers"

def init_qdrant():
    # Check if collection exists, if not create it
    # We will use fastembed which defaults to 384 dimensions for BAAI/bge-small-en-v1.5
    if not qdrant_client.collection_exists(COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )
    
    # Create a payload index for keyword filtering to prevent Vector Bleeding
    try:
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="query_topic",
            field_schema=PayloadSchemaType.KEYWORD,
        )
    except Exception as e:
        print(f"Payload index creation note (might already exist): {e}")
