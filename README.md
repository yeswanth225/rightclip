# ClipFinder

**AI-powered video search and clipping platform**

ClipFinder allows users to upload or provide authorized video sources, search videos using natural language, find relevant moments using transcript + visual + semantic search, preview/adjust matching clips, and export them.

## 🎯 Core Idea

**Google Search + ChatGPT + video editor + AI vision** — specifically for video.

Instead of manually watching a 2-hour video:
1. Upload/select video
2. Ask what you want in natural language
3. AI understands the video (transcript + visual + semantic)
4. Find relevant moments
5. Preview and adjust
6. Export high-quality clips

## 🏗️ Architecture

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Python 3.11 + FastAPI
- **Database:** SQLite (dev) → PostgreSQL + pgvector (production)
- **Job Queue:** Redis + Celery (Phase 2+)
- **Media Processing:** FFmpeg
- **AI/ML:** Local-first with provider abstractions

## 📋 Current Status

**Phase 1 - Foundation** ✅ In Progress
- Project structure
- Backend API foundation
- Frontend foundation
- Database setup
- Basic routing

## 🚀 Quick Start

### Direct Single-Command Startup

#### 1. Run Backend Server (Direct Single Command)

From the `backend` folder:
```powershell
# Windows (direct via virtualenv binary):
.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Linux/macOS:
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Or from the project repository root (`rightclip`):
```powershell
# Windows single command from root:
.\backend\.venv\Scripts\uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload

# Linux/macOS single command from root:
./backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

> **Backend API Docs:** Interactive Swagger UI available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

#### 2. Run Frontend Dev Server (Direct Single Command)

From the `frontend` folder:
```bash
npm run dev
```

> **Web Application:** Accessible at [http://localhost:5173](http://localhost:5173)

---

### Prerequisites & First-Time Setup

* **Python 3.11+**
* **Node.js 20+**
* **FFmpeg 7.0+ / 9.0+**

```bash
# 1. Backend environment setup (first time only)
cd backend
python -m venv .venv
# Activate:
.venv\Scripts\activate   # Windows
source .venv/bin/activate # Linux/macOS

pip install -r requirements.txt

# 2. Frontend setup (first time only)
cd ../frontend
npm install
```

### Environment Variables

Copy `.env.example` to `.env` in `backend/`:

```env
# Database
DATABASE_URL=sqlite:///./clipfinder.db

# Media Storage
MEDIA_STORAGE_PATH=./media

# Security & CORS
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Processing Limits
MAX_UPLOAD_SIZE_MB=2048
MAX_VIDEO_DURATION_SECONDS=7200
```


## 📖 Documentation

- [Architecture](docs/architecture.md)
- [Development Guide](docs/development.md)
- [API Documentation](docs/api.md)
- [Media Processing](docs/media-processing.md)
- [Security](docs/security.md)

## 🛠️ Development Phases

## 📖 Search Capabilities & Multimodal Architecture

ClipFinder provides unified AI-powered video moment retrieval combining:
1. **Natural-Language Action / Event Search:** Finds physical actions, motion transitions, and scene events over time (e.g., *"character opens the car door and gets inside"*).
2. **Dialogue Search:** Exact and semantic matching across Whisper/faster-whisper spoken speech segments.
3. **Person / Reference Search:** Face and appearance matching via reference photos across indexed keyframes.
4. **Image + Text Multimodal Search:** Combines person identity with physical action or dialogue prompts (e.g., `[Photo]` + *"when this person enters the room"*).
5. **Temporal Moment Retrieval:** Instead of returning isolated raw frames, results represent temporal moments enveloped with visual evidence, dialogue quotes, person evidence, and scene context.

```text
                         USER QUERY
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
          TEXT             IMAGE           PERSON
             │                │             REF
             ▼                ▼                ▼
       Query Analysis     Visual Query    Face/Person
             │             Embedding       Embedding
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                       Retrieval Layer
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
        Transcript         Visual            Person
        Retrieval         Retrieval         Retrieval
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
                      Temporal Fusion
                              │
                              ▼
                     Event / Moment Groups
                              │
                              ▼
                        Final Ranking
                              │
                              ▼
                     Timestamped Results
```

## 🛠️ Development Status

- [x] Phase 1 — Foundation (FastAPI + React 18 + Database)
- [x] Phase 2 — Media ingestion, FFmpeg proxy & thumbnail processing
- [x] Phase 3 — Whisper speech-to-text transcription & timestamping
- [x] Phase 4 — PySceneDetect scene boundary detection
- [x] Phase 5 — OpenCLIP ViT-B/32 keyframe indexing & ChromaDB vector storage
- [x] Phase 6 — Unified multimodal search (Action, Dialogue, Visual, Person Reference)
- [x] Phase 7 — Precision Clip Editor (boundary scrubbing & saved clips)
- [x] Phase 8 — Physical MP4 Sub-Clip Export, Trimming & UI/UX Product Polish


## ⚠️ Important Notes

- This application is designed for **authorized media only**
- Do not use to locate, scrape, or redistribute copyrighted content
- All processing happens locally/on your infrastructure
- Privacy-first design

## 📄 License

[To be determined]

## 🤝 Contributing

[To be determined]
