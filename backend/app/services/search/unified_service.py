"""Unified multimodal search and ranking service coordinating transcript, visual, action, and person retrieval"""

import base64
import io
import logging
import math
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Set

from PIL import Image
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
from app.services.embeddings.person_provider import PersonEmbeddingProvider, LocalPersonEmbeddingProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class UnifiedSearchService:
    """Orchestrates natural-language search across speech transcripts, visual keyframe vectors, actions, and person references"""

    def __init__(
        self,
        visual_service: Optional[VisualIndexingService] = None,
        person_provider: Optional[PersonEmbeddingProvider] = None,
    ):
        self.visual_service = visual_service or VisualIndexingService()
        self.person_provider = person_provider or LocalPersonEmbeddingProvider(self.visual_service.embedding_provider)

    @staticmethod
    def _normalize_query_tokens(query: str) -> List[str]:
        """Extract clean alphanumeric query tokens for keyword and lexical matching"""
        clean = query.strip(' "\'“”‘’')
        tokens = re.findall(r"\b[a-zA-Z0-9_-]{2,}\b", clean.lower())
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
        limit: int = 40,
    ) -> List[Dict[str, Any]]:
        """
        Search speech transcript segments using exact phrase, token-overlap, and semantic matching.
        """
        raw_query = query.strip()
        is_quoted = (raw_query.startswith('"') and raw_query.endswith('"')) or (raw_query.startswith("'") and raw_query.endswith("'"))
        clean_query = raw_query.strip(' "\'“”‘’').lower()
        if not clean_query:
            return []

        tokens = self._normalize_query_tokens(clean_query)
        if not tokens:
            tokens = [clean_query]

        stmt = db.query(TranscriptSegment)
        if media_id is not None:
            stmt = stmt.filter(TranscriptSegment.media_id == media_id)

        # Retrieve candidate segments
        from sqlalchemy import or_
        filters = [TranscriptSegment.text.ilike(f"%{t}%") for t in tokens]
        candidate_segments: List[TranscriptSegment] = stmt.filter(or_(*filters)).all()

        results: List[Dict[str, Any]] = []

        for seg in candidate_segments:
            seg_text = seg.text.lower()
            
            token_matches = sum(1 for t in tokens if t in seg_text)
            if token_matches == 0:
                continue

            token_ratio = token_matches / len(tokens)
            
            # Phrase bonus if exact continuous words appear
            exact_phrase = 0.5 if clean_query in seg_text else 0.0
            
            # Partial subphrase score
            subphrase_bonus = 0.0
            words = clean_query.split()
            if len(words) >= 2:
                for i in range(len(words) - 1):
                    pair = f"{words[i]} {words[i+1]}"
                    if pair in seg_text:
                        subphrase_bonus += 0.2

            raw_score = (token_ratio * 0.4) + exact_phrase + subphrase_bonus
            if is_quoted and exact_phrase > 0:
                raw_score = 1.0  # Exact quote match gets full score

            score = min(1.0, round(raw_score, 4))

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
        top_k: int = 40,
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

    def search_action_events(
        self,
        query: str,
        db: Session,
        media_id: Optional[int] = None,
        top_k: int = 40,
    ) -> List[Dict[str, Any]]:
        """
        Natural-language action/event retrieval across scenes and temporal keyframe sequences.
        Actions (e.g. 'character opens the car door', 'man punches another', 'starts running')
        are evaluated using multi-angle prompts and temporal scene consistency across consecutive frames.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        # Generate action-expanded queries to capture progressive motion states
        # e.g., 'character walks into room' -> ['character walks into room', 'person walking into room doorway', 'entering room']
        action_prompts = [clean_query]
        q_lower = clean_query.lower()
        
        if "walk" in q_lower or "enters" in q_lower or "entering" in q_lower:
            action_prompts.append("person walking entering room doorway")
        if "running" in q_lower or "runs" in q_lower or "sprint" in q_lower:
            action_prompts.append("person running action motion scene")
        if "punch" in q_lower or "fight" in q_lower or "hit" in q_lower:
            action_prompts.append("action fighting punch physical altercation martial arts")
        if "phone" in q_lower or "call" in q_lower:
            action_prompts.append("person holding phone making call screen")
        if "door" in q_lower or "car" in q_lower or "vehicle" in q_lower:
            action_prompts.append("person near vehicle car door opening driving")
        if "shake" in q_lower and "hand" in q_lower:
            action_prompts.append("two people shaking hands greeting agreement")
        if "sits" in q_lower or "sitting" in q_lower or "chair" in q_lower:
            action_prompts.append("person sitting down on chair couch")
        if "stands" in q_lower or "standing" in q_lower or "building" in q_lower:
            action_prompts.append("person standing outside building structure")
        if "look" in q_lower or "stare" in q_lower or "turn" in q_lower:
            action_prompts.append("character looking turning around close up")

        # Collect visual matches across action prompt variants
        seen_kf_ids: Set[str] = set()
        aggregated_matches: List[Dict[str, Any]] = []

        for p in action_prompts:
            matches = self.search_visuals(p, media_id=media_id, top_k=top_k)
            for m in matches:
                vid = m.get("id")
                if vid and vid not in seen_kf_ids:
                    seen_kf_ids.add(vid)
                    # Boost score if matched specific action query
                    m["is_action_match"] = True
                    aggregated_matches.append(m)

        return aggregated_matches

    def search_person_reference(
        self,
        reference_image: Image.Image,
        db: Session,
        media_id: Optional[int] = None,
        top_k: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Search video keyframes for appearances of the referenced person/face.
        """
        try:
            # 1. Compute person/face embedding
            ref_vector = self.person_provider.embed_person_image(reference_image)

            # 2. Query vector database for keyframes with matching person features
            filter_criteria = {"media_id": media_id} if media_id is not None else None
            matches = self.visual_service.vector_provider.query_similarity(
                query_vector=ref_vector,
                top_k=top_k,
                filter_criteria=filter_criteria,
            )
            for m in matches:
                m["person_similarity"] = m.get("similarity", 0.0)
            return matches
        except Exception as e:
            logger.warning(f"Person reference search error: {e}")
            return []

    def unified_search(
        self,
        query: Optional[str] = None,
        reference_image_base64: Optional[str] = None,
        db: Session = None,
        media_id: Optional[int] = None,
        mode: SearchMode = SearchMode.HYBRID,
        limit: Optional[int] = None,
    ) -> UnifiedSearchResponse:
        """
        Execute unified multimodal search, fusing text, actions, dialogue, person reference, and scenes.
        """
        t_start = time.perf_counter()
        result_limit = limit or settings.search_default_limit

        clean_query = (query or "").strip()
        ref_image = None

        if reference_image_base64:
            try:
                # Strip data URL prefix if present (e.g. data:image/png;base64,...)
                b64_data = reference_image_base64
                if "," in b64_data:
                    b64_data = b64_data.split(",", 1)[1]
                img_bytes = base64.b64decode(b64_data)
                ref_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            except Exception as e:
                logger.warning(f"Failed to parse base64 reference image: {e}")

        # If neither query nor image provided
        if not clean_query and not ref_image:
            return UnifiedSearchResponse(
                query="",
                mode=mode.value,
                total_results=0,
                latency_ms=0.0,
                results=[],
            )

        # 1. Transcript / Dialogue Retrieval
        t_tr_start = time.perf_counter()
        transcript_matches: List[Dict[str, Any]] = []
        if clean_query and mode in (SearchMode.HYBRID, SearchMode.EVERYTHING, SearchMode.DIALOGUE, SearchMode.TRANSCRIPT):
            transcript_matches = self.search_transcripts(
                query=clean_query,
                db=db,
                media_id=media_id,
                limit=40,
            )
        t_tr_latency = round((time.perf_counter() - t_tr_start) * 1000, 2)

        # 2. Visual / Action Retrieval
        t_vis_start = time.perf_counter()
        visual_matches: List[Dict[str, Any]] = []
        if clean_query:
            if mode in (SearchMode.ACTION, SearchMode.HYBRID, SearchMode.EVERYTHING):
                visual_matches = self.search_action_events(
                    query=clean_query,
                    db=db,
                    media_id=media_id,
                    top_k=40,
                )
            elif mode == SearchMode.VISUAL:
                visual_matches = self.search_visuals(
                    query=clean_query,
                    media_id=media_id,
                    top_k=40,
                )
        t_vis_latency = round((time.perf_counter() - t_vis_start) * 1000, 2)

        # 3. Person Reference Retrieval
        t_pers_start = time.perf_counter()
        person_matches: List[Dict[str, Any]] = []
        if ref_image:
            person_matches = self.search_person_reference(
                reference_image=ref_image,
                db=db,
                media_id=media_id,
                top_k=40,
            )
        t_pers_latency = round((time.perf_counter() - t_pers_start) * 1000, 2)

        # 4. Multimodal Fusion & Temporal Grouping
        t_fuse_start = time.perf_counter()
        fused_candidates = self._fuse_multimodal_moments(
            query=clean_query,
            has_ref_image=ref_image is not None,
            mode=mode,
            transcript_matches=transcript_matches,
            visual_matches=visual_matches,
            person_matches=person_matches,
            db=db,
            media_id=media_id,
        )
        t_fuse_latency = round((time.perf_counter() - t_fuse_start) * 1000, 2)

        fused_candidates.sort(key=lambda x: x.score, reverse=True)
        final_results = fused_candidates[:result_limit]

        total_latency = round((time.perf_counter() - t_start) * 1000, 2)

        display_query = clean_query
        if ref_image and not clean_query:
            display_query = "[Reference Image Search]"
        elif ref_image and clean_query:
            display_query = f"[Image] {clean_query}"

        return UnifiedSearchResponse(
            query=display_query,
            mode=mode.value,
            total_results=len(final_results),
            latency_ms=total_latency,
            transcript_latency_ms=t_tr_latency,
            visual_latency_ms=t_vis_latency,
            person_latency_ms=t_pers_latency,
            fusion_latency_ms=t_fuse_latency,
            results=final_results,
        )

    def _fuse_multimodal_moments(
        self,
        query: str,
        has_ref_image: bool,
        mode: SearchMode,
        transcript_matches: List[Dict[str, Any]],
        visual_matches: List[Dict[str, Any]],
        person_matches: List[Dict[str, Any]],
        db: Session,
        media_id: Optional[int] = None,
    ) -> List[UnifiedSearchResult]:
        """
        Group and fuse nearby multi-channel evidence (visual, action, transcript, person, scene)
        into cohesive temporal moments.
        """
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
        min_vis = settings.search_min_visual_score

        clusters: List[Dict[str, Any]] = []

        def find_or_create_cluster(
            m_id: int,
            timestamp: float,
            scene_id: Optional[int] = None,
            scene_idx: Optional[int] = None,
            duration_pad: float = 2.0,
            max_cluster_duration: float = 10.0,
        ) -> Dict[str, Any]:
            for c in clusters:
                if c["media_id"] == m_id:
                    # Do not merge across different scene cuts
                    if scene_id is not None and c["scene_id"] is not None and scene_id != c["scene_id"]:
                        continue

                    cand_start = min(c["start_time"], max(0.0, timestamp - duration_pad))
                    cand_end = max(c["end_time"], timestamp + duration_pad)
                    
                    # Merge only if temporally close (<= 3.5s gap) and within maximum moment duration
                    if (c["start_time"] - 3.5) <= timestamp <= (c["end_time"] + 3.5) and (cand_end - cand_start) <= max_cluster_duration:
                        c["start_time"] = cand_start
                        c["end_time"] = cand_end
                        if scene_id and not c["scene_id"]:
                            c["scene_id"] = scene_id
                            c["scene_index"] = scene_idx
                        return c

            new_c = {
                "media_id": m_id,
                "start_time": max(0.0, timestamp - duration_pad),
                "end_time": timestamp + duration_pad,
                "representative_time": timestamp,
                "transcript_match": None,
                "visual_matches": [],
                "person_matches": [],
                "scene_id": scene_id,
                "scene_index": scene_idx,
            }
            clusters.append(new_c)
            return new_c

        # 1. Seed clusters with transcript matches (exact spoken utterance window)
        for tr in transcript_matches:
            c = find_or_create_cluster(
                tr["media_id"],
                tr["start_time"],
                duration_pad=0.5,
                max_cluster_duration=max(12.0, (tr["end_time"] - tr["start_time"]) + 2.0),
            )
            c["transcript_match"] = tr
            c["start_time"] = tr["start_time"]
            c["end_time"] = tr["end_time"]
            c["representative_time"] = round(tr["start_time"] + ((tr["end_time"] - tr["start_time"]) * 0.5), 3)

        # 2. Add visual / action matches (tight keyframe moment window)
        for vm in visual_matches:
            sim = vm.get("similarity", 0.0)
            if sim < min_vis:
                continue

            meta = vm.get("metadata", {})
            v_media_id = int(meta.get("media_id", 0))
            v_time = float(meta.get("timestamp", 0.0))
            v_scene_id = int(meta.get("scene_id", 0)) if meta.get("scene_id") else None
            v_scene_idx = int(meta.get("scene_index", 0)) if meta.get("scene_index") is not None else None
            kf_id = int(meta.get("keyframe_id", 0)) if meta.get("keyframe_id") else None
            kf_path = str(meta.get("file_path", ""))

            c = find_or_create_cluster(
                v_media_id,
                v_time,
                scene_id=v_scene_id,
                scene_idx=v_scene_idx,
                duration_pad=2.0,
                max_cluster_duration=8.0,
            )
            c["visual_matches"].append({
                "keyframe_id": kf_id,
                "file_path": kf_path,
                "timestamp": v_time,
                "similarity": sim,
                "scene_id": v_scene_id,
                "scene_index": v_scene_idx,
                "is_action": vm.get("is_action_match", False),
            })
            if not c["transcript_match"]:
                c["start_time"] = min(c["start_time"], max(0.0, v_time - 2.0))
                c["end_time"] = max(c["end_time"], v_time + 2.0)
            if v_scene_id and not c["scene_id"]:
                c["scene_id"] = v_scene_id
                c["scene_index"] = v_scene_idx

        # 3. Add person reference matches (tight reference moment window)
        for pm in person_matches:
            p_sim = pm.get("person_similarity", pm.get("similarity", 0.0))
            if p_sim < 0.15:
                continue

            meta = pm.get("metadata", {})
            p_media_id = int(meta.get("media_id", 0))
            p_time = float(meta.get("timestamp", 0.0))
            p_scene_id = int(meta.get("scene_id", 0)) if meta.get("scene_id") else None
            p_scene_idx = int(meta.get("scene_index", 0)) if meta.get("scene_index") is not None else None
            kf_id = int(meta.get("keyframe_id", 0)) if meta.get("keyframe_id") else None
            kf_path = str(meta.get("file_path", ""))

            c = find_or_create_cluster(
                p_media_id,
                p_time,
                scene_id=p_scene_id,
                scene_idx=p_scene_idx,
                duration_pad=2.0,
                max_cluster_duration=8.0,
            )
            c["person_matches"].append({
                "keyframe_id": kf_id,
                "file_path": kf_path,
                "timestamp": p_time,
                "similarity": p_sim,
                "scene_id": p_scene_id,
                "scene_index": p_scene_idx,
            })
            if not c["transcript_match"]:
                c["start_time"] = min(c["start_time"], max(0.0, p_time - 2.0))
                c["end_time"] = max(c["end_time"], p_time + 2.0)
            if p_scene_id and not c["scene_id"]:
                c["scene_id"] = p_scene_id
                c["scene_index"] = p_scene_idx

        # 4. Score and build moment results
        results: List[UnifiedSearchResult] = []

        for c in clusters:
            media = get_media(c["media_id"])
            if not media:
                continue

            tr_info = c["transcript_match"]
            vis_list = c["visual_matches"]
            pers_list = c["person_matches"]

            tr_score = tr_info["score"] if tr_info else 0.0
            best_vis = max(vis_list, key=lambda x: x["similarity"]) if vis_list else None
            vis_score = best_vis["similarity"] if best_vis else 0.0
            best_pers = max(pers_list, key=lambda x: x["similarity"]) if pers_list else None
            pers_score = best_pers["similarity"] if best_pers else 0.0

            # Action score based on visual match & action cues
            action_score = (vis_score * 1.05) if (best_vis and best_vis.get("is_action")) else (vis_score * 0.9)
            action_score = min(1.0, action_score)

            # Determine active matched modalities
            match_types: List[str] = []
            if tr_score > 0.15:
                match_types.append("dialogue")
            if pers_score > 0.20:
                match_types.append("person")
            if vis_score > 0.20:
                match_types.append("visual")
            if best_vis and best_vis.get("is_action") and action_score > 0.20:
                match_types.append("action")

            if not match_types and (tr_score > 0 or vis_score > 0 or pers_score > 0):
                if tr_score >= vis_score and tr_score >= pers_score:
                    match_types.append("dialogue")
                elif pers_score >= vis_score:
                    match_types.append("person")
                else:
                    match_types.append("visual")

            # Composite ranking tailored to mode & evidence
            has_agreement = len(match_types) >= 2
            agreement_bonus = 0.12 if has_agreement else 0.0

            if mode == SearchMode.DIALOGUE or mode == SearchMode.TRANSCRIPT:
                composite_score = tr_score
                explanation = f"Matched speech dialogue ({tr_score:.2f})"
            elif mode == SearchMode.PERSON:
                composite_score = pers_score
                explanation = f"Matched reference person appearance ({pers_score:.2f})"
            elif mode == SearchMode.ACTION:
                composite_score = (action_score * 0.7) + (tr_score * 0.3) + agreement_bonus
                explanation = f"Matched action/event moment ({action_score:.2f})"
            elif mode == SearchMode.VISUAL:
                composite_score = vis_score
                explanation = f"Matched visual keyframe similarity ({vis_score:.2f})"
            else:
                # Hybrid / Multimodal
                if has_ref_image and query:
                    # Image + Text / Dialogue / Action
                    composite_score = (pers_score * 0.45) + (action_score * 0.35) + (tr_score * 0.20) + agreement_bonus
                    explanation = f"Matched reference person ({pers_score:.2f}) + event/dialogue ({max(action_score, tr_score):.2f})"
                elif has_ref_image:
                    composite_score = pers_score
                    explanation = f"Matched reference person ({pers_score:.2f})"
                elif tr_score > 0 and vis_score > 0:
                    composite_score = (tr_score * 0.45) + (vis_score * 0.45) + agreement_bonus
                    explanation = f"Matched speech dialogue ({tr_score:.2f}) & visual action ({vis_score:.2f})"
                elif tr_score > 0:
                    composite_score = tr_score
                    explanation = f"Matched speech dialogue segment ({tr_score:.2f})"
                else:
                    composite_score = vis_score
                    explanation = f"Matched visual scene moment ({vis_score:.2f})"

            # Lookup thumbnail
            thumb_path = None
            if best_pers and best_pers.get("file_path"):
                thumb_path = best_pers["file_path"]
            elif best_vis and best_vis.get("file_path"):
                thumb_path = best_vis["file_path"]

            scene_id = c["scene_id"]
            scene_idx = c["scene_index"]
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
                keyframe_id=(best_vis["keyframe_id"] if best_vis else (best_pers["keyframe_id"] if best_pers else None)),
                keyframe_path=(best_vis["file_path"] if best_vis else (best_pers["file_path"] if best_pers else None)),
                visual_similarity=round(vis_score, 4),
                person_score=round(pers_score, 4),
                action_score=round(action_score, 4),
                agreement=has_agreement,
                match_types=match_types,
                explanation=explanation,
            )

            # Calculate and clamp moment boundaries against media duration
            st = max(0.0, c["start_time"])
            et = c["end_time"]
            if media.duration and media.duration > 0:
                et = min(media.duration, et)
                st = min(st, max(0.0, media.duration - 0.1))
            if st >= et:
                et = st + 1.0 if not media.duration else min(media.duration, st + 1.0)

            rep_t = c["representative_time"]
            if best_vis and best_vis.get("timestamp") is not None:
                rep_t = best_vis["timestamp"]
            elif best_pers and best_pers.get("timestamp") is not None:
                rep_t = best_pers["timestamp"]
            elif tr_info and tr_info.get("start_time") is not None:
                rep_t = tr_info["start_time"]

            if media.duration and media.duration > 0:
                rep_t = min(media.duration, max(0.0, rep_t))

            result_item = UnifiedSearchResult(
                media_id=media.id,
                media_filename=media.filename,
                scene_id=scene_id,
                scene_index=scene_idx,
                start_time=round(st, 2),
                end_time=round(et, 2),
                representative_timestamp=round(rep_t, 2),
                thumbnail_path=thumb_path,
                score=round(composite_score, 4),
                evidence=evidence,
            )
            results.append(result_item)

        return results
