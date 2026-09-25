"""Person embedding and face detection provider abstraction and local implementation"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.services.embeddings.clip_provider import VisualEmbeddingProvider, OpenCLIPProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class PersonEmbeddingProvider(ABC):
    """Abstract base class for person/face detection and identity embedding"""

    @abstractmethod
    def extract_person_crops(self, image_path: Path) -> List[Tuple[Image.Image, Dict[str, float]]]:
        """
        Detect person/face regions in an image and return cropped PIL images and bounding box info.
        
        Returns:
            List of (cropped_pil_image, bbox_dict {"x": ..., "y": ..., "w": ..., "h": ...})
        """
        pass

    @abstractmethod
    def embed_person_image(self, image_input: Union[Path, Image.Image]) -> List[float]:
        """
        Compute normalized identity embedding for a reference person/face crop or photo.
        """
        pass


class LocalPersonEmbeddingProvider(PersonEmbeddingProvider):
    """
    Modular person and face embedding provider using Haar Cascade / HOG person detection
    and OpenCLIP localized feature embeddings.
    Allows easy drop-in replacement with InsightFace/FaceNet later.
    """

    def __init__(self, visual_provider: Optional[VisualEmbeddingProvider] = None):
        self.visual_provider = visual_provider or OpenCLIPProvider()
        # Load standard OpenCV Haar Cascades for face/upper body detection
        self._face_cascade = None
        self._upperbody_cascade = None

    def _ensure_cascades_loaded(self):
        if self._face_cascade is None:
            try:
                face_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                self._face_cascade = cv2.CascadeClassifier(face_cascade_path)
            except Exception as e:
                logger.warning(f"Failed to load frontalface cascade: {e}")
                self._face_cascade = None

        if self._upperbody_cascade is None:
            try:
                body_cascade_path = cv2.data.haarcascades + "haarcascade_upperbody.xml"
                self._upperbody_cascade = cv2.CascadeClassifier(body_cascade_path)
            except Exception as e:
                logger.warning(f"Failed to load upperbody cascade: {e}")
                self._upperbody_cascade = None

    def extract_person_crops(self, image_path: Path) -> List[Tuple[Image.Image, Dict[str, float]]]:
        """Detect human faces or upper bodies and crop them for person indexing"""
        if not image_path.exists():
            return []

        self._ensure_cascades_loaded()

        try:
            img_bgr = cv2.imread(str(image_path))
            if img_bgr is None:
                return []
            
            h, w = img_bgr.shape[:2]
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
            
            crops: List[Tuple[Image.Image, Dict[str, float]]] = []
            detected_rects = []

            # 1. Try face detection
            if self._face_cascade and not self._face_cascade.empty():
                faces = self._face_cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
                )
                for (fx, fy, fw, fh) in faces:
                    # Expand bounding box slightly for context (head + upper shoulders)
                    pad_x = int(fw * 0.2)
                    pad_y = int(fh * 0.2)
                    x1 = max(0, fx - pad_x)
                    y1 = max(0, fy - pad_y)
                    x2 = min(w, fx + fw + pad_x)
                    y2 = min(h, fy + fh + int(pad_y * 1.5))
                    detected_rects.append((x1, y1, x2 - x1, y2 - y1))

            # 2. If no faces, try upperbody detection
            if not detected_rects and self._upperbody_cascade and not self._upperbody_cascade.empty():
                bodies = self._upperbody_cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=3, minSize=(80, 80)
                )
                for (bx, by, bw, bh) in bodies:
                    detected_rects.append((bx, by, bw, bh))

            # Convert to PIL crops
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_full = Image.fromarray(img_rgb)

            for (rx, ry, rw, rh) in detected_rects:
                crop = pil_full.crop((rx, ry, rx + rw, ry + rh))
                norm_bbox = {
                    "x": round(rx / w, 4),
                    "y": round(ry / h, 4),
                    "w": round(rw / w, 4),
                    "h": round(rh / h, 4),
                }
                crops.append((crop, norm_bbox))

            # If no specific face/body detected but the keyframe exists, fallback to full image crop
            if not crops:
                crops.append((pil_full, {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}))

            return crops
        except Exception as e:
            logger.warning(f"Person crop extraction failed for {image_path}: {e}")
            return []

    def embed_person_image(self, image_input: Union[Path, Image.Image]) -> List[float]:
        """Compute embedding vector for a person reference image or crop"""
        if isinstance(image_input, (str, Path)):
            p = Path(image_input)
            crops = self.extract_person_crops(p)
            if crops:
                pil_target = crops[0][0]
            else:
                pil_target = Image.open(p).convert("RGB")
        elif isinstance(image_input, Image.Image):
            pil_target = image_input.convert("RGB")
        else:
            raise ValueError(f"Unsupported image_input type: {type(image_input)}")

        # Save temporary memory crop or process directly via OpenCLIPProvider
        # We can leverage OpenCLIPProvider directly
        if isinstance(self.visual_provider, OpenCLIPProvider):
            self.visual_provider._ensure_model_loaded()
            import torch
            tensor = self.visual_provider._preprocess(pil_target).unsqueeze(0).to(self.visual_provider.device)
            with torch.no_grad():
                features = self.visual_provider._model.encode_image(tensor)
                features /= features.norm(dim=-1, keepdim=True)
                return features.cpu()[0].tolist()
        else:
            # Fallback via temp file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            pil_target.save(tmp_path, format="JPEG")
            try:
                emb = self.visual_provider.embed_image(tmp_path)
                return emb
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
