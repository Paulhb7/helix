"""WHO/CDC fact-sheet lookup. Fuzzy-matches against a curated mythbuster set.

Two entry points:
  - search_who(query): legacy raw-hits API (kept for tests / advanced use).
  - match_who(claim):  agent-friendly — returns a complete AgentFinding dict
                       ready to be included verbatim in the Investigator's verdict.
"""
from __future__ import annotations

from rapidfuzz import fuzz, process

from beacon.schemas import AgentFinding, Source
from beacon.tools.who_data import WHO_MYTHS

_INDEX = [(m["myth"], m) for m in WHO_MYTHS]


def search_who(query: str, max_results: int = 3, min_score: int = 60) -> dict:
    """Look up the claim against a curated WHO/CDC mythbuster list (raw hits)."""
    matches = process.extract(
        query,
        [m for m, _ in _INDEX],
        scorer=fuzz.token_set_ratio,
        limit=max_results,
    )
    hits = []
    for myth_text, score, idx in matches:
        if score < min_score:
            continue
        m = _INDEX[idx][1]
        hits.append(
            {
                "id": m["id"],
                "url": m["url"],
                "myth": m["myth"],
                "fact": m["fact"],
                "score": int(score),
                "source_type": m["source_type"],
                "topic": m["topic"],
            }
        )
    return {"hits": hits}


def match_who(claim: str, max_results: int = 3) -> dict:
    """Match a claim against WHO/CDC mythbusters and return a ready AgentFinding.

    Pure Python, no LLM. Returns a dict (model_dump of AgentFinding) ready to
    be embedded verbatim in the Investigator's verdict.findings list.

    Score thresholds:
      - < 70  → no_evidence
      - 70-79 → contradicts, confidence "medium"
      - >= 80 → contradicts, confidence "high"
    """
    raw = search_who(claim, max_results=max_results, min_score=70)
    hits = raw["hits"]
    if not hits:
        return AgentFinding(
            agent="who",
            stance="no_evidence",
            confidence="low",
            sources=[],
            summary="No WHO/CDC mythbuster matched.",
        ).model_dump()

    top_score = hits[0]["score"]
    sources = [
        Source(
            id=h["id"],
            url=h["url"],
            title=h["myth"],
            snippet=h["fact"][:200],
            source_type=h["source_type"] if h["source_type"] in ("guideline", "mythbuster") else "mythbuster",
        )
        for h in hits
    ]
    return AgentFinding(
        agent="who",
        stance="contradicts",
        confidence="high" if top_score >= 80 else "medium",
        sources=sources,
        summary=hits[0]["fact"][:200],
    ).model_dump()
