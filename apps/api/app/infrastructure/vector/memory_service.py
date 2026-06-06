from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue, PointStruct
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

    def store_complaint(self, text: str, org_id: int, metadata: dict = None) -> str:
        """Embed and store a complaint in Qdrant, scoped to the org."""
        vector = self.embedder.embed(text)
        point_id = str(uuid.uuid4())

        self.qdrant.upsert(
            collection_name=COMPLAINT_COLLECTION,
            points=[PointStruct(
                id=point_id,
                vector=vector,
                payload={"text": text, "org_id": org_id, **(metadata or {})}
            )]
        )
        return point_id

    def store_sop(self, text: str, org_id: int, metadata: dict = None) -> str:
        """Embed and store an SOP rule in Qdrant, scoped to the org."""
        vector = self.embedder.embed(text)
        point_id = str(uuid.uuid4())

        self.qdrant.upsert(
            collection_name=SOP_COLLECTION,
            points=[PointStruct(
                id=point_id,
                vector=vector,
                payload={"text": text, "org_id": org_id, **(metadata or {})}
            )]
        )
        return point_id

    def _org_filter(self, org_id: int) -> Filter:
        return Filter(must=[FieldCondition(key="org_id", match=MatchValue(value=org_id))])

    def retrieve_similar_complaints(self, query: str, org_id: int, top_k: int = 3) -> list[dict]:
        """Find the most semantically similar past complaints for this org."""
        vector = self.embedder.embed(query)

        results = self.qdrant.query_points(
            collection_name=COMPLAINT_COLLECTION,
            query=vector,
            query_filter=self._org_filter(org_id),
            limit=top_k,
        ).points

        return [
            {
                "text": r.payload.get("text", ""),
                "score": round(r.score, 3),
                "metadata": {k: v for k, v in r.payload.items() if k not in ("text", "org_id")}
            }
            for r in results
        ]

    def retrieve_relevant_sops(self, query: str, org_id: int, top_k: int = 3) -> list[dict]:
        """Find the most relevant SOP rules for this org."""
        vector = self.embedder.embed(query)

        results = self.qdrant.query_points(
            collection_name=SOP_COLLECTION,
            query=vector,
            query_filter=self._org_filter(org_id),
            limit=top_k,
        ).points

        return [
            {
                "text": r.payload.get("text", ""),
                "score": round(r.score, 3),
                "metadata": {k: v for k, v in r.payload.items() if k not in ("text", "org_id")}
            }
            for r in results
        ]