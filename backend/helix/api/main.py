"""FastAPI app — one endpoint for the agentic Helix pipeline.

  POST /check   — One-shot orchestrator + investigator.

Plus utilities:
  POST /preview — OpenGraph metadata for a URL (UI preview card).
  GET  /health  — liveness probe.
"""
from __future__ import annotations

import json
import ipaddress
import socket
import time
import uuid
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import ValidationError

from helix import tools as helix_tools
from helix.agent import build_root_agent
from helix.config import settings
from helix.schemas import (
    CheckRequest,
    CheckResponse,
    ClaimResult,
    LinkPreviewRequest,
    LinkPreviewResponse,
)

_YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
_TIKTOK_HOSTS = {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"}

APP_NAME = "helix"
STATIC_DIR = Path(__file__).resolve().parents[3] / "static"
PREVIEW_MAX_BYTES = 250_000
PREVIEW_TIMEOUT_SECONDS = 6.0

app = FastAPI(
    title="Beacon",
    description="Agentic fact-checker for health misinformation.",
    version="0.2.0",
)

_session_service = InMemorySessionService()
_root_runner = Runner(
    agent=build_root_agent(), app_name=APP_NAME, session_service=_session_service
)


class _PreviewParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "title":
            self._in_title = True
            return
        if tag.lower() != "meta":
            return

        values = {k.lower(): (v or "").strip() for k, v in attrs if k}
        key = values.get("property") or values.get("name")
        content = values.get("content")
        if key and content:
            self.meta[key.lower()] = content

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def _strip_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
        if t.endswith("```"):
            t = t[:-3]
    return t.strip()


async def _new_session() -> str:
    sid = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME, user_id="web", session_id=sid
    )
    return sid


async def _run(runner: Runner, sid: str, msg: types.Content) -> dict:
    async for _ in runner.run_async(user_id="web", session_id=sid, new_message=msg):
        pass
    sess = await _session_service.get_session(
        app_name=APP_NAME, user_id="web", session_id=sid
    )
    return sess.state if sess else {}


def _ingest_url(url: str) -> dict:
    """Deterministic URL → text. Route by host, return the tool dict.

    Returns {"kind", "url", "title", "text", ...} on success, {"error": "..."}
    on failure. No LLM involved.
    """
    host = (urlparse(url).hostname or "").lower()
    if host in _YT_HOSTS or host.endswith(".youtube.com"):
        return helix_tools.fetch_youtube_transcript(url)
    if host in _TIKTOK_HOSTS or host.endswith(".tiktok.com"):
        return helix_tools.analyze_tiktok_audio(url)
    return helix_tools.fetch_article(url)


def _build_user_message(req: CheckRequest) -> types.Content:
    parts: list[types.Part] = []

    if req.url:
        ingested = _ingest_url(req.url.strip())
        if "error" in ingested:
            raise HTTPException(
                status_code=422,
                detail=f"Could not read content from this URL: {ingested['error']}",
            )
        kind = ingested.get("kind", "content")
        # TikTok audio analysis returns a "transcript" key; the others "text".
        body = ingested.get("text") or ingested.get("transcript") or ""
        title = ingested.get("title") or ""
        header = f"Source: {req.url.strip()} ({kind})"
        if title:
            header += f"\nTitle: {title}"
        parts.append(types.Part(text=f"{header}\n\nContent:\n{body}"))

    if req.text:
        parts.append(types.Part(text=req.text))
    if req.image_b64:
        parts.append(
            types.Part(
                inline_data=types.Blob(mime_type="image/png", data=req.image_b64)
            )
        )
    return types.Content(role="user", parts=parts)


def _build_single_result(state: dict) -> list[ClaimResult]:
    """Parse the Investigator's Verdict (with embedded claim) from state.

    The Investigator writes its full Verdict — including the .claim field —
    into state["verdict_json"]. We rehydrate it and return a 1-item list.
    """
    from helix.schemas import Verdict

    verdict_raw_unfenced = state.get("verdict_json") or ""
    try:
        verdict_raw = _strip_fence(verdict_raw_unfenced)
        verdict = Verdict.model_validate(json.loads(verdict_raw))
    except (json.JSONDecodeError, ValidationError, TypeError) as e:
        print(f"[helix] _build_single_result parse error: {type(e).__name__}: {e}")
        print(f"[helix]   state keys: {list(state.keys())}")
        print(f"[helix]   verdict_json (first 500): {verdict_raw_unfenced[:500]!r}")
        return []

    if not verdict.claim:
        print("[helix] _build_single_result: verdict has no .claim field")
        print(f"[helix]   verdict: {verdict.model_dump_json()[:500]}")
        return []
    return [ClaimResult(claim=verdict.claim, verdict=verdict)]


def _clean_meta(value: str | None, max_len: int = 280) -> str | None:
    if not value:
        return None
    cleaned = " ".join(value.split())
    if not cleaned:
        return None
    return cleaned if len(cleaned) <= max_len else cleaned[: max_len - 1].rstrip() + "…"


def _public_http_url(raw_url: str) -> str:
    url = raw_url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Provide a valid http(s) URL.")

    host = parsed.hostname
    if host in {"localhost", "localhost.localdomain"}:
        raise HTTPException(status_code=400, detail="Local URLs cannot be previewed.")

    try:
        addresses = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve this URL.") from None

    for addr in addresses:
        ip = ipaddress.ip_address(addr[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise HTTPException(status_code=400, detail="Private URLs cannot be previewed.")
    return url


async def _fetch_preview_html(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(
        follow_redirects=False,
        timeout=PREVIEW_TIMEOUT_SECONDS,
        headers={
            "User-Agent": "BeaconPreview/0.2 (+https://localhost)",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
    ) as client:
        try:
            current_url = url
            for _ in range(4):
                async with client.stream("GET", current_url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise HTTPException(
                                status_code=502,
                                detail="Could not follow preview redirect.",
                            )
                        current_url = _public_http_url(urljoin(current_url, location))
                        continue

                    return await _read_preview_response(response)

            raise HTTPException(
                status_code=508,
                detail="Too many redirects while fetching preview.",
            )
        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail="Could not fetch preview.") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Could not fetch preview.") from exc


async def _read_preview_response(response: httpx.Response) -> tuple[str, str]:
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
        raise HTTPException(
            status_code=415,
            detail="This URL does not look like an HTML page.",
        )

    chunks: list[bytes] = []
    total = 0
    async for chunk in response.aiter_bytes():
        chunks.append(chunk)
        total += len(chunk)
        if total >= PREVIEW_MAX_BYTES:
            break
    html = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    return str(response.url), html


async def _fetch_youtube_oembed(url: str) -> LinkPreviewResponse | None:
    if not _youtube_thumbnail(url):
        return None

    async with httpx.AsyncClient(timeout=PREVIEW_TIMEOUT_SECONDS) as client:
        try:
            response = await client.get(
                "https://www.youtube.com/oembed",
                params={"url": url, "format": "json"},
                headers={"User-Agent": "BeaconPreview/0.2 (+https://localhost)"},
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError):
            return None

    return LinkPreviewResponse(
        url=url,
        final_url=url,
        title=_clean_meta(data.get("title"), 160),
        description=_clean_meta(data.get("author_name"), 120),
        image=_clean_meta(data.get("thumbnail_url"), 1000) or _youtube_thumbnail(url),
        site_name="YouTube",
    )


def _parse_preview(url: str, final_url: str, html: str) -> LinkPreviewResponse:
    parser = _PreviewParser()
    parser.feed(html)
    meta = parser.meta
    image = _clean_meta(meta.get("og:image") or meta.get("twitter:image"), 1000)
    if image:
        image = urljoin(final_url, image)

    return LinkPreviewResponse(
        url=url,
        final_url=final_url,
        title=_clean_meta(
            meta.get("og:title") or meta.get("twitter:title") or parser.title,
            160,
        ),
        description=_clean_meta(
            meta.get("og:description") or meta.get("twitter:description") or meta.get("description")
        ),
        image=image or _youtube_thumbnail(final_url),
        site_name=_clean_meta(meta.get("og:site_name"), 80) or urlparse(final_url).hostname,
    )


def _youtube_thumbnail(url: str) -> str | None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    video_id = None

    if host == "youtu.be":
        video_id = parsed.path.strip("/").split("/", 1)[0]
    elif host in {"youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [None])[0]
        elif parsed.path.startswith("/shorts/") or parsed.path.startswith("/embed/"):
            video_id = parsed.path.strip("/").split("/")[1]

    if not video_id:
        return None
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def _wrap_agent_error(exc: Exception) -> HTTPException:
    """Map known agent errors to friendly HTTP responses."""
    name = type(exc).__name__
    text = str(exc)
    if name == "RateLimitError" or "RESOURCE_EXHAUSTED" in text or "429" in text:
        # Try to extract the retry-after delay from the litellm message.
        delay_hint = ""
        import re
        m = re.search(r"retry in (\d+(?:\.\d+)?)s", text)
        if m:
            delay_hint = f" Retry in ~{int(float(m.group(1)))}s."
        return HTTPException(
            status_code=429,
            detail=(
                f"Google AI Studio rate limit hit on this model.{delay_hint} "
                "The free/paid tier caps input tokens per minute — wait a moment and try again."
            ),
        )
    return HTTPException(status_code=500, detail=f"{name}: {text}")


@app.post("/ingest")
async def ingest(req: CheckRequest) -> dict:
    """Deterministic, fast: URL/text/image → the text the orchestrator will see.

    Frontend calls this first to render the source in the loading panel while
    /check runs. No LLM involved.
    """
    if req.url:
        result = _ingest_url(req.url.strip())
        if "error" in result:
            raise HTTPException(status_code=422, detail=result["error"])
        return {
            "kind": result.get("kind", "content"),
            "text": result.get("text") or result.get("transcript") or "",
            "title": result.get("title"),
            "source_url": req.url.strip(),
        }
    if req.text:
        return {"kind": "claim", "text": req.text, "title": None, "source_url": None}
    if req.image_b64:
        return {"kind": "image", "text": "", "title": None, "source_url": None}
    raise HTTPException(
        status_code=400,
        detail="Provide at least one of: 'text', 'url', or 'image_b64'.",
    )


@app.post("/preview", response_model=LinkPreviewResponse)
async def preview(req: LinkPreviewRequest) -> LinkPreviewResponse:
    """Fetch lightweight page metadata so the user can confirm a URL first."""
    url = _public_http_url(req.url)
    youtube_preview = await _fetch_youtube_oembed(url)
    if youtube_preview:
        return youtube_preview

    final_url, html = await _fetch_preview_html(url)
    return _parse_preview(url, final_url, html)


@app.post("/check", response_model=CheckResponse)
async def check(req: CheckRequest) -> CheckResponse:
    """One-shot: orchestrator extracts the claim and the Investigator fact-checks it."""
    if not (req.text or req.url or req.image_b64):
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of: 'text', 'url', or 'image_b64'.",
        )

    sid = await _new_session()
    started = time.perf_counter()
    try:
        state = await _run(_root_runner, sid, _build_user_message(req))
    except Exception as e:  # noqa: BLE001
        raise _wrap_agent_error(e) from e
    elapsed = time.perf_counter() - started

    results = _build_single_result(state)
    return CheckResponse(results=results, elapsed_seconds=round(elapsed, 2))


@app.get("/health")
async def healthz() -> dict:
    return {"ok": True}


@app.get("/mode")
async def mode() -> dict:
    """Which model backend is wired up — used by the UI to show an online/offline badge."""
    provider = settings.model_provider
    if provider == "api":
        return {
            "provider": "api",
            "online": True,
            "label": "Online",
            "backend": "Gemini API",
            "model": settings.gemma_api_model,
            "model_fast": settings.gemma_api_model_fast,
        }
    return {
        "provider": "local",
        "online": False,
        "label": "Offline",
        "backend": "Ollama",
        "model": settings.ollama_model,
        "model_fast": settings.ollama_model_fast,
    }


PUBLIC_DIR = Path(__file__).resolve().parents[3] / "public"
FRONTEND_DIST = Path(__file__).resolve().parents[3] / "frontend_dist"

if PUBLIC_DIR.is_dir():
    app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if FRONTEND_DIST.is_dir():
    _spa_index = FRONTEND_DIST / "index.html"

    @app.get("/{full_path:path}")
    async def frontend_spa(full_path: str) -> FileResponse:
        if full_path:
            candidate = FRONTEND_DIST / full_path
            if candidate.is_file() and FRONTEND_DIST in candidate.resolve().parents:
                return FileResponse(candidate)
        return FileResponse(_spa_index)
elif STATIC_DIR.is_dir():
    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")
