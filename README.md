# Beacon

Beacon is a research prototype for checking public health claims against a small set
of evidence sources. It exposes a FastAPI backend and a static web UI where a user
can paste a claim, URL, or screenshot. The current pipeline uses Google ADK agents
to extract health claims, query evidence tools, and return a sourced verdict per
claim.

This repository is an MVP, not a finished passive browser overlay. The original
product direction is still useful, but the code currently shipped here is a desktop
web demo with a backend agent pipeline.

## Why not just ask an LLM?

LLMs are trained on static snapshots of the internet and can confidently produce
incorrect or outdated health information. Beacon does not rely on the model's
training data to judge whether a claim is true. Instead, the Investigator agent
queries **grounded, verified sources at runtime** — PubMed abstracts, a curated
WHO/CDC mythbuster list, and Google Fact Check Tools — and builds its verdict from
those results. The model's role is to read and reason over retrieved evidence, not
to recall facts from memory.

## Current Capabilities

- Accepts `text`, `url`, and `image_b64` through `POST /check`.
- Serves a static UI from `static/` through the FastAPI app.
- Extracts up to four important health claims from an input via a Manager agent.
- Checks each claim with an Investigator agent using:
  - PubMed E-utils for biomedical abstracts.
  - A curated offline WHO/CDC mythbuster list.
  - Google Fact Check Tools, when `GOOGLE_FACTCHECK_API_KEY` is configured.
- Supports article extraction through `trafilatura`.
- Supports YouTube transcript extraction when captions are available.
- Includes TikTok ingestion code that downloads audio and transcribes it locally,
  but this path has heavier runtime requirements and should be treated as
  experimental.

## Important Limitations

- There is no Chrome extension in this repository.
- There is no React/Vite frontend; the UI is vanilla HTML/CSS/JS in `static/`.
- There is no Cochrane integration in the current code.
- The final verdict band is currently produced by the Investigator LLM from tool
  outputs. A deterministic Python verdict combiner is a planned next step, not
  implemented in this checkout.
- The WHO/CDC source is a small hand-curated list in
  `backend/beacon/tools/who_data.py`, not a complete live WHO knowledge base.
- Fact-check lookup requires a Google Fact Check Tools API key. Without it, that
  tool returns `no_evidence`.
- This is not medical advice, not a clinical decision tool, and not a medical
  device. Beacon evaluates public claims, not patients.

## Architecture

```text
text / URL / image
        |
        v
Manager LLM agent
  - fetches article / YouTube / TikTok content when needed
  - extracts 0-4 health claims as JSON
        |
        v
ClaimsDispatcher
  - runs one Investigator per claim
  - limits parallelism to avoid model/API quota spikes
        |
        v
Investigator LLM agent
  - calls PubMed, WHO/CDC myth matching, and Fact Check Tools
  - constructs AgentFinding objects
  - emits a Verdict JSON object
        |
        v
FastAPI response: list[ClaimResult]
```

The most important reliability gap is the final verdict step. The evidence tools
are partly deterministic, but the Investigator still decides the stance, score,
band, and narrative. For a health misinformation product, that should be replaced
with a deterministic combiner that consumes validated `AgentFinding` objects and
is covered by tests.

## Repository Layout

```text
backend/beacon/
  api/main.py              FastAPI app: POST /check, GET /, GET /healthz
  agents/                  ADK Manager, Dispatcher, and Investigator agents
  ingest/                  article, YouTube, TikTok ingestion helpers
  tools/                   PubMed, WHO/CDC, Fact Check, ingestion tool wrappers
  schemas.py               Pydantic request/response/evidence types
  pipeline.py              root ADK SequentialAgent builder

static/
  index.html               static web UI
  app.js                   browser-side request/render logic
  styles.css               UI styling

tests/
  unit tests for deterministic helpers and schemas
```

## Setup

Prerequisites:

- Python 3.11+
- Ollama running locally with the configured model if `MODEL_PROVIDER=local`
- Optional Google Fact Check Tools API key
- Optional NCBI API key for higher PubMed rate limits

```bash
cp .env.example .env
make install
make test
make dev
```

The backend serves the UI at `http://localhost:8003` by default via the Makefile.

Direct API smoke test:

```bash
curl -s -X POST http://localhost:8003/check \
  -H "Content-Type: application/json" \
  -d '{"text":"Drinking lemon water cures stage IV cancer."}' | jq
```

## Configuration

Key environment variables are documented in `.env.example`.

- `MODEL_PROVIDER=local` uses Ollama through LiteLLM.
- `MODEL_PROVIDER=api` uses Google AI Studio through LiteLLM and requires
  `GEMINI_API_KEY`.
- `GOOGLE_FACTCHECK_API_KEY` enables Google Fact Check Tools lookups.
- `NCBI_API_KEY` raises PubMed E-utils rate limits.

## Testing

The unit tests avoid network calls and model calls. They cover deterministic
helpers such as:

- Manager output parsing in the dispatcher.
- Verdict JSON validation behavior.
- WHO/CDC fuzzy myth matching.
- Google Fact Check rating-to-stance mapping.
- Request and response schema validation.

Run:

```bash
python -m pytest -q
```

## Near-Term Roadmap

1. Add `backend/beacon/verdict/combiner.py` and move band/score calculation out
   of the LLM.
2. Add a labelled truth set for known true, false, misleading, and insufficient
   evidence claims.
3. Expand tests around the combiner and source weighting.
4. Return partial errors per claim instead of silently dropping failed
   Investigator runs.
5. Add streaming responses so the UI can show claim results as they complete.
6. Decide whether the browser extension is in scope for this repository, then
   either implement it or remove extension claims from submission material.

## License

Beacon is a research prototype. Add or update the repository license file before
publishing or submitting the project.
