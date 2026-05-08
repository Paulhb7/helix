"""YouTube transcript extraction. V1 only uses captions (no Whisper fallback)."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import (
    NoTranscriptFound,
    TranscriptsDisabled,
    YouTubeTranscriptApi,
)

from beacon.schemas import IngestedContent

YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
PREFERRED_LANGS = ["en", "fr", "es", "de", "pt", "it"]
MAX_CHARS = 30_000


def _video_id(url: str) -> str:
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


def extract_youtube(url: str) -> IngestedContent:
    video_id = _video_id(url)
    try:
        # youtube-transcript-api v1+ uses an instance method `fetch()`.
        fetched = YouTubeTranscriptApi().fetch(video_id, languages=PREFERRED_LANGS)
    except TranscriptsDisabled as e:
        raise RuntimeError(
            "This video has captions disabled. V1 cannot transcribe audio — "
            "try a video with captions, or paste the script as text."
        ) from e
    except NoTranscriptFound as e:
        raise RuntimeError(
            "No transcript found in supported languages. "
            "V1 cannot transcribe audio — try another video."
        ) from e

    # FetchedTranscript is iterable; each entry has a .text attribute.
    text = " ".join(getattr(s, "text", "").strip() for s in fetched)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        raise RuntimeError("Transcript was empty.")

    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS]

    return IngestedContent(
        kind="youtube",
        url=url,
        title=None,  # transcript API doesn't return title; cheap to skip
        text=text,
        truncated=truncated,
    )
