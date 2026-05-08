"""Runtime config — read from environment, with sensible local defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    # "api" → Google AI Studio (Gemma via Gemini API), "local" → Ollama
    model_provider: str = os.getenv("MODEL_PROVIDER", "local").lower()

    # Google AI Studio
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
    gemma_api_model: str = os.getenv("GEMMA_API_MODEL", "gemma-4-31b-it")
    gemma_api_model_fast: str = os.getenv("GEMMA_API_MODEL_FAST", "gemma-4-26b-a4b-it")

    # Local Ollama
    ollama_api_base: str = os.getenv("OLLAMA_API_BASE", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
    ollama_model_fast: str = os.getenv("OLLAMA_MODEL_FAST", "gemma4:e2b")

    # Evidence APIs
    google_factcheck_api_key: str | None = os.getenv("GOOGLE_FACTCHECK_API_KEY") or None
    ncbi_api_key: str | None = os.getenv("NCBI_API_KEY") or None
    user_agent: str = os.getenv("BEACON_USER_AGENT", "Beacon/0.0.1 (research prototype)")


settings = Settings()
