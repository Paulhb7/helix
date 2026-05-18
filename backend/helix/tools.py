"""Helix tools — content fetching + evidence search.

Two groups:

  Preprocessing tools (used by the FastAPI layer for URL ingestion):
    fetch_article(url)              web articles via trafilatura
    fetch_youtube_transcript(url)   YouTube captions; faster-whisper fallback
    analyze_tiktok_audio(url)       TikTok captions (yt-dlp); faster-whisper fallback

  Investigation tools (used by the investigator):
    search_pubmed(query)            NCBI E-utilities, raw abstracts (LLM judges)
    search_who(claim)               WHO factsheets via official Sitefinity API
    search_factcheck(claim)         Google Fact Check Tools, pre-judged finding

Every tool returns a dict. Errors are returned as {"error": "..."} so the LLM
can surface them to the user instead of throwing 500s.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlparse

import httpx
import trafilatura
from rapidfuzz import fuzz, process
from youtube_transcript_api import (
    NoTranscriptFound,
    TranscriptsDisabled,
    YouTubeTranscriptApi,
)

from helix.config import settings
from helix.schemas import AgentFinding, IngestedContent, Source

# ---------------------------------------------------------------------------
# Article extraction (preprocessing)
# ---------------------------------------------------------------------------

_ARTICLE_MAX_CHARS = 20_000


def fetch_article(url: str) -> dict:
    """Fetch and extract clean text from a web article (news, blog, Substack).

    Use this for any URL that is NOT YouTube or TikTok. Fast (~1-2s).
    Fails gracefully on paywalls or JS-heavy sites.

    Returns on success:
      {"kind": "article", "url", "title", "text", "truncated"}
    On failure:
      {"error": "..."}
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return {"error": f"Could not fetch {url} (network error or 404)."}

        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        if not text or not text.strip():
            return {"error": f"No readable article content at {url}."}

        title = None
        try:
            meta = trafilatura.extract_metadata(downloaded)
            if meta and meta.title:
                title = meta.title
        except Exception:  # noqa: BLE001
            pass

        truncated = len(text) > _ARTICLE_MAX_CHARS
        if truncated:
            text = text[:_ARTICLE_MAX_CHARS]

        return IngestedContent(
            kind="article", url=url, title=title, text=text, truncated=truncated
        ).model_dump()
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# YouTube transcript (preprocessing)
# ---------------------------------------------------------------------------

_YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
_YT_LANGS = ["en", "fr", "es", "de", "pt", "it"]
_YT_MAX_CHARS = 30_000


def _youtube_video_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc.endswith("youtu.be"):
        vid = parsed.path.lstrip("/")
        if vid:
            return vid
    if parsed.path.startswith("/shorts/"):
        return parsed.path.split("/")[2]
    qs = parse_qs(parsed.query)
    if "v" in qs and qs["v"]:
        return qs["v"][0]
    raise ValueError(f"Could not parse YouTube video id from {url!r}")


def fetch_youtube_transcript(url: str) -> dict:
    """Fetch the spoken content of a YouTube video.

    Tries captions first (fast). If captions are missing in all supported
    languages, falls back to downloading audio and transcribing with
    faster-whisper; if Whisper fails, Gemma 4 multimodal is the final
    fallback (slow — scales with video length).

    Returns on success:
      {"kind": "youtube", "url", "title", "text", "truncated"}
    On failure:
      {"error": "..."}
    """
    try:
        video_id = _youtube_video_id(url)
    except ValueError as e:
        return {"error": str(e)}

    # ----- Fast path 1: youtube-transcript-api ---------------------------
    try:
        fetched = YouTubeTranscriptApi().fetch(video_id, languages=_YT_LANGS)
        text = " ".join(getattr(s, "text", "").strip() for s in fetched)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            truncated = len(text) > _YT_MAX_CHARS
            if truncated:
                text = text[:_YT_MAX_CHARS]
            return IngestedContent(
                kind="youtube", url=url, title=None, text=text, truncated=truncated
            ).model_dump()
    except (TranscriptsDisabled, NoTranscriptFound):
        pass
    except Exception:  # noqa: BLE001
        # Network glitch, parser hiccup — let yt-dlp try next.
        pass

    # ----- Fast path 2: yt-dlp captions (also gives us title + description) -
    fast: dict = {}
    try:
        fast = _ytdlp_captions(url, _CAPTION_LANGS)
    except Exception:  # noqa: BLE001
        # yt-dlp often hits HTTP 429 on YouTube subtitles. Not fatal: keep going.
        fast = {}

    if fast.get("transcript"):
        text = fast["transcript"]
        truncated = len(text) > _YT_MAX_CHARS
        if truncated:
            text = text[:_YT_MAX_CHARS]
        return IngestedContent(
            kind="youtube", url=url, title=fast.get("title"), text=text, truncated=truncated
        ).model_dump()

    # ----- Slow path: audio transcription (whisper, then Gemma fallback) -
    if problem := _ffmpeg_problem():
        return {"error": f"No captions on this video and audio fallback needs ffmpeg: {problem}"}

    try:
        with tempfile.TemporaryDirectory(prefix="helix-audio-") as tmp:
            audio_path, audio_title, audio_lang = _download_audio_via_ytdlp(url, Path(tmp))
            audio_result = _transcribe_audio(audio_path, language=audio_lang)
    except Exception as e:  # noqa: BLE001
        return {"error": f"Could not transcribe this YouTube video: {type(e).__name__}: {e}"}

    text = audio_result["transcript"]
    truncated = len(text) > _YT_MAX_CHARS
    if truncated:
        text = text[:_YT_MAX_CHARS]

    return IngestedContent(
        kind="youtube",
        url=url,
        title=fast.get("title") or audio_title,
        text=text,
        truncated=truncated,
    ).model_dump()


# ---------------------------------------------------------------------------
# TikTok audio analysis (preprocessing)
# ---------------------------------------------------------------------------

def _ffmpeg_problem() -> str | None:
    """Return a human error if ffmpeg+ffprobe are missing or broken; else None.

    `shutil.which` only checks the PATH — it misses the common Homebrew case
    where the binary is present but its dyld linkage is stale (after a
    dependency upgrade). We probe both binaries with `-version` to catch that.
    """
    for binary in ("ffmpeg", "ffprobe"):
        if not shutil.which(binary):
            return f"{binary} is not on PATH (install with `brew install ffmpeg`)."
        try:
            subprocess.run(
                [binary, "-version"],
                capture_output=True,
                check=True,
                timeout=5,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
            return (
                f"{binary} is installed but fails to run ({type(e).__name__}). "
                "Try `brew reinstall ffmpeg`."
            )
    return None


_WHISPER_MODEL_SIZE = "small"  # ~250MB, multilingual, balanced speed/accuracy
_whisper_lock = Lock()
_whisper_model: object | None = None


def _load_whisper_model() -> object:
    """Lazy-load and cache the faster-whisper model (singleton)."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    with _whisper_lock:
        if _whisper_model is not None:
            return _whisper_model
        from faster_whisper import WhisperModel

        # int8 is the sweet spot on Apple Silicon CPU: fast and accurate.
        _whisper_model = WhisperModel(
            _WHISPER_MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )
        return _whisper_model


# ----- Gemma 4 fallback (multimodal local model) ---------------------------

_GEMMA_AUDIO_MODEL_ID = "google/gemma-4-E2B-it"
_AUDIO_MAX_CHUNK_SECONDS = 28  # under the model's 30s ceiling
_AUDIO_TARGET_SR = 16_000

_gemma_lock = Lock()
_gemma_model: object | None = None
_gemma_processor: object | None = None

_GEMMA_TRANSCRIBE_PROMPT = (
    "Transcribe this audio segment exactly as spoken, in its original language. "
    "Output only the transcript, no preamble, no formatting."
)


def _gemma_device() -> str:
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load_gemma_audio_model() -> tuple[object, object, str]:
    global _gemma_model, _gemma_processor
    if _gemma_model is not None and _gemma_processor is not None:
        return _gemma_model, _gemma_processor, _gemma_device()
    with _gemma_lock:
        if _gemma_model is not None and _gemma_processor is not None:
            return _gemma_model, _gemma_processor, _gemma_device()
        from transformers import AutoModelForMultimodalLM, AutoProcessor
        device = _gemma_device()
        _gemma_processor = AutoProcessor.from_pretrained(_GEMMA_AUDIO_MODEL_ID)
        _gemma_model = AutoModelForMultimodalLM.from_pretrained(
            _GEMMA_AUDIO_MODEL_ID,
            dtype="auto",
            device_map=device if device != "mps" else None,
        )
        if device == "mps":
            _gemma_model = _gemma_model.to(device)
        return _gemma_model, _gemma_processor, device


def _run_gemma_audio_chunk(model, processor, device, chunk, max_tokens: int = 512) -> str:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "audio", "audio": chunk},
                {"type": "text", "text": _GEMMA_TRANSCRIBE_PROMPT},
            ],
        }
    ]
    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
        add_generation_prompt=True,
    ).to(device)
    input_len = inputs["input_ids"].shape[-1]
    outputs = model.generate(**inputs, max_new_tokens=max_tokens, do_sample=False)
    return processor.decode(outputs[0][input_len:], skip_special_tokens=True).strip()


_CAPTION_LANGS = ["en", "fr", "es", "de", "pt", "it"]


def _parse_vtt(text: str) -> str:
    """Strip WEBVTT metadata, timestamps, cue tags. Dedupe consecutive lines."""
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(("WEBVTT", "NOTE", "STYLE", "Kind:", "Language:")):
            continue
        if "-->" in line or line.isdigit():
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if line:
            lines.append(line)
    deduped: list[str] = []
    for line in lines:
        if not deduped or deduped[-1] != line:
            deduped.append(line)
    return " ".join(deduped).strip()


def _ytdlp_captions(url: str, langs: list[str]) -> dict:
    """Fast path: pull title, description and auto-captions via yt-dlp (no video DL).

    Returns {"title", "description", "transcript"} — transcript is "" when no
    captions are available in any of the requested languages.
    """
    import yt_dlp

    with tempfile.TemporaryDirectory(prefix="helix-subs-") as tmp:
        opts = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": langs,
            "subtitlesformat": "vtt",
            "outtmpl": str(Path(tmp) / "%(id)s.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

        title = info.get("title") if isinstance(info, dict) else None
        description = info.get("description") if isinstance(info, dict) else None

        transcript = ""
        for vtt in sorted(Path(tmp).glob("*.vtt")):
            try:
                piece = _parse_vtt(vtt.read_text(encoding="utf-8"))
            except OSError:
                continue
            if piece:
                transcript = piece
                break

    return {"title": title, "description": description, "transcript": transcript}


def _detect_language(*texts: str | None) -> str | None:
    """Best-effort ISO 639-1 language code from one or more text snippets.

    Used to give Whisper a reliable language hint when the audio is short
    and noisy (Whisper's audio-based auto-detect fails badly in that case).
    Returns None if langdetect can't decide or the texts are empty.
    """
    sample = " ".join(t for t in texts if t).strip()
    if len(sample) < 8:
        return None
    try:
        from langdetect import DetectorFactory, detect

        DetectorFactory.seed = 0  # deterministic results
        code = detect(sample)
        return code if isinstance(code, str) else None
    except Exception:  # noqa: BLE001
        return None


def _download_audio_via_ytdlp(url: str, out_dir: Path) -> tuple[Path, str | None, str | None]:
    """Download audio + return (path, title, language_hint).

    The language hint comes from yt-dlp metadata, or — if that's missing,
    which is the TikTok norm — from langdetect on the title + description.
    Whisper's audio-based auto-detect fails on short clips with accented
    speech (English audio often mis-detected as Malay/Indonesian), so this
    text-based pre-detection is the safer signal.
    """
    import yt_dlp

    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(out_dir / "audio.%(ext)s"),
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "wav", "preferredquality": "192"}
        ],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    info_dict = info if isinstance(info, dict) else {}
    title = info_dict.get("title")
    description = info_dict.get("description")
    language = info_dict.get("language") or _detect_language(title, description)
    audio_path = out_dir / "audio.wav"
    if not audio_path.exists():
        candidates = list(out_dir.glob("audio.*"))
        if not candidates:
            raise RuntimeError(f"yt-dlp produced no audio file from {url}")
        audio_path = candidates[0]
    return audio_path, title, language


def _run_whisper_pipeline(audio_path: Path, language: str | None = None) -> dict:
    """Transcribe a local audio file with faster-whisper.

    If `language` is provided (BCP-47 or ISO 639-1 code, e.g. "en", "fr"),
    Whisper is forced to that language — much more reliable than auto-detect
    on short clips with accented speech. Pass None to let Whisper auto-detect.

    Returns {"transcript": str, "language": str|None}. Raises on model load
    or runtime errors — callers wrap in try/except.
    """
    model = _load_whisper_model()
    # Whisper expects 2-letter ISO 639-1 (e.g. "en"), not BCP-47 ("en-US").
    lang_hint = language.split("-")[0].lower() if language else None
    segments, info = model.transcribe(
        str(audio_path),
        beam_size=1,        # greedy: fastest, quality is fine for short clips
        vad_filter=True,    # skip silence; helps on noisy/short audio
        language=lang_hint,
    )
    transcript = " ".join(s.text.strip() for s in segments).strip()
    if not transcript:
        raise RuntimeError("Whisper returned an empty transcript.")
    return {"transcript": transcript, "language": getattr(info, "language", None)}


def _run_gemma_audio_pipeline(audio_path: Path) -> dict:
    """Transcribe a local audio file with the on-device Gemma 4 multimodal model.

    Final fallback when faster-whisper fails (e.g. wrong language detected,
    crash, empty transcript). Requires `pillow` + `torchvision` installed and
    a HuggingFace login with the Gemma 4 license accepted.

    Returns {"transcript": str}. Raises on load/runtime errors.
    """
    import librosa

    audio, sr = librosa.load(str(audio_path), sr=_AUDIO_TARGET_SR, mono=True)
    chunk_size = _AUDIO_MAX_CHUNK_SECONDS * sr
    chunks = [audio[i : i + chunk_size] for i in range(0, len(audio), chunk_size)]
    if not chunks:
        raise RuntimeError("Audio file was empty.")

    model, processor, device = _load_gemma_audio_model()
    pieces = [
        _run_gemma_audio_chunk(model, processor, device, c) for c in chunks
    ]
    transcript = " ".join(p for p in pieces if p).strip()
    if not transcript:
        raise RuntimeError("Gemma returned an empty transcript.")
    return {"transcript": transcript}


def _transcribe_audio(audio_path: Path, language: str | None = None) -> dict:
    """Gemma 4 native audio first, lightweight Whisper fallback for cold-starts/OOM.

    Returns {"transcript": str, "engine": "gemma"|"whisper"}. Raises if both
    engines fail.
    """
    try:
        result = _run_gemma_audio_pipeline(audio_path)
        return {"transcript": result["transcript"], "engine": "gemma"}
    except Exception as gemma_err:
        try:
            result = _run_whisper_pipeline(audio_path, language=language)
            return {"transcript": result["transcript"], "engine": "whisper"}
        except Exception as whisper_err:
            raise RuntimeError(
                f"Audio transcription failed on both engines. "
                f"gemma: {type(gemma_err).__name__}: {gemma_err}; "
                f"whisper fallback: {type(whisper_err).__name__}: {whisper_err}"
            ) from whisper_err

def analyze_tiktok_audio(url: str) -> dict:
    """Fetch the spoken content of a TikTok video.

    FAST PATH (~2s): yt-dlp auto-captions + post description. Used whenever
    the video has captions in a supported language.

    SLOW PATH (~5-15s, only if no captions): downloads the audio with yt-dlp
    and transcribes it. Tries faster-whisper first; if it fails (errors or
    empty output), falls back to Gemma 4 multimodal. Requires ffmpeg on PATH.

    Returns on success:
      {"kind": "tiktok", "url", "title", "description",
       "transcript": <full text in original language>,
       "source": "captions" | "audio:whisper" | "audio:gemma"}
    On failure: {"error": "..."}.
    """
    # ----- Fast path: yt-dlp captions ------------------------------------
    try:
        fast = _ytdlp_captions(url, _CAPTION_LANGS)
    except Exception as e:  # noqa: BLE001
        return {"error": f"yt-dlp could not read this TikTok: {type(e).__name__}: {e}"}

    if fast.get("transcript"):
        return {
            "kind": "tiktok",
            "url": url,
            "title": fast.get("title"),
            "description": fast.get("description"),
            "transcript": fast["transcript"],
            "source": "captions",
        }

    # ----- Slow path: audio transcription (whisper, then Gemma fallback) -
    if problem := _ffmpeg_problem():
        return {"error": f"No captions on this TikTok and audio fallback needs ffmpeg: {problem}"}

    try:
        with tempfile.TemporaryDirectory(prefix="helix-audio-") as tmp:
            audio_path, audio_title, audio_lang = _download_audio_via_ytdlp(url, Path(tmp))
            audio_result = _transcribe_audio(audio_path, language=audio_lang)
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}

    return {
        "kind": "tiktok",
        "url": url,
        "title": fast.get("title") or audio_title,
        "description": fast.get("description"),
        "transcript": audio_result["transcript"],
        "source": f"audio:{audio_result['engine']}",
    }


# ---------------------------------------------------------------------------
# PubMed (investigation)
# ---------------------------------------------------------------------------

_PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
_PUBMED_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def search_pubmed(query: str, max_results: int = 5) -> dict:
    """Search PubMed and return a list of abstracts.

    The caller should translate non-English claims into an English query first.
    The Investigator LLM judges stance from the abstracts.

    Returns: {"hits": [{"pmid", "title", "abstract", "year", "url"}, ...]}
    """
    max_results = max(1, min(int(max_results), 10))
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": str(max_results),
        "retmode": "json",
        "sort": "relevance",
    }
    if settings.ncbi_api_key:
        params["api_key"] = settings.ncbi_api_key
    headers = {"User-Agent": settings.user_agent}

    with httpx.Client(timeout=15.0, headers=headers) as client:
        try:
            r = client.get(_PUBMED_ESEARCH, params=params)
            r.raise_for_status()
            ids = r.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return {"hits": []}
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(ids),
                "rettype": "abstract",
                "retmode": "xml",
            }
            if settings.ncbi_api_key:
                fetch_params["api_key"] = settings.ncbi_api_key
            r = client.get(_PUBMED_EFETCH, params=fetch_params)
            r.raise_for_status()
        except httpx.HTTPError as e:
            return {"hits": [], "error": f"pubmed_http_error: {e}"}

    try:
        root = ET.fromstring(r.text)
    except ET.ParseError as e:
        return {"hits": [], "error": f"pubmed_parse_error: {e}"}

    hits = []
    for art in root.findall(".//PubmedArticle"):
        pmid_el = art.find(".//PMID")
        title_el = art.find(".//ArticleTitle")
        abstract_parts = [(el.text or "") for el in art.findall(".//Abstract/AbstractText")]
        year_el = art.find(".//PubDate/Year") or art.find(".//PubDate/MedlineDate")
        if pmid_el is None or title_el is None:
            continue
        pmid = pmid_el.text or ""
        year = None
        if year_el is not None and year_el.text:
            try:
                year = int(year_el.text[:4])
            except ValueError:
                year = None
        hits.append(
            {
                "pmid": pmid,
                "title": (title_el.text or "").strip(),
                "abstract": " ".join(p.strip() for p in abstract_parts if p).strip(),
                "year": year,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            }
        )
    return {"hits": hits}


# ---------------------------------------------------------------------------
# WHO factsheets (investigation)
# ---------------------------------------------------------------------------

_WHO_API = "https://www.who.int/api/hubs/factsheets"
_WHO_PAGE_SIZE = 100  # API caps $top at 100
_WHO_CACHE_TTL = 24 * 3600  # refresh once a day
_WHO_BASE_URL = "https://www.who.int/news-room/fact-sheets/detail"

_who_cache: dict = {"entries": [], "fetched_at": 0.0}
_who_lock = Lock()


def _load_who_factsheets() -> list[dict]:
    """Fetch (and cache) all WHO factsheets — id, title, urlname, summary.

    Caches in-process for _WHO_CACHE_TTL seconds. Empty on network failure.
    """
    if _who_cache["entries"] and (time.time() - _who_cache["fetched_at"]) < _WHO_CACHE_TTL:
        return _who_cache["entries"]

    with _who_lock:
        if _who_cache["entries"] and (time.time() - _who_cache["fetched_at"]) < _WHO_CACHE_TTL:
            return _who_cache["entries"]

        headers = {"User-Agent": settings.user_agent, "Accept": "application/json"}
        entries: list[dict] = []
        try:
            with httpx.Client(timeout=15.0, headers=headers) as client:
                skip = 0
                while True:
                    r = client.get(
                        _WHO_API,
                        params={
                            "$top": _WHO_PAGE_SIZE,
                            "$skip": skip,
                            "$select": "Id,Title,UrlName,Summary",
                        },
                    )
                    r.raise_for_status()
                    page = r.json().get("value", [])
                    if not page:
                        break
                    entries.extend(page)
                    if len(page) < _WHO_PAGE_SIZE:
                        break
                    skip += _WHO_PAGE_SIZE
        except httpx.HTTPError:
            return _who_cache.get("entries", [])  # fall back to whatever we had

        _who_cache["entries"] = entries
        _who_cache["fetched_at"] = time.time()
        return entries


def search_who(claim: str, max_results: int = 3) -> dict:
    """Search WHO factsheets for content relevant to a claim.

    Fuzzy-matches the claim against the titles of all WHO factsheets (240+
    pages exposed by who.int/api/hubs/factsheets). Returns top matches with
    title + summary so the Investigator LLM can judge whether WHO content
    supports, contradicts, or doesn't directly address the claim.

    Returns: {"hits": [{"id", "url", "title", "summary", "score"}, ...]}
    """
    entries = _load_who_factsheets()
    if not entries:
        return {"hits": [], "error": "who_unavailable"}

    titles = [e.get("Title", "") for e in entries]
    matches = process.extract(
        claim, titles, scorer=fuzz.WRatio, limit=max(1, int(max_results))
    )

    hits = []
    for matched_title, score, idx in matches:
        if score < 40:
            continue
        e = entries[idx]
        urlname = e.get("UrlName", "")
        summary = (e.get("Summary") or "").strip()
        hits.append(
            {
                "id": urlname,
                "url": f"{_WHO_BASE_URL}/{urlname}" if urlname else "https://www.who.int/",
                "title": matched_title,
                "summary": summary[:600],
                "score": int(score),
            }
        )
    return {"hits": hits}


# ---------------------------------------------------------------------------
# Google Fact Check Tools (investigation)
# ---------------------------------------------------------------------------

_FACTCHECK_ENDPOINT = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

# Normalised rating → (stance, is_known_misinfo)
_RATING_TO_STANCE: dict[str, tuple[str, bool]] = {
    "false": ("contradicts", True),
    "pants on fire": ("contradicts", True),
    "mostly false": ("contradicts", True),
    "misleading": ("contradicts", True),
    "incorrect": ("contradicts", True),
    "fake": ("contradicts", True),
    "true": ("supports", False),
    "correct": ("supports", False),
    "mostly true": ("supports", False),
    "mixture": ("mixed", False),
    "half true": ("mixed", False),
    "partly false": ("mixed", False),
}


def _factcheck_raw(query: str, language_code: str, max_results: int) -> dict:
    if not settings.google_factcheck_api_key:
        return {"hits": [], "error": "missing_api_key"}
    params = {
        "query": query,
        "languageCode": language_code,
        "pageSize": max(1, min(int(max_results), 10)),
        "key": settings.google_factcheck_api_key,
    }
    headers = {"User-Agent": settings.user_agent}
    try:
        with httpx.Client(timeout=10.0, headers=headers) as client:
            r = client.get(_FACTCHECK_ENDPOINT, params=params)
            r.raise_for_status()
    except httpx.HTTPError as e:
        return {"hits": [], "error": f"factcheck_http_error: {e}"}

    data = r.json()
    hits = []
    for c in data.get("claims", []):
        for review in c.get("claimReview", []):
            url = review.get("url", "")
            hits.append(
                {
                    "id": url or c.get("text", "")[:40],
                    "url": url,
                    "title": review.get("title") or c.get("text", ""),
                    "publisher": review.get("publisher", {}).get("name", "unknown"),
                    "rating": review.get("textualRating", ""),
                    "review_date": review.get("reviewDate", ""),
                    "claim_text": c.get("text", ""),
                }
            )
    return {"hits": hits[:max_results]}


def search_factcheck(claim: str, language: str = "en", max_results: int = 5) -> dict:
    """Look up the claim in Google Fact Check Tools.

    Pure Python rating mapping, no LLM. Returns a dict (model_dump of
    AgentFinding) ready to be embedded verbatim in the Investigator's verdict.

    The "known_misinfo" flag is set when at least one source had a
    False/Misleading rating — this triggers the "Known misinformation" band.
    """
    raw = _factcheck_raw(claim, language_code=language, max_results=max_results)

    if raw.get("error") == "missing_api_key":
        return AgentFinding(
            agent="factchecker",
            stance="no_evidence",
            confidence="low",
            sources=[],
            summary="No fact-check API key configured.",
        ).model_dump()

    hits = raw.get("hits", [])
    if not hits:
        return AgentFinding(
            agent="factchecker",
            stance="no_evidence",
            confidence="low",
            sources=[],
            summary="No fact-check published for this claim.",
        ).model_dump()

    stance_counts = {"contradicts": 0, "supports": 0, "mixed": 0}
    flagged = False
    sources: list[Source] = []
    summary_bits: list[str] = []

    for h in hits:
        rating_norm = (h.get("rating") or "").strip().lower()
        stance, is_misinfo = _RATING_TO_STANCE.get(rating_norm, ("mixed", False))
        stance_counts[stance] += 1
        if is_misinfo:
            flagged = True
        sources.append(
            Source(
                id=h["id"],
                url=h["url"],
                title=h["title"][:200],
                snippet=f"{h.get('rating', 'unrated')} — {h.get('publisher', '')}",
                source_type="fact_check",
            )
        )
        summary_bits.append(f"{h.get('publisher', '?')}: {h.get('rating', '?')}")

    overall_stance = max(stance_counts, key=stance_counts.get)
    confidence = "high" if len(hits) >= 2 and stance_counts[overall_stance] >= 2 else "medium"

    return AgentFinding(
        agent="factchecker",
        stance=overall_stance,  # type: ignore[arg-type]
        confidence=confidence,  # type: ignore[arg-type]
        sources=sources,
        summary="; ".join(summary_bits[:3])[:300],
        flags=["known_misinfo"] if flagged else [],
    ).model_dump()
