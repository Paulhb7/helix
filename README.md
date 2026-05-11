# Helix

Helix is a research prototype that fact-checks public health claims against
peer-reviewed literature, official public-health bodies, and the global
fact-checking network. It exposes a FastAPI backend and a React frontend where
a user can paste a claim, drop a URL (article, YouTube, TikTok), or attach a
screenshot. A two-agent Google ADK pipeline — an Orchestrator and an
Investigator — identifies the main testable claim and produces a sourced verdict.

This repository is a desktop web demo. The original "passive browser overlay"
product direction is still on the roadmap but is not implemented here.

## Why not just ask an LLM?

LLMs are trained on static snapshots of the internet and can confidently produce
incorrect or outdated health information. Helix does not rely on the model's
training data to judge whether a claim is true. Instead, the Investigator agent
queries **grounded, verified sources at runtime** — PubMed abstracts, WHO
factsheets, and Google Fact Check Tools — and builds its verdict from those
results. The model's role is to read and reason over retrieved evidence, not to
recall facts from memory.

## Current capabilities

- Accepts `text`, `url`, and `image_b64` through `POST /check`.
- URL ingestion is deterministic and routed by host:
  - Web articles via `trafilatura`.
  - YouTube via `youtube-transcript-api`, with a `yt-dlp` + `faster-whisper`
    fallback when captions are missing.
  - TikTok via `yt-dlp` captions, with the same audio-transcription fallback.
- Image input is read by Gemma 4 vision directly.
- Identifies the single most important health claim and fact-checks it via
  three independent evidence tools:
  - **PubMed** (NCBI E-utilities) for biomedical abstracts.
  - **WHO factsheets** via the official Sitefinity API.
  - **Google Fact Check Tools**, when `GOOGLE_FACTCHECK_API_KEY` is configured.
- React/Vite frontend with a landing page, check flow, methodology page,
  per-claim report cards, and a small gallery of pre-computed sample reports.
- Containerized for Cloud Run via the multi-stage Dockerfile in `docker/`.

## Important limitations

- There is no Chrome extension in this repository.
- The verdict band, score, and narrative are produced by the Investigator LLM
  from validated tool outputs. The tools themselves are pure Python and tested.
- The Google Fact Check lookup requires an API key. Without it, that tool
  returns `no_evidence` and the pipeline still works on PubMed + WHO.
- This is not medical advice, not a clinical decision tool, and not a medical
  device. Helix evaluates public claims, not patients.

## Architecture

```text
text / URL / image
        |
        v
FastAPI layer (helix/api/main.py)
  - deterministic URL ingestion → article / YouTube / TikTok text
  - assembles the user message (text, image, ingested body)
        |
        v
Orchestrator (LlmAgent, Gemma 4 standard tier)
  - picks the SINGLE main testable claim
  - normalizes to English, tags language + domain
  - transfers control to the Investigator sub-agent
        |
        v
Investigator (LlmAgent, Gemma 4 fast tier)
  - calls search_pubmed, search_who, search_factcheck in parallel
  - builds three AgentFinding entries (one per source)
  - emits a Verdict JSON: band, score, findings, narrative, overall assessment
        |
        v
FastAPI response: CheckResponse { results: list[ClaimResult], elapsed_seconds }
```

URL ingestion is intentionally not an agent — it's plain Python in the API
layer, which keeps it fast, deterministic, and easy to test.

## Repository layout

```text
backend/helix/
  api/main.py              FastAPI app: /check, /ingest, /preview, /health, /mode
  agent.py                 Orchestrator + Investigator (ADK LlmAgents)
  tools.py                 Article, YouTube, TikTok ingestion + PubMed/WHO/FactCheck search
  prompts.py               Orchestrator and Investigator instructions
  schemas.py               Pydantic request/response/evidence types
  config.py                .env-backed runtime settings

frontend/
  src/
    App.jsx                Routes (landing, check, methodology, about, reports)
    components/            CheckPage, CheckForm, Results, AgentLoader, Methodology, ...
    api/helix.js           Backend client
  public/                  Static assets (animated background, sample report images)
  vite.config.js

docker/
  Dockerfile               Multi-stage: build frontend, serve via FastAPI
  cloudbuild.yaml          Cloud Build config
  nginx.conf               Reverse proxy (when serving behind nginx)
  supervisord.conf

tests/
  test_schemas.py          Pydantic schema validation
  test_tools.py            Deterministic tool helpers (no network, no LLM)
  test_e2e.ipynb           Hand-run end-to-end notebook
```

## Setup

Prerequisites:

- Python 3.11+
- Node 20+ (for the frontend)
- Ollama running locally with the configured model if `MODEL_PROVIDER=local`
- Optional: Google Fact Check Tools API key
- Optional: NCBI API key for higher PubMed rate limits

```bash
cp .env.example .env
make install                                  # creates .venv, installs backend
make dev                                      # FastAPI on :8003
# in another shell:
cd frontend && npm install && npm run dev     # Vite on :5173
```

Direct API smoke test:

```bash
curl -s -X POST http://localhost:8003/check \
  -H "Content-Type: application/json" \
  -d '{"text":"Drinking lemon water cures stage IV cancer."}' | jq
```

### Container build (Cloud Run / local Docker)

```bash
docker build -f docker/Dockerfile -t helix .
docker run --rm -p 8080:8080 --env-file .env helix
```

The image builds the React frontend in stage 1 and serves the bundle from the
FastAPI app in stage 2, so a single container handles both the API and the UI.

## Configuration

Key environment variables are documented in `.env.example`.

- `MODEL_PROVIDER=local` uses Ollama through LiteLLM (default).
- `MODEL_PROVIDER=api` uses Google AI Studio through LiteLLM and requires
  `GEMINI_API_KEY`.
- `GOOGLE_FACTCHECK_API_KEY` enables Google Fact Check Tools lookups.
- `NCBI_API_KEY` raises PubMed E-utils rate limits from 3 to 10 req/s.

Each provider exposes a standard tier (used by the Orchestrator) and a fast
tier (used by the Investigator, which makes more tool-heavy turns).

## Testing

The unit tests avoid network and model calls. They cover:

- Pydantic schema validation (`CheckRequest`, `Verdict`, `Source`, …).
- Google Fact Check rating-to-stance mapping and the `known_misinfo` flag.
- Deterministic helpers in `tools.py` (fuzzy WHO match, content parsing).

```bash
python -m pytest -q
```

The `tests/test_e2e.ipynb` notebook drives the full pipeline against a small
set of claims; it requires a running model backend and is not run in CI.

## License

Helix is a research prototype. Add or update the repository license file
before publishing or submitting the project.
