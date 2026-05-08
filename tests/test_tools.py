from beacon.tools import factchecker
from beacon.tools.factchecker import search_factcheck
from beacon.tools.who import match_who, search_who


def test_who_search_matches_known_myth() -> None:
    result = search_who("COVID-19 mRNA vaccines change human DNA.")

    assert result["hits"]
    assert result["hits"][0]["id"] == "who-covid-vaccines-dna"
    assert result["hits"][0]["score"] >= 70


def test_who_match_returns_agent_finding_for_known_myth() -> None:
    finding = match_who("Drinking lemon water cures cancer.")

    assert finding["agent"] == "who"
    assert finding["stance"] == "contradicts"
    assert finding["confidence"] in {"medium", "high"}
    assert finding["sources"][0]["source_type"] == "guideline"


def test_who_match_returns_no_evidence_for_unrelated_claim() -> None:
    finding = match_who("The Eiffel Tower is made of iron.")

    assert finding["agent"] == "who"
    assert finding["stance"] == "no_evidence"
    assert finding["sources"] == []


def test_factcheck_missing_key_returns_no_evidence(monkeypatch) -> None:
    monkeypatch.setattr(factchecker, "search_factchecks", lambda *_, **__: {"hits": [], "error": "missing_api_key"})

    finding = search_factcheck("Any claim")

    assert finding["agent"] == "factchecker"
    assert finding["stance"] == "no_evidence"
    assert finding["confidence"] == "low"
    assert finding["sources"] == []


def test_factcheck_false_rating_sets_known_misinfo(monkeypatch) -> None:
    def fake_search_factchecks(*_, **__):
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

    monkeypatch.setattr(factchecker, "search_factchecks", fake_search_factchecks)

    finding = search_factcheck("False health claim")

    assert finding["stance"] == "contradicts"
    assert finding["confidence"] == "high"
    assert finding["flags"] == ["known_misinfo"]
    assert len(finding["sources"]) == 2


def test_factcheck_mixed_rating_maps_to_mixed(monkeypatch) -> None:
    monkeypatch.setattr(
        factchecker,
        "search_factchecks",
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

    finding = search_factcheck("Partly right claim")

    assert finding["stance"] == "mixed"
    assert finding["confidence"] == "medium"
    assert finding["flags"] == []
