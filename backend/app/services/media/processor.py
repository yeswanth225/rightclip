"""FFmpeg and FFprobe processing service for video transcoding, metadata extraction, and thumbnail generation"""

import json
import logging
from pathlib import Path
import subprocess
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class FFmpegProcessor:
    """Processor for FFmpeg operations including metadata probing, proxy transcoding, and keyframe capture"""

    @classmethod
    def extract_metadata(cls, source_path: Path | str) -> Dict[str, Any]:
        """
        Extract video and audio metadata using ffprobe.

        Args:
            source_path: Path to the media file

        Returns:
            Dictionary containing metadata (duration, width, height, fps, codecs, etc.)
        """
        source_path = Path(source_path).resolve()
        if not source_path.exists():
            raise FileNotFoundError(f"Media file not found at {source_path}")

        cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(source_path),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
            )
            probe_data = json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            logger.error(f"FFprobe failed for {source_path}: {e.stderr}")
            raise RuntimeError(f"FFprobe failed to inspect media file: {e.stderr}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse FFprobe JSON for {source_path}: {e}")
            raise RuntimeError(f"Failed to parse FFprobe metadata: {e}")

        format_info = probe_data.get("format", {})
        streams = probe_data.get("streams", [])

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        # Parse duration
        duration_str = format_info.get("duration")
        if not duration_str and video_stream:
            duration_str = video_stream.get("duration")
        if not duration_str and audio_stream:
            duration_str = audio_stream.get("duration")

        try:
            duration = float(duration_str) if duration_str else 0.0
        except (ValueError, TypeError):
            duration = 0.0

        # Parse dimensions
        width = int(video_stream.get("width")) if video_stream and "width" in video_stream else None
        height = int(video_stream.get("height")) if video_stream and "height" in video_stream else None

        # Parse fps
        fps = None
        if video_stream:
            fps_str = video_stream.get("r_frame_rate") or video_stream.get("avg_frame_rate")
            if fps_str and "/" in fps_str:
                try:
                    num, den = map(float, fps_str.split("/"))
                    if den > 0:
                        fps = round(num / den, 2)
                except Exception:
                    fps = None

        video_codec = video_stream.get("codec_name") if video_stream else None
        audio_codec = audio_stream.get("codec_name") if audio_stream else None

        return {
            "duration": duration,
            "width": width,
            "height": height,
            "fps": fps,
            "video_codec": video_codec,
            "audio_codec": audio_codec,
            "size_bytes": source_path.stat().st_size,
            "format_name": format_info.get("format_name"),
            "bitrate": int(format_info.get("bit_rate")) if format_info.get("bit_rate") else None,
            "raw_format": format_info,
        }

    @classmethod
    def validate_media(
        cls, metadata: Dict[str, Any], max_duration_seconds: Optional[float] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate media metadata for duration and streams.

        Args:
            metadata: Extracted metadata dictionary
            max_duration_seconds: Optional upper bound on duration

        Returns:
            Tuple of (is_valid, error_message)
        """
        duration = metadata.get("duration", 0.0)
        if not duration or duration <= 0:
            return False, "Media duration is invalid or could not be determined"

        if max_duration_seconds and duration > max_duration_seconds:
            return (
                False,
                f"Media duration ({duration:.1f}s) exceeds maximum allowed duration ({max_duration_seconds}s)",
            )

        if not metadata.get("video_codec") and not metadata.get("audio_codec"):
            return False, "Media file does not contain valid video or audio streams"

        return True, None

    @classmethod
    def generate_proxy(
        cls,
        source_path: Path | str,
        target_path: Path | str,
        target_height: int = 720,
    ) -> Path:
        """
        Transcode media to an optimized 720p H.264/AAC MP4 web proxy.
        Ensures yuv420p pixel format and +faststart moov atom for progressive web streaming.

        Args:
            source_path: Path to source media
            target_path: Path to output proxy MP4
            target_height: Target video height (maintaining aspect ratio)

        Returns:
            Path to generated proxy file

        Raises:
            RuntimeError: If FFmpeg fails or output validation fails
        """
        source_path = Path(source_path).resolve()
        target_path = Path(target_path).resolve()
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Scale filter ensuring width and height are divisible by 2 (even numbers for H.264)
        scale_filter = f"scale=-2:'min(ih,{target_height})'"

        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-vf",
            scale_filter,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(target_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=1800)
        except subprocess.CalledProcessError as e:
            logger.warning(f"Optimized scale proxy failed ({e.stderr}), retrying with default transcode...")
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:
                    pass

            fallback_cmd = [
                "ffmpeg",
                "-y",
                "-i",
                str(source_path),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "fast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                str(target_path),
            ]
            try:
                subprocess.run(fallback_cmd, capture_output=True, text=True, check=True, timeout=1800)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as fallback_err:
                if target_path.exists():
                    try:
                        target_path.unlink()
                    except Exception:
                        pass
                err_msg = getattr(fallback_err, "stderr", str(fallback_err))
                logger.error(f"FFmpeg proxy generation failed: {err_msg}")
                raise RuntimeError(f"FFmpeg proxy generation failed: {err_msg}")
        except subprocess.TimeoutExpired:
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:
                    pass
            logger.error(f"FFmpeg proxy generation timed out for {source_path}")
            raise RuntimeError(f"FFmpeg proxy generation timed out for {source_path}")

        # Post-Processing Validation
        if not target_path.exists() or target_path.stat().st_size == 0:
            if target_path.exists():
                target_path.unlink()
            raise RuntimeError(f"Generated proxy file is missing or 0 bytes: {target_path}")

        try:
            probe_meta = cls.extract_metadata(target_path)
            if not probe_meta.get("duration") or probe_meta["duration"] <= 0:
                target_path.unlink()
                raise RuntimeError(f"Generated proxy has invalid duration: {probe_meta.get('duration')}")
            if not probe_meta.get("video_codec"):
                target_path.unlink()
                raise RuntimeError("Generated proxy does not contain a valid video stream")
        except Exception as probe_err:
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:
                    pass
            logger.error(f"Proxy post-generation validation failed: {probe_err}")
            raise RuntimeError(f"Proxy post-generation validation failed: {probe_err}")

        logger.info(
            f"Successfully generated and verified web proxy: {target_path} "
            f"({probe_meta.get('duration', 0):.1f}s, {probe_meta.get('width')}x{probe_meta.get('height')}, "
            f"{target_path.stat().st_size} bytes)"
        )
        return target_path

    @classmethod
    def extract_thumbnail(
        cls,
        source_path: Path | str,
        thumbnail_path: Path | str,
        timestamp: float = 0.0,
    ) -> Path:
        """
        Extract a single video frame as a JPEG thumbnail at a given timestamp.

        Args:
            source_path: Path to source video
            thumbnail_path: Target path for output JPEG thumbnail
            timestamp: Timestamp in seconds

        Returns:
            Path to output thumbnail file

        Raises:
            RuntimeError: If thumbnail generation fails
        """
        source_path = Path(source_path).resolve()
        thumbnail_path = Path(thumbnail_path).resolve()
        thumbnail_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            f"{max(0.0, float(timestamp)):.3f}",
            "-i",
            str(source_path),
            "-vframes",
            "1",
            "-q:v",
            "2",
            str(thumbnail_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            if thumbnail_path.exists():
                try:
                    thumbnail_path.unlink()
                except Exception:
                    pass
            err_msg = getattr(e, "stderr", str(e))
            logger.error(f"FFmpeg thumbnail extraction failed at {timestamp}s: {err_msg}")
            raise RuntimeError(f"FFmpeg thumbnail extraction failed: {err_msg}")

        if not thumbnail_path.exists() or thumbnail_path.stat().st_size == 0:
            if thumbnail_path.exists():
                thumbnail_path.unlink()
            raise RuntimeError(f"Generated thumbnail is missing or 0 bytes: {thumbnail_path}")

        return thumbnail_path

    @classmethod
    def export_clip(
        cls,
        source_path: Path | str,
        target_path: Path | str,
        start_time: float,
        end_time: float,
    ) -> Path:
        """
        Extract and transcode a precise sub-clip from start_time to end_time as an optimized MP4.

        Args:
            source_path: Path to source video file (original or proxy)
            target_path: Target path for output clip MP4
            start_time: Start timestamp in seconds
            end_time: End timestamp in seconds

        Returns:
            Path to generated clip file

        Raises:
            RuntimeError: If FFmpeg trimming fails
        """
        source_path = Path(source_path).resolve()
        target_path = Path(target_path).resolve()
        target_path.parent.mkdir(parents=True, exist_ok=True)

        if not source_path.exists():
            raise FileNotFoundError(f"Source video file not found at {source_path}")

        duration = max(0.1, end_time - start_time)

        # Use fast seeking before -i and precise duration with -t
        cmd = [
            "ffmpeg",
            "-y",
            "-ss", f"{max(0.0, float(start_time)):.3f}",
            "-i", str(source_path),
            "-t", f"{duration:.3f}",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            str(target_path),
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:
                    pass
            err_msg = getattr(e, "stderr", str(e))
            logger.error(f"FFmpeg clip export failed for {source_path} [{start_time}-{end_time}]: {err_msg}")
            raise RuntimeError(f"FFmpeg clip export failed: {err_msg}")

        if not target_path.exists() or target_path.stat().st_size == 0:
            if target_path.exists():
                target_path.unlink()
            raise RuntimeError(f"Exported clip file is missing or 0 bytes: {target_path}")

        logger.info(f"Successfully exported clip: {target_path} ({duration:.2f}s, {target_path.stat().st_size} bytes)")
        return target_path

    @classmethod
    def verify_generated_proxy(cls, proxy_path: Path | str) -> bool:
        """
        Verify if a proxy file exists, is non-zero, and contains valid playable video streams.

        Args:
            proxy_path: Path to the proxy video file

        Returns:
            bool: True if verified and valid, False otherwise
        """
        path = Path(proxy_path)
        if not path.exists() or not path.is_file():
            return False
        try:
            if path.stat().st_size == 0:
                return False
            meta = cls.extract_metadata(path)
            return bool(meta.get("duration", 0) > 0 and meta.get("video_codec"))
        except Exception:
            return False


MediaProcessor = FFmpegProcessor

