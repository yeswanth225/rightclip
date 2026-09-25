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

### Phase 1 — Foundation ✅
- [x] Repository structure
- [x] Backend skeleton
- [x] Frontend skeleton
- [x] Database setup
- [ ] Basic UI shell

### Phase 2 — Media (Next)
- [ ] Upload pipeline
- [ ] URL ingestion
- [ ] FFmpeg metadata extraction
- [ ] Proxy generation
- [ ] Video playback

### Phase 3 — Transcript Search
- [ ] Whisper integration
- [ ] Timestamped transcription
- [ ] Transcript search

### Phase 4 — Scene Detection
- [ ] PySceneDetect integration
- [ ] Scene thumbnails
- [ ] Scene index

### Phase 5 — Semantic Search
- [ ] Embedding generation
- [ ] Vector search
- [ ] Query understanding

### Phase 6 — Visual Search
- [ ] Vision model integration
- [ ] Visual descriptions
- [ ] Visual embeddings

### Phase 7 — Clip Editor
- [ ] Timeline UI
- [ ] Start/end adjustment
- [ ] Preview with frame stepping
- [ ] Keyboard shortcuts

### Phase 8 — Export
- [ ] FFmpeg clipping
- [ ] Export jobs
- [ ] Quality options
- [ ] Download management

### Phase 9 — UX Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive design
- [ ] Accessibility

## ⚠️ Important Notes

- This application is designed for **authorized media only**
- Do not use to locate, scrape, or redistribute copyrighted content
- All processing happens locally/on your infrastructure
- Privacy-first design

## 📄 License

[To be determined]

## 🤝 Contributing

[To be determined]
