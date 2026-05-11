"""Helix agents — orchestrator + investigator.

Hierarchy (ADK parent/sub-agents):

    orchestrator (LlmAgent, extracts the main claim from text/image)
    └── investigator (LlmAgent, fact-checks via PubMed, WHO, Google Fact Check)

URL ingestion is NOT an agent. It's handled deterministically in the FastAPI
layer (see `helix.api.main._build_user_message`) — when a URL is provided, the
right ingestion function (article / YouTube / TikTok) is called in Python and
the resulting text is passed to the orchestrator as the user message.
"""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools import FunctionTool

from helix import prompts, tools
from helix.config import settings


# ---------------------------------------------------------------------------
# Model factory
# ---------------------------------------------------------------------------


def _gemma(fast: bool = False) -> LiteLlm:
    """LiteLLM-backed Gemma model. fast=True picks the lighter tier."""
    common_kwargs = {"num_retries": 3, "timeout": 90}

    if settings.model_provider == "api":
        if not settings.gemini_api_key:
            raise RuntimeError(
                "MODEL_PROVIDER=api but GEMINI_API_KEY is not set. "
                "Get one at https://aistudio.google.com/apikey"
            )
        os.environ["GEMINI_API_KEY"] = settings.gemini_api_key
        name = settings.gemma_api_model_fast if fast else settings.gemma_api_model
        return LiteLlm(model=f"gemini/{name}", **common_kwargs)

    if settings.model_provider == "local":
        os.environ.setdefault("OLLAMA_API_BASE", settings.ollama_api_base)
        name = settings.ollama_model_fast if fast else settings.ollama_model
        return LiteLlm(model=f"ollama_chat/{name}", **common_kwargs)

    raise RuntimeError(
        f"Unknown MODEL_PROVIDER={settings.model_provider!r}; expected 'api' or 'local'."
    )


# ---------------------------------------------------------------------------
# Sub-agents
# ---------------------------------------------------------------------------


def _make_investigator() -> LlmAgent:
    return LlmAgent(
        name="investigator",
        # fast tier — token-heavy tool turns benefit from the lighter quota bucket
        model=_gemma(fast=True),
        description="Single-claim fact-check via PubMed, WHO and Google Fact Check.",
        instruction=prompts.INVESTIGATOR,
        tools=[
            FunctionTool(tools.search_pubmed),
            FunctionTool(tools.search_who),
            FunctionTool(tools.search_factcheck),
        ],
        output_key="verdict_json",
    )


# ---------------------------------------------------------------------------
# Root agents (one per FastAPI endpoint)
# ---------------------------------------------------------------------------


def build_root_agent() -> LlmAgent:
    """Orchestrator: identifies the main claim and delegates to the Investigator.

    The user message is plain text — either a direct claim, a question to be
    reformulated as a claim, or a transcript / article body (when the API
    layer ingested a URL upstream). Images, if present, are read via the
    orchestrator's native vision.
    """
    return LlmAgent(
        name="orchestrator",
        model=_gemma(),
        description=(
            "Main orchestrator: reads the user message, identifies the key health "
            "claim, and delegates fact-checking to the Investigator sub-agent."
        ),
        instruction=prompts.ORCHESTRATOR,
        sub_agents=[_make_investigator()],
    )
