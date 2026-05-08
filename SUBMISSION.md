# Beacon — Devpost / Kaggle submission

> A passive, multimodal fact-checker for health misinformation, powered end-to-end by **Gemma 4**.
> Paste an article, a YouTube link, or a TikTok URL — Beacon extracts the key health claims, lets you review and edit them, then cross-references each one against PubMed, the WHO, and Google Fact Check Tools, and returns a sourced verdict per claim.

**Submitted to:** Gemma 4 for Good · 2026
**Live demo:** http://localhost:8003 (run locally — see *Try it yourself*)
**Code:** https://github.com/<user>/beacon
**Demo video:** *<add link before submission>*
**License:** Apache 2.0

---

## Inspiration

Health misinformation is, per the WHO, one of the leading public-health threats of the 2020s. The numbers are not abstract:

> Anti-vaccine content alone has been linked to **318,000+ preventable deaths** in the United States during COVID-19.
> — *Yale School of Public Health, 2022*

The people most exposed to viral health lies — older adults on WhatsApp, rural communities on Facebook, diaspora groups on TikTok — are also the people **least likely to open a chatbot and ask** whether the cancer cure they just watched is real. They believe it. They share it. They act on it. Sometimes they die from it.

Existing fact-checkers (Snopes, HealthFeedback, AFP Fact Check) do excellent work, but they are **reactive, English-first, and require effort from the user**. We wanted to flip the ergonomics: a tool you point at a single URL — the TikTok someone just sent you — and that returns a sourced answer in under a minute, in your language, with the receipts.

Gemma 4 made it possible to build that tool **without sending the user's content to a remote model**, and **without needing a separate ASR vendor for audio platforms** like TikTok.

Why not just ask an LLM? Because LLMs are trained on static snapshots of the internet and can confidently produce incorrect or outdated health information. Beacon does not rely on the model's training data to judge whether a claim is true. Instead, the Investigator agent queries **grounded, verified sources at runtime** — PubMed abstracts, a curated WHO/CDC mythbuster list, and **Google Fact Check Tools** — and builds its verdict from those results. The model's role is to read and reason over retrieved evidence, not to recall facts from memory.

---

## What it does

Beacon takes any of the following inputs:

| Input | Pipeline |
|---|---|
| **A short claim** ("Lemon water cures stage IV cancer") | direct fact-check |
| **A screenshot** (WhatsApp, Instagram) | Gemma 4 vision → claim extraction → user review → fact-check |
| **An article URL** (any blog, news site, Substack) | trafilatura extraction → multi-claim split → user review → fan-out fact-check |
| **A YouTube URL** | captions → multi-claim split → user review → fan-out fact-check |
| **A TikTok URL** | yt-dlp audio download → **Gemma 4 E4B audio transcription** → multi-claim split → user review → fan-out fact-check |

The UI follows a **two-step flow**: first, the Manager agent extracts claims and shows them to the user for review — the user can edit, remove, or add claims before triggering verification. Then, one Investigator agent per claim runs the evidence tools in parallel.

For long-form content (article, video), Beacon does not return a single hand-wavy verdict. It returns **one verdict per claim** (1 main + up to 2 sub-claims), with one of five bands — *Supported*, *Partially supported*, *Insufficient evidence*, *Contradicted*, *Known misinformation* — each linked to the underlying PubMed abstract, WHO mythbuster, or Google Fact Check Tools article.

When a URL is pasted, the UI also shows a **link preview** (Open Graph metadata, YouTube thumbnail) so the user can confirm the right content before analysis.

---

## How we built it

```
URL / text / image
        │
        ▼
┌─────────────────┐    Gemma 4 multimodal:
│   Manager       │      • image → caption (vision)
│   (LlmAgent)    │      • TikTok audio → transcript (E4B)
└────────┬────────┘      • article → trafilatura
         │               • YouTube → captions API
         ▼               Extracts 1 main + 0-2 sub-claims.
   ┌─────────────┐
   │ User review │   The user can edit, remove, or add
   │  (browser)  │   claims before triggering verification.
   └──────┬──────┘
          │
          ▼ (asyncio.gather, semaphore=2)
┌──────────────────────────────────────────────────┐
│  ClaimsDispatcher (BaseAgent): 1 Investigator    │
│  per claim, dynamic fan-out via Runner           │
│  ┌────────────────────────────────────────────┐  │
│  │ Investigator (LlmAgent, Gemma 4 31B)      │  │
│  │   calls 3 FunctionTools:                   │  │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │   │ PubMed   │ │ WHO/CDC  │ │  Google  │  │  │
│  │   │ E-utils  │ │ fuzzy    │ │ FactCheck│  │  │
│  │   └──────────┘ └──────────┘ └──────────┘  │  │
│  │   Judges stance from abstracts, assembles  │  │
│  │   verdict band + score + narrative.        │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
          │
          ▼
  List of ClaimResult (one per claim)
  → rendered as cards in the UI
```

### Where Gemma 4 lives in the pipeline

| Stage | Model | Why this tier |
|---|---|---|
| Manager: ingestion + claim extraction | Gemma 4 (configurable: 31B or 26B-A4B) | Runs once per input — handles vision, tool calls, and claim selection |
| **TikTok audio → transcript** | **Gemma 4 E4B (audio)** | The only step that uses E4B specifically. We do this entirely on-device — no third-party ASR, no Whisper, no Gemini. |
| Investigator: evidence reasoning + verdict | Gemma 4 (configurable: 31B or 26B-A4B) | Each Investigator reads abstracts, judges stance, selects the verdict band, and writes the narrative — one LLM agent handles all of this per claim |

The WHO/CDC matching and Google Fact Check Tools lookup are **pure Python** (`FunctionTool` wrappers with deterministic stance mapping via `rapidfuzz` and rating tables). The Investigator LLM calls these tools and reads their outputs, but the stance/confidence from WHO and Google Fact Check Tools is computed in code, not by the model.

### Tech stack

- **LLM**: Gemma 4 (31B-it, 26B-A4B-it via Google AI Studio API; **E4B-it locally via HuggingFace `transformers`** for audio)
- **Orchestration**: Google Agent Development Kit (`SequentialAgent`, `BaseAgent`, `LlmAgent` + `FunctionTool`)
- **Backend**: FastAPI + `asyncio` (semaphore-bounded parallel claim checks)
- **Audio**: `yt-dlp` + `ffmpeg` for download, **Gemma 4 E4B** for transcription (28-second auto-chunking under the model's 30s ceiling)
- **Article extraction**: `trafilatura`
- **YouTube**: `youtube-transcript-api` (captions only)
- **Evidence APIs**: NCBI E-utils (PubMed), **Google Fact Check Tools**, curated WHO/CDC mythbusters list (with `rapidfuzz` for fuzzy matching)
- **Frontend**: Vanilla HTML/CSS/JS, no build step, mobile-first responsive design inspired by deepmind.google
- **Type-safety**: Pydantic v2 across all agent boundaries

---

## Challenges we ran into

1. **Ollama does not yet expose audio in its API**, despite Gemma 4 E2B/E4B supporting it natively. We confirmed by reading the Ollama source (`api/types.go`) — the `Message` struct only has an `Images []ImageData` field, no audio. ([open issue #15427](https://github.com/ollama/ollama/issues/15427) since April 2026). We pivoted to **HuggingFace `transformers`** with `AutoModelForMultimodalLM`, which works today and stays 100% Gemma. The trade-off is a heavier first-run setup (~16 GB model download, requires HuggingFace login with the Gemma license accepted).

2. **30-second audio ceiling per Gemma 4 E4B inference call.** TikToks frequently exceed this. We auto-chunk to 28-second segments (with safety margin), transcribe sequentially, then concatenate before passing the transcript to the claim extractor.

3. **One-claim-vs-many architecture.** The original pipeline assumed a single claim per input. A 5-minute video can carry a dozen distinct claims, and presenting them as one global verdict would be misleading. We refactored the pipeline into three builders — `build_extract_agent()` (Manager only, returns claims for user review), `build_verify_agent()` (takes user-validated claims, fans out Investigators), and `build_root_agent()` (one-shot, no user review). The recommended path is the two-step extract → verify flow, where the user reviews and edits claims between the two stages.

4. **Keeping evidence tools deterministic despite stochastic LLMs.** The WHO/CDC matcher uses `rapidfuzz` with fixed score thresholds to produce stance and confidence — no LLM involved. The Google Fact Check Tools wrapper maps textual ratings to stances via a hardcoded rating table. Only PubMed abstract interpretation is left to the Investigator LLM, since judging whether an abstract supports or contradicts a claim genuinely requires language understanding. The final verdict band is still chosen by the Investigator LLM from the assembled findings — a deterministic Python combiner is a planned next step (see roadmap).

5. **Avoiding false confidence.** Health is high-stakes. We never collapse three disagreeing agents into a fake consensus — when evidence conflicts, the band stays *Insufficient evidence* or *Mixed*, and the narrative explicitly says so.

---

## Accomplishments we're proud of

- **End-to-end Gemma 4 across every modality.** Text, image, **and audio** — no Whisper, no Gemini, no third-party ASR. To our knowledge this is one of the first public projects to use Gemma 4 E4B audio for a real consumer use case rather than a demo notebook.
- **Human-in-the-loop claim review.** The two-step UX (extract → user edits → verify) means the user always sees what claims will be checked before the expensive Investigator runs. They can fix misinterpretations, remove irrelevant claims, or add their own — reducing wasted compute and increasing trust.
- **Deterministic evidence tools.** The WHO/CDC matcher and Google Fact Check Tools wrapper produce stance and confidence via pure Python (fuzzy matching + rating tables), not LLM judgment. Only PubMed abstract interpretation requires the model.
- **Privacy by default in `local` mode.** With `MODEL_PROVIDER=local`, no part of the user's content ever leaves the machine — even the TikTok audio is transcribed on-device.
- **Real, working multilingual handling.** Claims in any language are translated to English internally for retrieval, and the user-facing narrative is generated back in the user's language.
- **Verdict-per-claim**, not verdict-per-video. A URL surfaces 1 main + up to 2 sub-claims, and each gets its own card with its own sources.

---

## What we learned

- The Ollama → HF Transformers gap on bleeding-edge modalities is real. For anything more exotic than text + images, going one level lower (`transformers`, `mlx-vlm`, `mediapipe`) is the only realistic path right now.
- ADK's `BaseAgent` is the right escape hatch for the steps you do *not* want an LLM to handle (claim seeding from user-validated input, dynamic parallel dispatch via Runner, format coercion).
- Gemma 4 31B's narrative quality is genuinely good — the explanations cite the right evidence and use careful, hedged language without prompting.
- Audio-first content is a misinformation accelerant. Captions miss most of the dangerous TikTok health content because the speech itself carries the claim, often layered over visuals that contradict it. **Gemma 4 E4B audio is the unlock here.**

---

## What's next for Beacon

- **Browser extension** (Chrome MVP) — passive overlay that flags health claims as you scroll, no clicking required.
- **Deterministic verdict combiner** — move band/score calculation out of the Investigator LLM into a pure Python `BaseAgent` that consumes validated `AgentFinding` objects with tiered source weighting. Same evidence in → same verdict out.
- **Streaming results** — return claim-by-claim verdicts as they finish (SSE), instead of all at once at the end.
- **Whisper fallback** for users who can't run E4B locally — clearly marked as a fallback in the UI.
- **Multilingual evidence base** — currently retrieves English literature; want to add bibliothèques médicales en français and the Cochrane LatAm corpus.
- **Europe PMC integration** — replaces or complements the missing Cochrane source.
- **Reproducibility leaderboard** — automated nightly run of 200 known true / known false claims; track precision/recall/F1 over time.
- **A real ground-truth set.** Today the unit tests cover deterministic helpers (parsing, matching, mapping). We want 200 labelled claims, vetted by physicians and epidemiologists, to evaluate end-to-end accuracy.

---

## Try it yourself

```bash
git clone https://github.com/<user>/beacon
cd beacon

# Setup
cp .env.example .env       # add GEMINI_API_KEY (for text/image) — get one at https://aistudio.google.com/apikey
make install               # ~3 GB download (torch, transformers, ADK, etc.)

# For TikTok audio — first run only
brew install ffmpeg                                          # macOS
huggingface-cli login                                        # accept Gemma license at https://huggingface.co/google/gemma-4-E4B-it
# (the ~16 GB model is downloaded lazily on the first TikTok URL)

# Launch
make dev                   # → http://localhost:8003
```

---

## Built with

`gemma-4` · `transformers` · `google-adk` · `litellm` · `fastapi` · `pydantic` · `httpx` · `trafilatura` · `youtube-transcript-api` · `yt-dlp` · `librosa` · `rapidfuzz` · `vanilla-js`

## Team

*<add team members and contact before submission>*

## Acknowledgements

Standing on the shoulders of giants: NCBI E-utils, the WHO mythbusters, the global fact-checking network (HealthFeedback, Snopes, Lead Stories, AFP Fact Check, Politifact Health), and Yale's [Lifesaving Impact of COVID Vaccines](https://publichealth.yale.edu/news-article/lifesaving-impact-of-covid-vaccines-quantified-in-new-yale-led-study/) study that frames the stakes.

> Research prototype. Beacon evaluates *public claims*, not patients. It is not a clinical decision tool, not a medical device, and never tells anyone what is wrong with their body.
