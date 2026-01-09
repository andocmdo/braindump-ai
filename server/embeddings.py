"""
Braindump Embeddings

Handles embedding generation for semantic search.
Supports local models (sentence-transformers) and can be extended for API-based embeddings.
"""

import hashlib
import numpy as np
from typing import Optional
from pathlib import Path


class EmbeddingProvider:
    """Base class for embedding providers."""

    def __init__(self, model_name: str):
        self.model_name = model_name
        self.dimension = 0

    def embed(self, text: str) -> list[float]:
        raise NotImplementedError

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(text) for text in texts]


class LocalEmbeddings(EmbeddingProvider):
    """Local embeddings using sentence-transformers."""

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        super().__init__(model_name)
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            print(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            # Get embedding dimension from a test embedding
            test_embedding = self.model.encode("test", convert_to_numpy=True)
            self.dimension = len(test_embedding)
            print(f"Embedding model loaded. Dimension: {self.dimension}")
        except ImportError:
            raise ImportError("sentence-transformers is required for local embeddings")

    def embed(self, text: str) -> list[float]:
        if not self.model:
            raise RuntimeError("Model not loaded")
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not self.model:
            raise RuntimeError("Model not loaded")
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return [e.tolist() for e in embeddings]


class EmbeddingManager:
    """Manages embedding generation and caching."""

    def __init__(self, config: dict):
        self.config = config
        self.provider = None
        self._init_provider()

    def _init_provider(self):
        provider_type = self.config.get('provider', 'local')
        model_name = self.config.get('model', 'all-MiniLM-L6-v2')

        if provider_type == 'local':
            self.provider = LocalEmbeddings(model_name)
        else:
            # Could add API-based providers here (OpenAI, etc.)
            raise ValueError(f"Unknown embedding provider: {provider_type}")

    @property
    def dimension(self) -> int:
        return self.provider.dimension if self.provider else 0

    def get_embedding(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        if not self.provider:
            raise RuntimeError("No embedding provider configured")
        return self.provider.embed(text)

    def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        if not self.provider:
            raise RuntimeError("No embedding provider configured")
        return self.provider.embed_batch(texts)

    @staticmethod
    def content_hash(content: str) -> str:
        """Generate a hash of content for caching."""
        return hashlib.md5(content.encode()).hexdigest()

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        a = np.array(a)
        b = np.array(b)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def search(self, query: str, embeddings: list[tuple[str, list[float]]],
               top_k: int = 10, min_similarity: float = 0.25) -> list[tuple[str, float]]:
        """
        Search for similar documents.

        Args:
            query: The search query
            embeddings: List of (doc_id, embedding) tuples
            top_k: Number of results to return
            min_similarity: Minimum similarity score to include in results (default 0.25)

        Returns:
            List of (doc_id, similarity_score) tuples, sorted by similarity
        """
        query_embedding = self.get_embedding(query)

        results = []
        for doc_id, doc_embedding in embeddings:
            similarity = self.cosine_similarity(query_embedding, doc_embedding)
            # Only include results above the minimum threshold
            if similarity >= min_similarity:
                results.append((doc_id, similarity))

        # Sort by similarity (highest first)
        results.sort(key=lambda x: x[1], reverse=True)

        return results[:top_k]
