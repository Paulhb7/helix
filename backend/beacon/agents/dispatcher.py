"""ClaimsDispatcher — fans out N Investigators in parallel, one per claim.

Reads state["claims_json"] (set by the Manager). For each claim, spins up a
fresh Runner + InMemorySession running the Investigator agent, in parallel via
asyncio.gather (semaphore-bounded). Collects the verdicts into
state["per_claim_verdicts"].

The Investigator is declared as `sub_agent` for ADK lineage / introspection,
but invoked dynamically via Runner — this is the supported way to do dynamic
parallel fan-out in ADK without a static ParallelAgent.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import ValidationError

from beacon.agents.investigator import build as build_investigator
from beacon.schemas import Claim, ClaimResult, Verdict

APP_NAME = "beacon"
MAX_CLAIMS = 3   # 1 main + up to 2 sub
# Lowered from 4 → 2 to stay under Google AI Studio's 16k tokens/min quota on
# gemma-4-31b. With 2 in parallel, we trade some wall-clock for reliability.
MAX_PARALLEL = 2


def _strip_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
        if t.endswith("```"):
            t = t[:-3]
    return t.strip()


def _parse_claims(raw: str) -> list[Claim]:
    if not raw:
        return []
    try:
        data = json.loads(_strip_fence(raw))
    except (json.JSONDecodeError, TypeError):
        return []
    items = data.get("claims", []) if isinstance(data, dict) else []
    out: list[Claim] = []
    for item in items[:MAX_CLAIMS]:
        try:
            out.append(Claim.model_validate(item))
        except ValidationError:
            continue
    return out


def _parse_verdict(raw: str | None, claim: Claim) -> Verdict | None:
    if not raw:
        return None
    try:
        data = json.loads(_strip_fence(raw))
        v = Verdict.model_validate(data)
        v.claim = claim
        return v
    except (json.JSONDecodeError, ValidationError):
        return None


class ClaimsDispatcher(BaseAgent):
    """Dynamic parallel fan-out over the Investigator agent."""

    def __init__(self, name: str = "dispatcher"):
        investigator = build_investigator()
        super().__init__(name=name, sub_agents=[investigator])
        # store as private attr (not field) since BaseAgent is a Pydantic model
        object.__setattr__(self, "_investigator", investigator)

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        claims = _parse_claims(ctx.session.state.get("claims_json", ""))

        if not claims:
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                content=types.Content(parts=[types.Part(text="No claims to investigate.")]),
                actions=EventActions(state_delta={"per_claim_verdicts": "[]"}),
            )
            return

        sem = asyncio.Semaphore(MAX_PARALLEL)

        async def _bounded(claim: Claim) -> ClaimResult | None:
            async with sem:
                return await self._run_one(claim)

        results = await asyncio.gather(*[_bounded(c) for c in claims])
        kept = [r for r in results if r is not None]
        payload = json.dumps([r.model_dump() for r in kept])
        # IMPORTANT: BaseAgent state mutations must go through EventActions.state_delta,
        # otherwise InMemorySessionService doesn't persist them.
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(parts=[types.Part(text=payload)]),
            actions=EventActions(state_delta={"per_claim_verdicts": payload}),
        )

    async def _run_one(self, claim: Claim) -> ClaimResult | None:
        """Run the Investigator on one claim. Returns None on any failure
        (rate limit, malformed output, network) — caller drops Nones from the
        final list so a single failed claim doesn't kill the whole batch."""
        try:
            session_service = InMemorySessionService()
            sid = str(uuid.uuid4())
            await session_service.create_session(
                app_name=APP_NAME, user_id="dispatcher", session_id=sid
            )
            runner = Runner(
                agent=self._investigator,
                app_name=APP_NAME,
                session_service=session_service,
            )
            msg = types.Content(
                role="user", parts=[types.Part(text=claim.model_dump_json())]
            )
            async for _ in runner.run_async(
                user_id="dispatcher", session_id=sid, new_message=msg
            ):
                pass
            sess = await session_service.get_session(
                app_name=APP_NAME, user_id="dispatcher", session_id=sid
            )
            raw = (sess.state if sess else {}).get("verdict_json")
            verdict = _parse_verdict(raw, claim)
            if verdict is None:
                return None
            return ClaimResult(claim=claim, verdict=verdict)
        except Exception as e:  # noqa: BLE001 — survive any per-claim failure
            print(f"[dispatcher] investigator failed for {claim.text[:60]!r}: {type(e).__name__}: {e}")
            return None
