"""Vector store abstraction and ChromaDB local implementation"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VectorIndexProvider(ABC):
    """Abstract interface for local and cloud vector storage engines"""

    @abstractmethod
    def upsert_vectors(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        documents: Optional[List[str]] = None,
    ):
        """
        Upsert embeddings with metadata and unique identifiers

        Args:
            ids: List of unique document vector IDs
            embeddings: List of float vectors
            metadatas: Associated metadata (media_id, scene_id, timestamp, etc.)
            documents: Optional text representations
        """
        pass

    @abstractmethod
    def query_similarity(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filter_criteria: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query top-K most similar vectors

        Args:
            query_vector: Normalized search vector
            top_k: Number of nearest neighbors to retrieve
            filter_criteria: Optional metadata filter (e.g. {"media_id": 123})

        Returns:
            List of matching records with id, score/distance, metadata
        """
        pass

    @abstractmethod
    def delete_by_media_id(self, media_id: int):
        """
        Delete all vectors associated with a specific media asset

        Args:
            media_id: Media asset identifier
        """
        pass

    @abstractmethod
    def delete_by_ids(self, ids: List[str]):
        """
        Delete specific vectors by their unique IDs

        Args:
            ids: List of vector IDs
        """
        pass


class ChromaVectorProvider(VectorIndexProvider):
    """Local ChromaDB embedded vector database implementation"""

    def __init__(
        self,
        persist_dir: Optional[str] = None,
        collection_name: Optional[str] = None,
    ):
        self.persist_dir = persist_dir or settings.chroma_persist_dir
        self.collection_name = collection_name or settings.chroma_collection_name
        self._client = None
        self._collection = None

    def _get_collection(self):
        """Lazy loader for persistent ChromaDB collection"""
        if self._collection is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            Path(self.persist_dir).mkdir(parents=True, exist_ok=True)

            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            # Create or get collection using cosine similarity metric
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(f"Connected to ChromaDB collection '{self.collection_name}' at '{self.persist_dir}'")
        return self._collection

    def upsert_vectors(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        documents: Optional[List[str]] = None,
    ):
        """Upsert vectors into ChromaDB"""
        if not ids:
            return

        collection = self._get_collection()
        # Chroma expects documents if not None, or empty strings
        docs = documents if documents is not None else ["" for _ in ids]
        
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=docs,
        )
        logger.info(f"Upserted {len(ids)} vectors into ChromaDB collection '{self.collection_name}'")

    def query_similarity(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filter_criteria: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Query top_k similar vectors from ChromaDB"""
        collection = self._get_collection()
        
        where_clause = filter_criteria if filter_criteria else None

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where=where_clause,
            include=["metadatas", "distances", "documents"],
        )

        matches: List[Dict[str, Any]] = []
        if results and results["ids"] and len(results["ids"]) > 0:
            ids = results["ids"][0]
            distances = results["distances"][0] if results.get("distances") else []
            metadatas = results["metadatas"][0] if results.get("metadatas") else []

            for idx, vid in enumerate(ids):
                # In Chroma with cosine space: distance = 1 - cosine_similarity
                dist = distances[idx] if idx < len(distances) else 1.0
                similarity = max(0.0, 1.0 - dist)
                meta = metadatas[idx] if idx < len(metadatas) else {}

                matches.append({
                    "id": vid,
                    "similarity": similarity,
                    "distance": dist,
                    "metadata": meta,
                })

        return matches

    def delete_by_media_id(self, media_id: int):
        """Delete all vectors matching media_id"""
        try:
            collection = self._get_collection()
            collection.delete(where={"media_id": media_id})
            logger.info(f"Deleted vectors for media_id {media_id} from ChromaDB")
        except Exception as e:
            logger.warning(f"Error deleting vectors for media_id {media_id} from ChromaDB: {e}")

    def delete_by_ids(self, ids: List[str]):
        """Delete vectors by list of IDs"""
        if not ids:
            return
        try:
            collection = self._get_collection()
            collection.delete(ids=ids)
        except Exception as e:
            logger.warning(f"Error deleting vectors by IDs from ChromaDB: {e}")
