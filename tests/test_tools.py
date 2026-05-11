"""Tests for the pure-Python tool helpers.

Only deterministic paths are covered — no network, no LLM calls. Network-heavy
tools (search_pubmed, _factcheck_raw HTTP layer, _load_who_factsheets HTTP)
are stubbed via monkeypatching.
"""
from __future__ import annotations

from helix import tools


# ---------------------------------------------------------------------------
# Google Fact Check Tools
# ---------------------------------------------------------------------------


def test_factcheck_missing_key_returns_no_evidence(monkeypatch) -> None:
    monkeypatch.setattr(
        tools, "_factcheck_raw", lambda *_, **__: {"hits": [], "error": "missing_api_key"}
    )

    finding = tools.search_factcheck("Any claim")

    assert finding["agent"] == "factchecker"
    assert finding["stance"] == "no_evidence"
    assert finding["confidence"] == "low"
    assert finding["sources"] == []


def test_factcheck_false_rating_sets_known_misinfo(monkeypatch) -> None:
    def fake(*_, **__):
        return {
            "hits": [
                {
                    "id": "https://example.test/fact-check",
                    "url": "https://example.test/fact-check",
                    "title": "Fact check title",
                    "publisher": "Example Fact Check",
                    "rating": "False",
                    "claim_text": "False health claim",
                },
                {
                    "id": "https://example.test/fact-check-2",
                    "url": "https://example.test/fact-check-2",
                    "title": "Second fact check",
                    "publisher": "Example Fact Check",
                    "rating": "Misleading",
                    "claim_text": "False health claim",
                },
            ]
        }

    monkeypatch.setattr(tools, "_factcheck_raw", fake)

    finding = tools.search_factcheck("False health claim")

    assert finding["stance"] == "contradicts"
    assert finding["confidence"] == "high"
    assert finding["flags"] == ["known_misinfo"]
    assert len(finding["sources"]) == 2


def test_factcheck_mixed_rating_maps_to_mixed(monkeypatch) -> None:
    monkeypatch.setattr(
        tools,
        "_factcheck_raw",
        lambda *_, **__: {
            "hits": [
                {
                    "id": "mixed",
                    "url": "https://example.test/mixed",
                    "title": "Mixed rating",
                    "publisher": "Example",
                    "rating": "Half True",
                    "claim_text": "Partly right claim",
                }
            ]
        },
    )

    finding = tools.search_factcheck("Partly right claim")

    assert finding["stance"] == "mixed"
    assert finding["confidence"] == "medium"
    assert finding["flags"] == []


# ---------------------------------------------------------------------------
# WHO factsheets
# ---------------------------------------------------------------------------


def _stub_who_factsheets(monkeypatch, entries: list[dict]) -> None:
    monkeypatch.setattr(tools, "_load_who_factsheets", lambda: entries)


def test_search_who_returns_top_match_for_relevant_claim(monkeypatch) -> None:
    _stub_who_factsheets(
        monkeypatch,
        [
            {
                "Id": "x1",
                "Title": "Coronavirus disease (COVID-19)",
                "UrlName": "coronavirus-disease-(covid-19)",
                "Summary": "COVID-19 is caused by the SARS-CoV-2 virus.",
            },
            {
                "Id": "x2",
                "Title": "Cancer",
                "UrlName": "cancer",
                "Summary": "Cancer is the uncontrolled growth of abnormal cells.",
            },
        ],
    )

    result = tools.search_who("Does COVID-19 spread through 5G networks?", max_results=2)

    assert result["hits"]
    top = result["hits"][0]
    assert top["id"] == "coronavirus-disease-(covid-19)"
    assert top["url"].endswith("/coronavirus-disease-(covid-19)")
    assert top["score"] >= 40
    assert "COVID-19" in top["title"]
    assert "SARS-CoV-2" in top["summary"]


def test_search_who_filters_low_score_matches(monkeypatch) -> None:
    _stub_who_factsheets(
        monkeypatch,
        [
            {
                "Id": "x1",
                "Title": "Mental health of older adults",
                "UrlName": "mental-health-of-older-adults",
                "Summary": "",
            }
        ],
    )

    result = tools.search_who("The Eiffel Tower is made of iron.", max_results=3)

    assert result["hits"] == []


def test_search_who_returns_error_when_api_unavailable(monkeypatch) -> None:
    _stub_who_factsheets(monkeypatch, [])

    result = tools.search_who("Any claim", max_results=3)

    assert result["hits"] == []
    assert result["error"] == "who_unavailable"
