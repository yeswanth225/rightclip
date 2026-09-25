# ClipFinder Development Guide

## Prerequisites

- Python 3.11+
- Node.js 24+
- FFmpeg 9.0+
- Git

## Project Structure

```
clip/
├── backend/          # FastAPI backend
├── frontend/         # React + TypeScript frontend
├── docs/            # Documentation
└── docker/          # Docker configurations (future)
```

## Backend Setup

### 1. Navigate to backend directory

```bash
cd backend
```

### 2. Create virtual environment

```bash
python -m venv venv
```

### 3. Activate virtual environment

**Windows (Git Bash):**
```bash
source venv/Scripts/activate
```

**Windows (CMD):**
```cmd
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure environment

```bash
cp .env.example .env
# Edit .env if needed
```

### 6. Run backend

```bash
uvicorn app.main:app --reload
```

Backend will be available at: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Frontend Setup

### 1. Navigate to frontend directory

```bash
cd frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env if needed
```

### 4. Run frontend

```bash
npm run dev
```

Frontend will be available at: `http://localhost:5173`

## Running Both Services

### Terminal 1 - Backend
```bash
cd backend
source venv/Scripts/activate  # or venv\Scripts\activate on Windows CMD
uvicorn app.main:app --reload
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8000/api/health
```

### List Media Assets
```bash
GET http://localhost:8000/api/media
```

### Get Media Asset
```bash
GET http://localhost:8000/api/media/{id}
```

## Development Workflow

1. **Start backend** (Terminal 1)
2. **Start frontend** (Terminal 2)
3. **Make changes** to code
4. **Both servers auto-reload** on file changes
5. **Test changes** in browser at `http://localhost:5173`

## Database

Phase 1 uses SQLite for simplicity:
- Database file: `backend/clipfinder.db`
- Automatically created on first run
- No migration commands needed yet

## Troubleshooting

### Backend won't start

**Check Python version:**
```bash
python --version  # Should be 3.11+
```

**Reinstall dependencies:**
```bash
pip install -r requirements.txt --force-reinstall
```

### Frontend won't start

**Check Node version:**
```bash
node --version  # Should be 24+
```

**Clear node_modules:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Cannot connect to backend from frontend

- Verify backend is running on port 8000
- Check CORS settings in `backend/app/main.py`
- Verify Vite proxy in `frontend/vite.config.ts`

### FFmpeg not found

**Windows:**
```bash
ffmpeg -version
```

If not found, add FFmpeg to PATH or reinstall:
```bash
winget install Gyan.FFmpeg
```

## Code Quality

### Backend

**Run tests:**
```bash
pytest
```

**Format code:**
```bash
black app/
```

**Lint code:**
```bash
ruff check app/
```

### Frontend

**Type check:**
```bash
npm run build
```

**Lint:**
```bash
npm run lint
```

## Next Steps

After Phase 1 foundation is working:

1. **Phase 2:** Media upload and URL ingestion
2. **Phase 3:** Transcription pipeline
3. **Phase 4:** Scene detection
4. **Phase 5:** Semantic search
5. **Phase 6:** Visual search
6. **Phase 7:** Clip editor
7. **Phase 8:** Export pipeline
8. **Phase 9:** UX polish

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=sqlite:///./clipfinder.db

# Media Storage
MEDIA_STORAGE_PATH=./media

# Security
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Processing Limits
MAX_UPLOAD_SIZE_MB=2048
MAX_VIDEO_DURATION_SECONDS=7200

# Development
DEBUG=true
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

## Port Configuration

| Service  | Default Port | Configurable? |
|----------|--------------|---------------|
| Backend  | 8000         | Yes (uvicorn --port) |
| Frontend | 5173         | Yes (vite.config.ts) |
| Database | N/A (SQLite) | - |

## Git Workflow

```bash
# Stage changes
git add .

# Commit with meaningful message
git commit -m "feat: add media upload endpoint"

# Push to remote
git push origin main
```

## Documentation

- [Architecture](architecture.md) - System design and component overview
- [API Documentation](api.md) - API endpoints and schemas
- [Security](security.md) - Security considerations and best practices
- [Media Processing](media-processing.md) - FFmpeg pipeline and video processing

## Support

For issues or questions:
1. Check this development guide
2. Review API documentation at `/docs`
3. Check logs in terminal output
4. Review Master Development Prompt for specifications
