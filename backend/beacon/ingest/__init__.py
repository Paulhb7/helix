"""URL → text ingestion. Dispatches to the right extractor based on the URL."""
from __future__ import annotations

from urllib.parse import urlparse

from beacon.ingest.tiktok import extract_tiktok
from beacon.ingest.web import extract_article
from beacon.ingest.youtube import YOUTUBE_HOSTS, extract_youtube
from beacon.schemas import IngestedContent

TIKTOK_HOSTS = {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"}


def ingest(url: str) -> IngestedContent:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"Not a valid URL: {url!r}")
    host = parsed.netloc.lower()

    if host in YOUTUBE_HOSTS or host.endswith(".youtube.com"):
        return extract_youtube(url)

    if host in TIKTOK_HOSTS or host.endswith(".tiktok.com"):
        return extract_tiktok(url)

    return extract_article(url)


__all__ = ["ingest"]
