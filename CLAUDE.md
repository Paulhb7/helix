# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Beacon

Beacon is a research prototype that fact-checks public health claims against PubMed, a curated WHO/CDC mythbuster list, and Google Fact Check Tools. It uses Google ADK agents (powered by Gemma models via Ollama or Google AI Studio) to extract claims from text/URL/image input, investigate each claim in parallel, and return sourced verdicts.

## Commands

```bash
source .venv/bin/activate        # activate existing venv
make install                     # create venv + install deps (editable)
make dev                         # uvicorn on :8003 with --reload
make test                        # pytest -v
make lint                        # ruff check backend tests
make ollama-pull                 # pull gemma4:e4b + gemma4:e2b
python -m pytest tests/test_dispatcher.py -k "test_name"  # run single test
```

## Architecture

The backend is a FastAPI app (`backend/beacon/api/main.py`) with three pipeline endpoints:

- **POST /extract** — runs only the Manager agent to extract claims; returns them for user review
- **POST /verify** — takes user-validated claims, fans out Investigators
- **POST /check** — one-shot Manager + Dispatcher (no user-in-the-loop)

Pipeline flow (built in `backend/beacon/pipeline.py`):

1. **Manager** (`agents/manager.py`) — LlmAgent that ingests content (article/YouTube/TikTok via `ingest/`) and extracts up to 4 health claims as JSON into `session.state["claims_json"]`
2. **ClaimsDispatcher** (`agents/dispatcher.py`) — BaseAgent that reads `claims_json`, fans out one Investigator per claim via `asyncio.gather` with semaphore (MAX_PARALLEL=2), writes results to `state["per_claim_verdicts"]`
3. **Investigator** (`agents/investigator.py`) — LlmAgent with tools for PubMed, WHO/CDC matching, and Google Fact Check; produces a `Verdict` JSON into `state["verdict_json"]`

State mutations in BaseAgent subclasses must go through `EventActions.state_delta` — direct `session.state` writes are not persisted by `InMemorySessionService`.

## Model configuration

Two providers configured via `MODEL_PROVIDER` in `.env`:
- `local` — Ollama via LiteLLM (`ollama_chat/` prefix). Requires Ollama running.
- `api` — Google AI Studio via LiteLLM (`gemini/` prefix). Requires `GEMINI_API_KEY`.

Each provider has a standard and fast tier model. The fast tier is used for claim extraction; the standard tier for investigation. See `backend/beacon/agents/model.py`.

## Key types

All in `backend/beacon/schemas.py`: `Claim`, `AgentFinding`, `Verdict` (with `Band` and `Stance` literals), `ClaimResult`, `CheckRequest`/`CheckResponse`.

## Testing

Tests are in `tests/` and avoid network/model calls. They cover deterministic helpers: claim parsing, verdict validation, WHO fuzzy matching, fact-check stance mapping, schema validation. `asyncio_mode = "auto"` is set in pyproject.toml.

## Linting

Ruff with `line-length = 100`, `target-version = "py311"`. Notebooks in tests are excluded.
