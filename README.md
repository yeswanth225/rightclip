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

### Prerequisites

- Python 3.11+
- Node.js 24+
- FFmpeg 9.0+
- Git

### Installation

```bash
# Clone repository
git clone <repo-url>
cd clip

# Backend setup
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head

# Run backend
uvicorn app.main:app --reload

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=sqlite:///./clipfinder.db

# Media Storage
MEDIA_STORAGE_PATH=./media

# Security
ALLOWED_ORIGINS=http://localhost:5173

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
- [x] Phase 3 — Whisper / faster-whisper speech transcription & timestamping
- [x] Phase 4 — PySceneDetect scene boundary detection
- [x] Phase 5 — OpenCLIP ViT-B/32 keyframe indexing & ChromaDB vector storage
- [x] Phase 6 — Unified transcript + visual rank fusion
- [x] Phase 6.5 — Temporal Action Search, Semantic Dialogue, Person Reference, & Search UX Redesign
- [x] Phase 7 — Precision Clip Editor (boundary trimming & save clip selection)
- [ ] Phase 8 — FFmpeg Clip Export & Render Jobs

## ⚠️ Important Notes

- This application is designed for **authorized media only**
- Do not use to locate, scrape, or redistribute copyrighted content
- All processing happens locally/on your infrastructure
- Privacy-first design

## 📄 License

[To be determined]

## 🤝 Contributing

[To be determined]
