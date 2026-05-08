"""Tiny BaseAgent that seeds state["claims_json"] from the user message text.

Used by the /verify pipeline: the API endpoint sends the user-validated claims
as the user message text (a JSON object), and this seeder copies it into the
session state so the downstream Dispatcher can read it.
"""
from __future__ import annotations

from typing import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai import types


class ClaimsSeeder(BaseAgent):
    """Copies the user message JSON verbatim into state["claims_json"]."""

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        text = ""
        if ctx.user_content and ctx.user_content.parts:
            text = ctx.user_content.parts[0].text or ""
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(parts=[types.Part(text=text)]),
            actions=EventActions(state_delta={"claims_json": text}),
        )
