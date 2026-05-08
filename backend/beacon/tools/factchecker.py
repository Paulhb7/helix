"""Google Fact Check Tools API client.

Aggregates ClaimReview markup from many fact-checkers (HealthFeedback, Snopes,
Lead Stories, Politifact, etc.). Free tier; needs an API key.

Two entry points:
  - search_factchecks(query): legacy raw-hits API.
  - search_factcheck(claim):  agent-friendly — returns a complete AgentFinding
                              dict with stance, sources, and the known_misinfo
                              flag pre-applied.
"""
from __future__ import annotations

import httpx

from beacon.config import settings
from beacon.schemas import AgentFinding, Source

ENDPOINT = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

# Maps a normalised rating string to (stance, is_known_misinfo).
RATING_TO_STANCE: dict[str, tuple[str, bool]] = {
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


def _normalize_rating(rating: str) -> str:
    return (rating or "").strip().lower()


def search_factchecks(query: str, language_code: str = "en", max_results: int = 5) -> dict:
    """Search ClaimReview-tagged fact-checks (raw hits)."""
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
            r = client.get(ENDPOINT, params=params)
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
    """Look up the claim in Google Fact Check Tools and return a ready AgentFinding.

    Pure Python rating mapping, no LLM. Returns a dict (model_dump of
    AgentFinding) ready to be embedded verbatim in the Investigator's verdict.

    The "known_misinfo" flag is set when at least one source had a False/Misleading
    rating — this triggers the "Known misinformation" band in the Investigator.
    """
    raw = search_factchecks(claim, language_code=language, max_results=max_results)

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

    # Tally stances; pick majority
    stance_counts = {"contradicts": 0, "supports": 0, "mixed": 0}
    flagged = False
    sources: list[Source] = []
    summary_bits: list[str] = []

    for h in hits:
        rating_norm = _normalize_rating(h.get("rating", ""))
        stance, is_misinfo = RATING_TO_STANCE.get(rating_norm, ("mixed", False))
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

    finding = AgentFinding(
        agent="factchecker",
        stance=overall_stance,  # type: ignore[arg-type]
        confidence=confidence,  # type: ignore[arg-type]
        sources=sources,
        summary="; ".join(summary_bits[:3])[:300],
        flags=["known_misinfo"] if flagged else [],
    )
    return finding.model_dump()
