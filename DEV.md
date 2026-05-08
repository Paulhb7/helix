# Beacon — developer quickstart

This is the V0 backend + minimal web UI. No browser extension yet (per scoping
discussion: the early adopters of V0 are journalists, educators, clinicians, and
moderators — they sit at a desktop; the extension can come later).

## What's in here

```
beacon/
├── backend/beacon/
│   ├── agents/              # ADK LlmAgents + the BaseAgent verdict combiner wrapper
│   ├── tools/               # PubMed E-utils, WHO mythbusters, Google Fact Check Tools
│   ├── verdict/combiner.py  # deterministic tiered-evidence reducer (pure Python)
│   ├── pipeline.py          # Sequential( extractor -> Parallel(3 evidence) -> combiner -> narrative )
│   ├── schemas.py           # Pydantic types
│   └── api/main.py          # FastAPI: POST /check, GET /
├── static/                  # single-page web UI (no build step)
├── tests/test_combiner.py   # unit tests for the deterministic step
└── pyproject.toml
```

## Why 3 evidence agents instead of the 4 in the original README

The pitch promised PubMed + Cochrane + WHO + fact-checker. Cochrane has no
free machine-readable API; the published one is gated. Rather than ship a
fragile scraper, V0 uses three solid sources:

- **PubMed** via NCBI E-utils (free, no key required for low volume).
- **WHO/CDC** via a curated mythbuster list that ships with the repo —
  honest about being curated, citable URLs, fully offline.
- **Google Fact Check Tools API** — aggregates ClaimReview from HealthFeedback,
  Snopes, Lead Stories, Politifact, etc. Free tier, one API key.

Cochrane / Europe PMC integration is a clean follow-up.

## Prereqs

- Python 3.11+
- [Ollama](https://ollama.com/) running locally with `gemma4:e4b` pulled
  (multimodal). The fast tier uses `gemma4:e2b` for claim extraction; both
  are pulled by `make ollama-pull`. Override via `OLLAMA_MODEL` /
  `OLLAMA_MODEL_FAST` in `.env`.
- Optional: a [Google Fact Check Tools API key](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search)
  in `.env`. Without it, the fact-checker agent returns `no_evidence` and the
  pipeline still works.

## Setup

```bash
cd beacon
cp .env.example .env             # edit if you have API keys
make ollama-pull                 # ollama pull gemma4:e4b + gemma4:e2b
make install                     # creates .venv and installs deps
make test                        # runs combiner unit tests (no network, no LLM)
make dev                         # FastAPI on :8000
```

Open http://localhost:8000 in a browser. Paste a claim or attach a screenshot.

## Smoke-test the API directly

```bash
curl -s -X POST http://localhost:8000/check \
  -H "Content-Type: application/json" \
  -d '{"text": "Drinking lemon water cures stage IV cancer.", "language": "en"}' \
  | jq
```

Expected: a `Contradicted` or `Known misinformation` band, with citations
to WHO mythbusters and (if you supplied a Fact Check API key) HealthFeedback.

## How the pipeline runs

1. `claim_extractor` (Gemma 4 E2B, fast tier) reads raw input and emits an atomic English claim.
2. `evidence_fan` (`ParallelAgent`) runs concurrently:
   - `pubmed_agent` — calls `search_pubmed`, reads abstracts, judges stance.
   - `who_agent` — fuzzy-matches against curated WHO/CDC mythbusters.
   - `factchecker_agent` — calls Google Fact Check Tools.
   Each writes JSON to `session.state` under its `output_key`.
3. `verdict_combiner` (`BaseAgent`, deterministic) reads the three findings and
   applies tiered weights to produce a `Verdict` band + score.
4. `narrative_agent` (Gemma 4 E4B) writes a 2-3 sentence plain-language explanation
   in the user's language.

## Tuning the combiner

`backend/beacon/verdict/combiner.py` has the weights and thresholds. The unit
tests in `tests/test_combiner.py` lock in the current behavior. If you adjust
weights, expand the truth-set first, then re-tune.

Goal: ≥200 labelled claims (vs. the 8 currently asserted). Suggested seed —
HealthFC, MM-COVID, or a hand-curated set from the WHO Mythbusters page.

## Known limitations of V0

- **Latency.** End-to-end is 15-40s on a laptop with `gemma4:e4b`. Fine for
  pasting a claim, too slow for a "live overlay" reading scroll. That UX needs
  caching + a smaller extractor model.
- **WHO coverage.** 10 curated myths only. Extend `tools/who_data.py`.
- **Fact-checker without key.** Returns `no_evidence`; combiner still works.
- **Image input.** Wired through but quality depends on Gemma's vision; for
  best results pass plain text when you have it.
- **Multilingual.** Claim extraction translates to English for retrieval; the
  narrative is rendered back in the source language. African-language pilot
  is a follow-up — needs locale-aware mythbuster lists.

## Roadmap (post-MVP)

- Europe PMC integration (replaces or complements Cochrane).
- Truth-set expansion to 200+ claims with precision/recall metrics surfaced
  in CI.
- Streaming responses (SSE) so the UI can show evidence as it lands instead
  of waiting for the whole pipeline.
- Browser extension (Chrome MV3) reading the active tab text — only after
  the desktop UX is dialed in.
