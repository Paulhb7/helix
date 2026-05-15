# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Python backend serves everything ----
FROM python:3.11-slim

WORKDIR /app

# ffmpeg + ffprobe are needed by the YouTube/TikTok audio fallback
# (faster-whisper transcription when captions are unavailable).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY backend/ backend/

RUN pip install --no-cache-dir -e .

# Frontend build served as static files by FastAPI
COPY --from=frontend /app/dist /app/frontend_dist

EXPOSE 8080

CMD ["uvicorn", "helix.api.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
