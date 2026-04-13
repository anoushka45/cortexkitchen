from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import uuid

from app.infrastructure.vector.qdrant_client import ensure_collection
from app.infrastructure.vector.embedding_service import EmbeddingService


# Collection names
COMPLAINT_COLLECTION = "complaint_memory"
SOP_COLLECTION       = "sop_memory"


class MemoryService:
    """Main interface for storing and retrieving vector memories in Qdrant."""

    def __init__(self, qdrant: QdrantClient, embedder: EmbeddingService):
        self.qdrant   = qdrant
        self.embedder = embedder

        # Ensure both collections exist
        ensure_collection(self.qdrant, COMPLAINT_COLLECTION)
        ensure_collection(self.qdrant, SOP_COLLECTION)

    def store_complaint(self, text: str, metadata: dict = None) -> str:
        """Embed and store a complaint in Qdrant."""
        vector = self.embedder.embed(text)
        point_id = str(uuid.uuid4())

        self.qdrant.upsert(
            collection_name=COMPLAINT_COLLECTION,
            points=[PointStruct(
                id=point_id,
                vector=vector,
                payload={"text": text, **(metadata or {})}
            )]
        )
        return point_id

    def store_sop(self, text: str, metadata: dict = None) -> str:
        """Embed and store an SOP rule in Qdrant."""
        vector = self.embedder.embed(text)
        point_id = str(uuid.uuid4())

        self.qdrant.upsert(
            collection_name=SOP_COLLECTION,
            points=[PointStruct(
                id=point_id,
                vector=vector,
                payload={"text": text, **(metadata or {})}
            )]
        )
        return point_id

    def retrieve_similar_complaints(self, query: str, top_k: int = 3) -> list[dict]:
        """Find the most semantically similar past complaints."""
        vector = self.embedder.embed(query)

        results = self.qdrant.query_points(
            collection_name=COMPLAINT_COLLECTION,
            query=vector,
            limit=top_k,
        ).points

        return [
            {
                "text": r.payload.get("text", ""),
                "score": round(r.score, 3),
                "metadata": {k: v for k, v in r.payload.items() if k != "text"}
            }
            for r in results
        ]

    def retrieve_relevant_sops(self, query: str, top_k: int = 3) -> list[dict]:
        """Find the most relevant SOP rules for a given context."""
        vector = self.embedder.embed(query)

        results = self.qdrant.query_points(
            collection_name=SOP_COLLECTION,
            query=vector,
            limit=top_k,
        ).points

        return [
            {
                "text": r.payload.get("text", ""),
                "score": round(r.score, 3),
                "metadata": {k: v for k, v in r.payload.items() if k != "text"}
            }
            for r in results
        ]