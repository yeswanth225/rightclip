"""faster-whisper local transcription provider implementation"""

import logging
from pathlib import Path
from typing import Optional, Tuple

from app.core.config import get_settings
from app.services.transcription.base import SegmentResult, TranscriptionProvider, TranscriptionResult

logger = logging.getLogger(__name__)
settings = get_settings()


class FasterWhisperProvider(TranscriptionProvider):
    """Local faster-whisper transcription provider with hardware auto-detection"""

    def __init__(
        self,
        model_size: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        threads: Optional[int] = None,
    ):
        self.model_size = model_size or settings.whisper_model_size
        self.device, self.compute_type = self._detect_compute_config(
            device or settings.whisper_device,
            compute_type or settings.whisper_compute_type,
        )
        self.threads = threads or settings.whisper_threads
        self._model = None

    @staticmethod
    def _detect_compute_config(requested_device: str, requested_compute_type: str) -> Tuple[str, str]:
        """
        Detect hardware and pick safest, fastest compute configuration

        Returns:
            (device, compute_type) e.g. ('cpu', 'int8') or ('cuda', 'float16')
        """
        import ctranslate2

        device = requested_device.lower()
        compute_type = requested_compute_type.lower()

        cuda_available = False
        try:
            cuda_available = ctranslate2.get_cuda_device_count() > 0
        except Exception:
            cuda_available = False

        # Resolve device
        if device == "auto":
            device = "cuda" if cuda_available else "cpu"
        elif device == "cuda" and not cuda_available:
            logger.warning("CUDA requested for transcription but no CUDA device found. Falling back to CPU.")
            device = "cpu"

        # Resolve compute_type based on supported types for device
        try:
            supported = ctranslate2.get_supported_compute_types(device)
        except Exception as e:
            logger.warning(f"Failed to query supported compute types: {e}")
            supported = {"int8", "float32"}

        if compute_type == "auto":
            if device == "cuda":
                if "float16" in supported:
                    compute_type = "float16"
                elif "int8_float16" in supported:
                    compute_type = "int8_float16"
                else:
                    compute_type = "float32"
            else:
                # CPU: int8 offers excellent speed and low memory
                if "int8" in supported:
                    compute_type = "int8"
                elif "int8_float32" in supported:
                    compute_type = "int8_float32"
                else:
                    compute_type = "float32"
        else:
            if compute_type not in supported:
                fallback = "int8" if device == "cpu" else "float16"
                if fallback not in supported:
                    fallback = "float32"
                logger.warning(
                    f"Requested compute_type '{compute_type}' not supported for {device} (supported: {supported}). "
                    f"Falling back to '{fallback}'."
                )
                compute_type = fallback

        logger.info(f"Initialized faster-whisper with device='{device}', compute_type='{compute_type}'")
        return device, compute_type

    def _get_model(self):
        """Lazy loader for faster-whisper WhisperModel with automatic CPU fallback"""
        if self._model is None:
            from faster_whisper import WhisperModel

            try:
                logger.info(
                    f"Loading WhisperModel(size='{self.model_size}', device='{self.device}', "
                    f"compute_type='{self.compute_type}', cpu_threads={self.threads})..."
                )
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                    cpu_threads=self.threads,
                )
            except Exception as e:
                if self.device != "cpu":
                    logger.warning(f"Failed to load WhisperModel on {self.device} ({e}). Falling back to CPU.")
                    self.device = "cpu"
                    self.compute_type = "int8"
                    self._model = WhisperModel(
                        self.model_size,
                        device="cpu",
                        compute_type="int8",
                        cpu_threads=self.threads,
                    )
                else:
                    raise e
        return self._model

    def transcribe(self, audio_or_video_path: Path, language: Optional[str] = None) -> TranscriptionResult:
        """
        Transcribe audio or video using faster-whisper with automatic fallback to CPU if CUDA fails.

        Args:
            audio_or_video_path: Path to the media file
            language: Optional language code hint

        Returns:
            TranscriptionResult with segments and text
        """
        path = Path(audio_or_video_path)
        if not path.exists():
            raise FileNotFoundError(f"Media file not found: {path}")

        model = self._get_model()

        # Transcribe with word timestamps & VAD filtering
        try:
            segments_gen, info = model.transcribe(
                str(path),
                language=language,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )
            # Evaluate generator to catch any CUDA library runtime errors during inference
            segments_list = list(segments_gen)
        except Exception as e:
            if "cublas" in str(e).lower() or "cuda" in str(e).lower() or "cudnn" in str(e).lower():
                logger.warning(f"CUDA transcription execution failed ({e}), falling back to CPU...")
                from faster_whisper import WhisperModel
                self.device = "cpu"
                self.compute_type = "int8"
                self._model = WhisperModel(
                    self.model_size,
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=self.threads,
                )
                segments_gen, info = self._model.transcribe(
                    str(path),
                    language=language,
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                )
                segments_list = list(segments_gen)
            else:
                raise e

        segments = []
        full_text_parts = []

        for idx, segment in enumerate(segments_list):
            cleaned_text = segment.text.strip()
            if cleaned_text:
                full_text_parts.append(cleaned_text)

            segments.append(
                SegmentResult(
                    segment_index=idx,
                    start_time=segment.start,
                    end_time=segment.end,
                    text=cleaned_text,
                    avg_logprob=getattr(segment, "avg_logprob", None),
                    no_speech_prob=getattr(segment, "no_speech_prob", None),
                )
            )

        full_text = " ".join(full_text_parts)

        return TranscriptionResult(
            language=info.language,
            language_probability=info.language_probability,
            duration=info.duration,
            full_text=full_text,
            segments=segments,
            provider="faster-whisper",
            model_name=self.model_size,
        )
