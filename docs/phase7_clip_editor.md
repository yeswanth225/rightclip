# Phase 7 — Stabilization & Clip Editor Documentation

## Overview

Phase 7 resolves critical end-to-end integration and asset-loading issues between the React frontend and FastAPI backend, and introduces the dedicated **Clip Editor**.

The Clip Editor empowers users to take an AI-discovered moment (from Unified Multimodal Search or the Media Library) and interactively adjust, preview, and save precise start and end clip boundaries before exporting.

---

## 1. Stabilization & Integration Fixes

### Root Causes Addressed
1. **Multipart Upload Content-Type Mismatch:**
   - Default Axios config set `'Content-Type': 'application/json'` on the client instance, interfering with `FormData` boundary creation during video uploads, leading to `"Unable to upload"`.
   - Fixed by removing global hardcoded `Content-Type` headers and letting Axios / the browser set `multipart/form-data; boundary=...` dynamically.
2. **Missing Clip Model in Mapper Registry:**
   - `MediaAsset.clips` relationship referenced `Clip`, which had not been imported in `app/models/__init__.py`.
   - Exported `Clip` across model registries and added `app/api/clips.py` router to FastAPI.
3. **Asset URL Contract:**
   - Maintained a centralized asset URL resolver `getAssetUrl()` in `src/utils/assets.ts` with cross-platform backslash normalization and Vite proxy routing `/media/*` $\rightarrow$ `http://127.0.0.1:8000/media/*`.

---

## 2. Phase 7 Clip Editor Features

### Workflow
```text
Unified Search Result / Media Detail
  → Click "✂️ Edit Clip"
  → Opens /media/:id/edit-clip (receives AI suggested boundaries)
  → Precise boundary tweaking via timeline drag handles / frame stepping
  → Preview selected interval only
  → Reset to AI suggestion or Save Clip selection
```

### Key Capabilities
- **AI Suggested vs. User-Adjusted Boundaries:** Search result start/end timestamps populate the editor initially with a visual "ghost" indicator of the original AI moment.
- **Interactive Timeline:** Dual boundary drag handles with visual playhead scrubbing.
- **Fine Timestamp Controls:** $\pm0.1\text{s}$ and $\pm1.0\text{s}$ adjustments on both start and end markers.
- **Frame Stepping:** Single frame ($\pm1\text{ frame}$) and multi-frame ($\pm5\text{ frames}$) stepping based on true video FPS.
- **Selected Region Preview:** "🔁 Preview Selected Clip" starts at `start_time` and automatically halts at `end_time`.
- **Keyboard Shortcuts:**
  - `Space`: Play / Pause toggle
  - `I`: Mark Start boundary to current playhead
  - `O`: Mark End boundary to current playhead
  - `←` / `→`: Step backward / forward 1 frame
  - `Shift + ←` / `Shift + →`: Step backward / forward 5 frames
- **Saved Clips Management:** Persists clip boundaries with title and source search evidence in the database (`/api/clips`).

---

## 3. API Contract

### Clip Endpoints (`/api/clips`)
- `POST /api/clips`: Create a new clip selection. Validates $0 \le \text{start\_time} < \text{end\_time} \le \text{duration}$.
- `GET /api/media/{id}/clips`: List all saved clip selections for a media asset.
- `GET /api/clips/{id}`: Retrieve single clip by ID.
- `PUT /api/clips/{id}`: Update clip title or start/end boundaries.
- `DELETE /api/clips/{id}`: Delete a saved clip.

---

## 4. Phase Boundary (Phase 7 vs. Phase 8)

- **Phase 7 (Current):** Interactive trimming, precision boundary adjustment, frame stepping, previewing selected ranges, and clip state persistence.
- **Phase 8 (Future):** Final FFmpeg export jobs, re-encoding pipelines, social media aspect ratio conversions (e.g. 9:16), downloadable MP4 files, and batch exports.
