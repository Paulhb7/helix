"""Model factory — dispatches between Google AI Studio (Gemma via Gemini API) and Ollama.

Switch via MODEL_PROVIDER in .env:
  MODEL_PROVIDER=api    → Google AI Studio (uses GEMMA_API_MODEL, requires GEMINI_API_KEY)
  MODEL_PROVIDER=local  → Ollama (uses OLLAMA_MODEL, requires OLLAMA_API_BASE running)

Pass fast=True to use the lighter tier (GEMMA_API_MODEL_FAST / OLLAMA_MODEL_FAST)
for cheap/quick agents like claim extraction.
"""
from __future__ import annotations

import os

from google.adk.models.lite_llm import LiteLlm

from beacon.config import settings


def gemma(fast: bool = False) -> LiteLlm:
    # LiteLLM honours num_retries with exponential backoff for 429 / 5xx.
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
