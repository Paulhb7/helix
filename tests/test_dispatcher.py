import json

from beacon.agents.dispatcher import MAX_CLAIMS, _parse_claims, _parse_verdict, _strip_fence
from beacon.schemas import Claim


def test_strip_fence_accepts_plain_json() -> None:
    assert _strip_fence('{"claims": []}') == '{"claims": []}'


def test_strip_fence_removes_markdown_code_block() -> None:
    raw = '```json\n{"claims": []}\n```'
    assert _strip_fence(raw) == '{"claims": []}'


def test_parse_claims_limits_and_skips_invalid_items() -> None:
    payload = {
        "claims": [
            {"text": "Claim 1", "language": "en", "domain": "nutrition"},
            {"language": "en"},
            {"text": "Claim 2", "language": "fr", "domain": "oncology"},
            {"text": "Claim 3"},
            {"text": "Claim 4"},
            {"text": "Claim 5"},
            {"text": "Claim 6"},
        ]
    }

    claims = _parse_claims(json.dumps(payload))

    assert len(claims) == MAX_CLAIMS - 1
    assert [c.text for c in claims] == ["Claim 1", "Claim 2"]
    assert claims[1].language == "fr"


def test_parse_claims_returns_empty_on_malformed_json() -> None:
    assert _parse_claims("not json") == []
    assert _parse_claims("") == []


def test_parse_verdict_sets_claim_on_valid_payload() -> None:
    claim = Claim(text="Drinking lemon water cures cancer.", language="en")
    raw = json.dumps(
        {
            "band": "Contradicted",
            "score": -2.0,
            "findings": [
                {
                    "agent": "who",
                    "stance": "contradicts",
                    "confidence": "high",
                    "sources": [],
                    "summary": "No evidence supports this cure claim.",
                }
            ],
            "narrative": "The claim is not supported by recognised evidence.",
        }
    )

    verdict = _parse_verdict(raw, claim)

    assert verdict is not None
    assert verdict.claim == claim
    assert verdict.band == "Contradicted"
    assert verdict.findings[0].agent == "who"


def test_parse_verdict_returns_none_on_invalid_payload() -> None:
    claim = Claim(text="A claim")
    assert _parse_verdict('{"band": "Impossible"}', claim) is None
    assert _parse_verdict(None, claim) is None
