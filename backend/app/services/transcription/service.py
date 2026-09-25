"""Transcription service orchestrating providers, database storage, and errors"""

import logging
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.media import MediaAsset
from app.models.transcript import Transcript, TranscriptSegment, TranscriptStatus
from app.services.transcription.base import TranscriptionProvider, TranscriptionResult
from app.services.transcription.whisper_provider import FasterWhisperProvider

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service for managing transcriptions and persisting segments to DB"""

    def __init__(self, provider: Optional[TranscriptionProvider] = None):
        self.provider = provider or FasterWhisperProvider()

    def process_media_transcription(
        self,
        media_id: int,
        db: Session,
        media_path: Optional[Path] = None,
        language: Optional[str] = None,
    ) -> Optional[Transcript]:
        """
        Transcribe a media asset and save transcript & segments to database.

        Args:
            media_id: MediaAsset primary key ID
            db: SQLAlchemy Session
            media_path: Optional explicit media file path (defaults to asset file_path/proxy_path)
            language: Optional language hint

        Returns:
            Transcript database model or None if failed
        """
        media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
        if not media_asset:
            logger.error(f"Media asset {media_id} not found for transcription")
            return None

        # Check or create Transcript record
        transcript = db.query(Transcript).filter(Transcript.media_id == media_id).first()
        if not transcript:
            transcript = Transcript(
                media_id=media_id,
                status=TranscriptStatus.TRANSCRIBING,
                provider=getattr(self.provider, "provider_name", "faster-whisper"),
                model_name=getattr(self.provider, "model_size", "base"),
            )
            db.add(transcript)
            db.commit()
            db.refresh(transcript)
        else:
            transcript.status = TranscriptStatus.TRANSCRIBING
            transcript.error_message = None
            db.commit()

        # Check if asset has an audio track
        if media_asset.audio_codec is None and media_asset.metadata_json:
            # Check if any audio streams exist
            has_audio = bool(media_asset.metadata_json.get("audio_codec"))
            if not has_audio and media_asset.metadata_json.get("streams"):
                has_audio = any(s.get("codec_type") == "audio" for s in media_asset.metadata_json["streams"])
            if not has_audio:
                logger.info(f"Media {media_id} has no audio stream, marking transcript as SKIPPED")
                transcript.status = TranscriptStatus.SKIPPED
                transcript.full_text = ""
                db.commit()
                return transcript

        # Determine file path to transcribe
        file_to_transcribe = media_path or (
            Path(media_asset.proxy_path) if media_asset.proxy_path and Path(media_asset.proxy_path).exists()
            else Path(media_asset.file_path) if media_asset.file_path and Path(media_asset.file_path).exists()
            else None
        )

        if not file_to_transcribe or not file_to_transcribe.exists():
            error_msg = f"No media file available to transcribe for media_id {media_id}"
            logger.error(error_msg)
            transcript.status = TranscriptStatus.FAILED
            transcript.error_message = error_msg
            db.commit()
            return transcript

        try:
            logger.info(f"Starting transcription for media {media_id} from {file_to_transcribe}")
            result: TranscriptionResult = self.provider.transcribe(file_to_transcribe, language=language)

            # Clear existing segments if re-running
            db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id == transcript.id).delete()

            # Populate transcript
            transcript.status = TranscriptStatus.COMPLETED
            transcript.language = result.language
            transcript.language_probability = result.language_probability
            transcript.duration = result.duration
            transcript.full_text = result.full_text
            transcript.provider = result.provider
            transcript.model_name = result.model_name
            transcript.error_message = None

            # Add segments
            for seg in result.segments:
                db_seg = TranscriptSegment(
                    transcript_id=transcript.id,
                    media_id=media_id,
                    segment_index=seg.segment_index,
                    start_time=seg.start_time,
                    end_time=seg.end_time,
                    text=seg.text,
                    avg_logprob=seg.avg_logprob,
                    no_speech_prob=seg.no_speech_prob,
                )
                db.add(db_seg)

            db.commit()
            db.refresh(transcript)
            logger.info(
                f"Successfully transcribed media {media_id}: {len(result.segments)} segments, "
                f"language={result.language} (p={result.language_probability:.2f})"
            )
            return transcript

        except Exception as e:
            logger.exception(f"Transcription failed for media {media_id}: {e}")
            transcript.status = TranscriptStatus.FAILED
            transcript.error_message = str(e)
            db.commit()
            return transcript
