"""Beacon pipelines (Google ADK).

Three builders, all returning SequentialAgent instances:

  build_root_agent()    — Manager + Dispatcher (one-shot, used by /check)
  build_extract_agent() — Manager only (used by /extract)
  build_verify_agent()  — ClaimsSeeder + Dispatcher (used by /verify)

The two-step UX (extract → user reviews → verify) is the recommended path:
the user can edit the Manager's claims before they trigger N Investigator runs.
"""
from __future__ import annotations

from google.adk.agents import SequentialAgent

from beacon.agents.claims_seeder import ClaimsSeeder
from beacon.agents.dispatcher import ClaimsDispatcher
from beacon.agents.manager import build as build_manager


def build_root_agent() -> SequentialAgent:
    return SequentialAgent(
        name="beacon_pipeline",
        sub_agents=[build_manager(), ClaimsDispatcher()],
        description="Manager ingests + selects claims; Dispatcher fans out N Investigators.",
    )


def build_extract_agent() -> SequentialAgent:
    return SequentialAgent(
        name="beacon_extract",
        sub_agents=[build_manager()],
        description="Manager only — returns the claims for user review.",
    )


def build_verify_agent() -> SequentialAgent:
    return SequentialAgent(
        name="beacon_verify",
        sub_agents=[ClaimsSeeder(name="claims_seeder"), ClaimsDispatcher()],
        description="Seed user-validated claims, then fan out N Investigators.",
    )
