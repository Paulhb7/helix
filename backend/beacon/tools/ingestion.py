"""Manager's content-acquisition tools.

Each tool returns either:
  - {"kind": "...", "url", "title", "text", "truncated"} on success
  - {"error": "<message>"} on failure (network issue, paywall, blocked, etc.)

The Manager LLM reads the dict and decides what to do — explain to the user
what failed instead of throwing 500.
"""
from __future__ import annotations

from beacon.ingest.tiktok import extract_tiktok
from beacon.ingest.web import extract_article as _extract_article
from beacon.ingest.youtube import extract_youtube


def _safe(fn, *args, **kwargs) -> dict:
    try:
        return fn(*args, **kwargs).model_dump()
    except Exception as e:  # noqa: BLE001 — explicitly catch all to expose to the LLM
        return {"error": f"{type(e).__name__}: {e}"}


def fetch_article(url: str) -> dict:
    """Fetch and extract clean text from a web article (any blog, news, Substack).

    Use this for ANY URL that is NOT YouTube or TikTok. Fast (~1-2s).
    Fails gracefully on paywalls or JS-heavy sites.

    Returns: {"kind": "article", "url", "title", "text", "truncated"} on success.
             {"error": "..."} on failure — explain to the user.
    """
    return _safe(_extract_article, url)


def fetch_youtube_transcript(url: str) -> dict:
    """Fetch the captions transcript of a YouTube video.

    Use this for any youtube.com or youtu.be URL. Fast (~1-2s).
    NOTE: This does NOT transcribe audio — it relies on captions. If captions
    are disabled, the call returns an error.

    Returns: {"kind": "youtube", "url", "title", "text", "truncated"} on success.
             {"error": "..."} on failure (no captions, network, etc.).
    """
    return _safe(extract_youtube, url)


def transcribe_tiktok(url: str) -> dict:
    """Download a TikTok video's audio and transcribe it with Gemma 4 E4B.

    Use this for any tiktok.com URL. SLOW: 30-60s for a short video, longer for
    long ones. Requires ffmpeg installed and HuggingFace login (Gemma license
    accepted). The first call also downloads the ~16 GB Gemma 4 E4B model.

    Returns: {"kind": "tiktok", "url", "title", "text", "truncated"} on success.
             {"error": "..."} on failure (IP block, missing ffmpeg, etc.).
    """
    return _safe(extract_tiktok, url)
