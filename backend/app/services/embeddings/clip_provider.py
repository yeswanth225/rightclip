"""Visual embedding provider abstraction and OpenCLIP implementation"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional, Union

import torch
from PIL import Image

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VisualEmbeddingProvider(ABC):
    """Abstract base class for multimodal image and text visual embedding models"""

    @abstractmethod
    def embed_image(self, image_path: Path) -> List[float]:
        """
        Compute normalized 512-dim visual embedding vector for a single image

        Args:
            image_path: Path to image file

        Returns:
            L2-normalized float vector
        """
        pass

    @abstractmethod
    def embed_images_batch(self, image_paths: List[Path], batch_size: Optional[int] = None) -> List[List[float]]:
        """
        Compute normalized visual embedding vectors for a batch of images

        Args:
            image_paths: List of image file paths
            batch_size: Optional batch size override

        Returns:
            List of L2-normalized float vectors
        """
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """
        Compute normalized text embedding vector for a natural-language search query

        Args:
            text: Query string (e.g. 'Loki flips his hair')

        Returns:
            L2-normalized float vector
        """
        pass


class OpenCLIPProvider(VisualEmbeddingProvider):
    """OpenCLIP ViT-B/32 multimodal embedding provider with automatic hardware detection and lazy loading"""

    def __init__(
        self,
        model_name: Optional[str] = None,
        pretrained: Optional[str] = None,
        device: Optional[str] = None,
    ):
        self.model_name = model_name or settings.clip_model_name
        self.pretrained = pretrained or settings.clip_pretrained
        
        # Auto-detect device
        requested_dev = device or settings.clip_device
        if requested_dev == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        elif requested_dev == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA requested for OpenCLIP but not available. Falling back to CPU.")
            self.device = "cpu"
        else:
            self.device = requested_dev

        self._model = None
        self._preprocess = None
        self._tokenizer = None
        logger.info(f"Initialized OpenCLIPProvider (model={self.model_name}, device={self.device})")

    def _ensure_model_loaded(self):
        """Lazy load OpenCLIP weights and tokenizer"""
        if self._model is None:
            import open_clip

            logger.info(f"Loading OpenCLIP model '{self.model_name}' (pretrained='{self.pretrained}') on {self.device}...")
            model, _, preprocess = open_clip.create_model_and_transforms(
                self.model_name,
                pretrained=self.pretrained,
                device=self.device,
            )
            model.eval()
            tokenizer = open_clip.get_tokenizer(self.model_name)

            self._model = model
            self._preprocess = preprocess
            self._tokenizer = tokenizer
            logger.info(f"OpenCLIP model '{self.model_name}' successfully loaded into memory on {self.device}.")

    def embed_image(self, image_path: Path) -> List[float]:
        """Embed single image"""
        results = self.embed_images_batch([image_path], batch_size=1)
        if not results:
            raise ValueError(f"Failed to generate embedding for {image_path}")
        return results[0]

    def embed_images_batch(self, image_paths: List[Path], batch_size: Optional[int] = None) -> List[List[float]]:
        """Batch process and embed image keyframes"""
        if not image_paths:
            return []

        self._ensure_model_loaded()
        bs = batch_size or settings.clip_batch_size
        all_embeddings: List[List[float]] = []

        for i in range(0, len(image_paths), bs):
            batch_paths = image_paths[i : i + bs]
            tensors = []
            valid_indices = []

            for idx, p in enumerate(batch_paths):
                try:
                    with Image.open(p) as img:
                        tensor = self._preprocess(img.convert("RGB"))
                        tensors.append(tensor)
                        valid_indices.append(idx)
                except Exception as e:
                    logger.warning(f"Failed to load image for CLIP preprocessing '{p}': {e}")

            if not tensors:
                continue

            batch_tensor = torch.stack(tensors).to(self.device)

            with torch.no_grad():
                image_features = self._model.encode_image(batch_tensor)
                # L2-normalize vectors so cosine similarity is equal to dot product
                image_features /= image_features.norm(dim=-1, keepdim=True)
                embeddings = image_features.cpu().tolist()
                all_embeddings.extend(embeddings)

        return all_embeddings

    def embed_text(self, text: str) -> List[float]:
        """Embed text prompt into the shared multimodal space"""
        self._ensure_model_loaded()

        text_tokens = self._tokenizer([text]).to(self.device)

        with torch.no_grad():
            text_features = self._model.encode_text(text_tokens)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            return text_features.cpu()[0].tolist()
