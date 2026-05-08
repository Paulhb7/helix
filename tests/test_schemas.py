import pytest
from pydantic import ValidationError

from beacon.schemas import AgentFinding, CheckRequest, CheckResponse, Claim, ClaimResult, Source, Verdict


def test_check_request_accepts_empty_payload_for_api_level_validation() -> None:
    req = CheckRequest()

    assert req.text is None
    assert req.url is None
    assert req.image_b64 is None


def test_source_rejects_unknown_source_type() -> None:
    with pytest.raises(ValidationError):
        Source(
            id="x",
            url="https://example.test",
            title="Example",
            source_type="blog",
        )


def test_agent_finding_defaults_sources_and_flags() -> None:
    finding = AgentFinding(
        agent="pubmed",
        stance="no_evidence",
        confidence="low",
    )

    assert finding.sources == []
    assert finding.flags == []
    assert finding.summary == ""


def test_check_response_round_trip() -> None:
    claim = Claim(text="Vaccines cause autism.", language="en", domain="vaccines")
    verdict = Verdict(
        band="Contradicted",
        score=-3.0,
        findings=[
            AgentFinding(
                agent="who",
                stance="contradicts",
                confidence="high",
                sources=[
                    Source(
                        id="who-vaccines-autism",
                        url="https://www.who.int/",
                        title="Vaccines and immunization myths and misconceptions",
                        source_type="mythbuster",
                    )
                ],
                summary="WHO does not support this claim.",
            )
        ],
        narrative="The claim is contradicted by public-health evidence.",
        claim=claim,
    )
    response = CheckResponse(
        results=[ClaimResult(claim=claim, verdict=verdict)],
        elapsed_seconds=1.23,
    )

    dumped = response.model_dump()
    loaded = CheckResponse.model_validate(dumped)

    assert loaded.results[0].claim.domain == "vaccines"
    assert loaded.results[0].verdict.band == "Contradicted"
    assert loaded.elapsed_seconds == 1.23
