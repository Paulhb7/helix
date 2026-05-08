"""Shared Pydantic types for claims, evidence, and verdicts."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Stance = Literal["supports", "contradicts", "mixed", "no_evidence"]
Confidence = Literal["low", "medium", "high"]
SourceType = Literal[
    "systematic_review",
    "primary_study",
    "guideline",
    "fact_check",
    "mythbuster",
]
Band = Literal[
    "Supported",
    "Partially supported",
    "Insufficient evidence",
    "Contradicted",
    "Known misinformation",
]


class Source(BaseModel):
    id: str
    url: str
    title: str
    snippet: str | None = None
    year: int | None = None
    source_type: SourceType


class AgentFinding(BaseModel):
    agent: str
    stance: Stance
    confidence: Confidence
    sources: list[Source] = Field(default_factory=list)
    summary: str = ""
    flags: list[str] = Field(default_factory=list)


ClaimTier = Literal["main", "sub"]


class Claim(BaseModel):
    text: str
    language: str = "en"
    domain: str | None = None  # e.g. "oncology", "vaccines", "nutrition"
    tier: ClaimTier = "main"   # "main" = primary claim; "sub" = supporting/related


class Verdict(BaseModel):
    band: Band
    score: float
    findings: list[AgentFinding]
    narrative: str | None = None
    claim: Claim | None = None


SourceKind = Literal["article", "youtube", "tiktok"]


class IngestedContent(BaseModel):
    kind: SourceKind
    url: str
    title: str | None = None
    text: str
    truncated: bool = False


class ClaimResult(BaseModel):
    claim: Claim
    verdict: Verdict


class CheckRequest(BaseModel):
    """Unified request for the single /check endpoint.

    At least one of text/url/image_b64 must be set. The Manager agent decides
    what to do with the input — text goes straight to claim extraction, URL
    triggers an ingestion tool, image is read via Gemma 4 vision.
    """

    text: str | None = None
    url: str | None = None
    image_b64: str | None = None


class LinkPreviewRequest(BaseModel):
    url: str


class LinkPreviewResponse(BaseModel):
    url: str
    final_url: str
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None


class CheckResponse(BaseModel):
    """Always a list of per-claim verdicts (length 1 for direct text claims,
    up to 3 for multi-claim URLs/transcripts)."""

    results: list[ClaimResult]
    elapsed_seconds: float


# --- two-step UX endpoints ---


class ExtractResponse(BaseModel):
    """Output of POST /extract — claims the user can review/edit before verify."""

    claims: list[Claim]
    elapsed_seconds: float


class VerifyRequest(BaseModel):
    """Input to POST /verify — claims (potentially edited by the user)."""

    claims: list[Claim]
