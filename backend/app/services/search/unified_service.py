"""Unified multimodal search and ranking service coordinating transcript and visual retrieval"""

import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.media import MediaAsset
from app.models.scene import Scene
from app.models.transcript import TranscriptSegment
from app.models.visual import Keyframe
from app.schemas.search import (
    SearchMatchEvidence,
    SearchMode,
    UnifiedSearchResult,
    UnifiedSearchResponse,
)
from app.services.indexing.visual_service import VisualIndexingService

logger = logging.getLogger(__name__)
settings = get_settings()


class UnifiedSearchService:
    """Orchestrates natural-language search across speech transcripts and visual keyframe vectors"""

    def __init__(self, visual_service: Optional[VisualIndexingService] = None):
        self.visual_service = visual_service or VisualIndexingService()

    @staticmethod
    def _normalize_query_tokens(query: str) -> List[str]:
        """Extract clean alphanumeric query tokens for keyword and lexical matching"""
        # Remove special punctuation and split
        tokens = re.findall(r"\b[a-zA-Z0-9_-]{2,}\b", query.lower())
        # Filter common non-informative English stop words
        stop_words = {
            "the", "a", "an", "and", "or", "in", "on", "at", "of", "to", "for", "with",
            "is", "are", "was", "were", "it", "this", "that", "there", "show", "find",
            "where", "part", "when", "about", "video", "scene", "clip", "moment"
        }
        filtered = [t for t in tokens if t not in stop_words]
        return filtered if filtered else tokens

    def search_transcripts(
        self,
        query: str,
        db: Session,
        media_id: Optional[int] = None,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Search speech transcript segments using token-based fuzzy lexical relevance.
        
        Returns:
            List of transcript match dictionaries with calculated normalized score (0.0 to 1.0)
        """
        clean_query = query.strip().lower()
        if not clean_query:
            return []

        tokens = self._normalize_query_tokens(clean_query)
        if not tokens:
            tokens = [clean_query]

        # Base query
        stmt = db.query(TranscriptSegment)
        if media_id is not None:
            stmt = stmt.filter(TranscriptSegment.media_id == media_id)

        # Retrieve candidate segments
        # 1. First attempt full phrase match or token OR matching via SQL
        candidate_segments: List[TranscriptSegment] = []
        if len(tokens) == 1:
            candidate_segments = stmt.filter(TranscriptSegment.text.ilike(f"%{tokens[0]}%")).all()
        else:
            # Query candidates containing any token
            from sqlalchemy import or_
            filters = [TranscriptSegment.text.ilike(f"%{t}%") for t in tokens]
            candidate_segments = stmt.filter(or_(*filters)).all()

        results: List[Dict[str, Any]] = []

        for seg in candidate_segments:
            seg_text = seg.text.lower()
            
            # Scoring:
            # - Exact phrase containment = 1.0
            # - Token overlap ratio + term frequency
            token_matches = sum(1 for t in tokens if t in seg_text)
            if token_matches == 0:
                continue

            token_ratio = token_matches / len(tokens)
            
            # Phrase bonus if exact continuous words appear
            phrase_bonus = 0.3 if clean_query in seg_text else 0.0
            score = min(1.0, round(token_ratio * 0.7 + phrase_bonus, 4))

            results.append({
                "segment_id": seg.id,
                "media_id": seg.media_id,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
                "text": seg.text,
                "score": score,
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def search_visuals(
        self,
        query: str,
        media_id: Optional[int] = None,
        top_k: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Search visual keyframes via OpenCLIP multimodal vector embedding similarity
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        try:
            raw_matches = self.visual_service.search_similar_keyframes(
                query_text=clean_query,
                top_k=top_k,
                media_id=media_id,
            )
            return raw_matches
        except Exception as e:
            logger.warning(f"Visual search provider error: {e}")
            return []

    def unified_search(
        self,
        query: str,
        db: Session,
        media_id: Optional[int] = None,
        mode: SearchMode = SearchMode.HYBRID,
        limit: Optional[int] = None,
    ) -> UnifiedSearchResponse:
        """
        Execute unified multimodal search, temporal fusing, and ranking.
        """
        t_start = time.perf_counter()
        result_limit = limit or settings.search_default_limit

        clean_query = query.strip()
        if not clean_query:
            return UnifiedSearchResponse(
                query=query,
                mode=mode.value,
                total_results=0,
                latency_ms=0.0,
                transcript_latency_ms=0.0,
                visual_latency_ms=0.0,
                fusion_latency_ms=0.0,
                results=[],
            )

        # 1. Transcript Retrieval
        t_tr_start = time.perf_counter()
        transcript_matches: List[Dict[str, Any]] = []
        if mode in (SearchMode.HYBRID, SearchMode.TRANSCRIPT):
            transcript_matches = self.search_transcripts(
                query=clean_query,
                db=db,
                media_id=media_id,
                limit=30,
            )
        t_tr_latency = round((time.perf_counter() - t_tr_start) * 1000, 2)

        # 2. Visual Retrieval
        t_vis_start = time.perf_counter()
        visual_matches: List[Dict[str, Any]] = []
        if mode in (SearchMode.HYBRID, SearchMode.VISUAL):
            visual_matches = self.search_visuals(
                query=clean_query,
                media_id=media_id,
                top_k=30,
            )
        t_vis_latency = round((time.perf_counter() - t_vis_start) * 1000, 2)

        # 3. Multimodal Fusion & Temporal Grouping
        t_fuse_start = time.perf_counter()
        fused_candidates = self._fuse_and_group_results(
            transcript_matches=transcript_matches,
            visual_matches=visual_matches,
            db=db,
            media_id=media_id,
        )
        t_fuse_latency = round((time.perf_counter() - t_fuse_start) * 1000, 2)

        # Sort and truncate
        fused_candidates.sort(key=lambda x: x.score, reverse=True)
        final_results = fused_candidates[:result_limit]

        total_latency = round((time.perf_counter() - t_start) * 1000, 2)

        return UnifiedSearchResponse(
            query=clean_query,
            mode=mode.value,
            total_results=len(final_results),
            latency_ms=total_latency,
            transcript_latency_ms=t_tr_latency,
            visual_latency_ms=t_vis_latency,
            fusion_latency_ms=t_fuse_latency,
            results=final_results,
        )

    def _fuse_and_group_results(
        self,
        transcript_matches: List[Dict[str, Any]],
        visual_matches: List[Dict[str, Any]],
        db: Session,
        media_id: Optional[int] = None,
    ) -> List[UnifiedSearchResult]:
        """
        Group and fuse nearby evidence based on temporal proximity and scene boundaries.
        """
        # Prefetch media assets and scenes for context
        media_cache: Dict[int, MediaAsset] = {}
        scene_cache: Dict[int, Scene] = {}

        def get_media(m_id: int) -> Optional[MediaAsset]:
            if m_id not in media_cache:
                media_cache[m_id] = db.query(MediaAsset).filter(MediaAsset.id == m_id).first()
            return media_cache[m_id]

        def get_scene(s_id: int) -> Optional[Scene]:
            if s_id not in scene_cache:
                scene_cache[s_id] = db.query(Scene).filter(Scene.id == s_id).first()
            return scene_cache[s_id]

        temporal_window = settings.search_temporal_window_seconds
        w_transcript = settings.search_transcript_weight
        w_visual = settings.search_visual_weight
        w_bonus = settings.search_agreement_bonus
        min_vis = settings.search_min_visual_score

        # Structured candidate cluster representation
        clusters: List[Dict[str, Any]] = []

        # 1. Seed clusters with transcript matches
        for tr in transcript_matches:
            clusters.append({
                "media_id": tr["media_id"],
                "start_time": tr["start_time"],
                "end_time": tr["end_time"],
                "representative_time": round((tr["start_time"] + tr["end_time"]) / 2, 2),
                "transcript_match": tr,
                "visual_matches": [],
                "scene_id": None,
                "scene_index": None,
            })

        # 2. Match or create clusters from visual matches
        for vm in visual_matches:
            sim = vm.get("similarity", 0.0)
            if sim < min_vis:
                continue

            meta = vm.get("metadata", {})
            v_media_id = int(meta.get("media_id", 0))
            v_scene_id = int(meta.get("scene_id", 0)) if meta.get("scene_id") else None
            v_scene_idx = int(meta.get("scene_index", 0)) if meta.get("scene_index") is not None else None
            v_time = float(meta.get("timestamp", 0.0))
            kf_id = int(meta.get("keyframe_id", 0)) if meta.get("keyframe_id") else None
            kf_path = str(meta.get("file_path", ""))

            # Try to associate with an existing nearby cluster in the same media
            matched_cluster = None
            for c in clusters:
                if c["media_id"] == v_media_id:
                    # Check temporal overlap or proximity within temporal_window
                    if (c["start_time"] - temporal_window) <= v_time <= (c["end_time"] + temporal_window):
                        matched_cluster = c
                        break

            if matched_cluster:
                matched_cluster["visual_matches"].append({
                    "keyframe_id": kf_id,
                    "file_path": kf_path,
                    "timestamp": v_time,
                    "similarity": sim,
                    "scene_id": v_scene_id,
                    "scene_index": v_scene_idx,
                })
                # Expand cluster boundaries to envelope visual keyframe
                matched_cluster["start_time"] = min(matched_cluster["start_time"], v_time)
                matched_cluster["end_time"] = max(matched_cluster["end_time"], v_time)
                if v_scene_id and not matched_cluster["scene_id"]:
                    matched_cluster["scene_id"] = v_scene_id
                    matched_cluster["scene_index"] = v_scene_idx
            else:
                # Standalone visual candidate cluster
                clusters.append({
                    "media_id": v_media_id,
                    "start_time": max(0.0, v_time - 2.0),
                    "end_time": v_time + 2.0,
                    "representative_time": v_time,
                    "transcript_match": None,
                    "visual_matches": [{
                        "keyframe_id": kf_id,
                        "file_path": kf_path,
                        "timestamp": v_time,
                        "similarity": sim,
                        "scene_id": v_scene_id,
                        "scene_index": v_scene_idx,
                    }],
                    "scene_id": v_scene_id,
                    "scene_index": v_scene_idx,
                })

        # 3. Score and format results
        results: List[UnifiedSearchResult] = []

        for c in clusters:
            media = get_media(c["media_id"])
            if not media:
                continue

            tr_info = c["transcript_match"]
            vis_list = c["visual_matches"]

            tr_score = tr_info["score"] if tr_info else 0.0
            # Best visual similarity in this cluster
            best_vis = max(vis_list, key=lambda x: x["similarity"]) if vis_list else None
            vis_score = best_vis["similarity"] if best_vis else 0.0

            # Determine agreement
            has_both = (tr_score > 0.0) and (vis_score > 0.0)
            agreement_bonus = w_bonus if has_both else 0.0

            # Composite ranking formula
            if has_both:
                composite_score = (tr_score * w_transcript) + (vis_score * w_visual) + agreement_bonus
                explanation = f"Matched speech transcript ({tr_score:.2f}) and visual scene ({vis_score:.2f})"
            elif tr_score > 0.0:
                composite_score = tr_score * (w_transcript / (w_transcript + w_visual))
                explanation = f"Matched speech transcript segment ({tr_score:.2f})"
            else:
                composite_score = vis_score * (w_visual / (w_transcript + w_visual))
                explanation = f"Matched visual keyframe similarity ({vis_score:.2f})"

            # Lookup scene if not yet identified
            scene_id = c["scene_id"]
            scene_idx = c["scene_index"]
            thumb_path = None

            if best_vis:
                thumb_path = best_vis["file_path"]
                if not scene_id and best_vis.get("scene_id"):
                    scene_id = best_vis["scene_id"]
                    scene_idx = best_vis["scene_index"]

            if scene_id:
                scene_obj = get_scene(scene_id)
                if scene_obj and not thumb_path:
                    thumb_path = scene_obj.thumbnail_path
            elif not thumb_path and media.thumbnail_path:
                thumb_path = media.thumbnail_path

            # Format evidence
            evidence = SearchMatchEvidence(
                transcript_text=tr_info["text"] if tr_info else None,
                transcript_segment_id=tr_info["segment_id"] if tr_info else None,
                transcript_score=round(tr_score, 4),
                keyframe_id=best_vis["keyframe_id"] if best_vis else None,
                keyframe_path=best_vis["file_path"] if best_vis else None,
                visual_similarity=round(vis_score, 4),
                agreement=has_both,
                explanation=explanation,
            )

            result_item = UnifiedSearchResult(
                media_id=media.id,
                media_filename=media.filename,
                scene_id=scene_id,
                scene_index=scene_idx,
                start_time=round(c["start_time"], 2),
                end_time=round(c["end_time"], 2),
                representative_timestamp=round(c["representative_time"], 2),
                thumbnail_path=thumb_path,
                score=round(composite_score, 4),
                evidence=evidence,
            )
            results.append(result_item)

        return results
