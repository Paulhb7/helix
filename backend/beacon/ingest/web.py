"""Article extraction via trafilatura. Works on most news / blog / Substack pages."""
from __future__ import annotations

import trafilatura

from beacon.schemas import IngestedContent

MAX_CHARS = 20_000  # cap to keep prompt size sane on long-form articles


def extract_article(url: str) -> IngestedContent:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise RuntimeError(f"Could not fetch {url} (network error or 404).")

    text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
    if not text or not text.strip():
        raise RuntimeError(f"No readable article content found at {url}.")

    title = None
    try:
        meta = trafilatura.extract_metadata(downloaded)
        if meta and meta.title:
            title = meta.title
    except Exception:
        pass

    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS]

    return IngestedContent(
        kind="article",
        url=url,
        title=title,
        text=text,
        truncated=truncated,
    )
