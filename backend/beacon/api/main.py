"""FastAPI app — three endpoints for the agentic Beacon pipeline.

  POST /extract  — Manager only. Returns the claims (1 main + 0-2 sub) so the
                   user can review/edit them in the UI before verification.
  POST /verify   — Dispatcher only. Takes the (possibly edited) claims and
                   fans out one Investigator per claim.
  POST /check    — One-shot Manager + Dispatcher (no user-in-the-loop).
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

from beacon.pipeline import (
    build_extract_agent,
    build_root_agent,
    build_verify_agent,
)
from beacon.schemas import (
    CheckRequest,
    CheckResponse,
    Claim,
    ClaimResult,
    ExtractResponse,
    LinkPreviewRequest,
    LinkPreviewResponse,
    VerifyRequest,
)

APP_NAME = "beacon"
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
_extract_runner = Runner(
    agent=build_extract_agent(), app_name=APP_NAME, session_service=_session_service
)
_verify_runner = Runner(
    agent=build_verify_agent(), app_name=APP_NAME, session_service=_session_service
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


def _build_user_message(req: CheckRequest) -> types.Content:
    parts: list[types.Part] = []
    if req.url:
        parts.append(types.Part(text=f"Analyze this URL: {req.url.strip()}"))
    if req.text:
        parts.append(types.Part(text=req.text))
    if req.image_b64:
        parts.append(
            types.Part(
                inline_data=types.Blob(mime_type="image/png", data=req.image_b64)
            )
        )
    return types.Content(role="user", parts=parts)


def _parse_claims_json(raw: str) -> list[Claim]:
    if not raw:
        return []
    try:
        data = json.loads(_strip_fence(raw))
    except (json.JSONDecodeError, TypeError):
        return []
    items = data.get("claims", []) if isinstance(data, dict) else []
    out: list[Claim] = []
    for it in items:
        try:
            out.append(Claim.model_validate(it))
        except ValidationError:
            continue
    return out


def _parse_results(raw: str) -> list[ClaimResult]:
    try:
        items = json.loads(raw or "[]")
        return [ClaimResult.model_validate(it) for it in items]
    except (json.JSONDecodeError, ValidationError):
        return []


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


@app.post("/extract", response_model=ExtractResponse)
async def extract(req: CheckRequest) -> ExtractResponse:
    """Step 1: run only the Manager. Return the claims for user review."""
    if not (req.text or req.url or req.image_b64):
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of: 'text', 'url', or 'image_b64'.",
        )

    sid = await _new_session()
    started = time.perf_counter()
    state = await _run(_extract_runner, sid, _build_user_message(req))
    elapsed = time.perf_counter() - started

    claims = _parse_claims_json(state.get("claims_json", ""))
    return ExtractResponse(claims=claims, elapsed_seconds=round(elapsed, 2))


@app.post("/preview", response_model=LinkPreviewResponse)
async def preview(req: LinkPreviewRequest) -> LinkPreviewResponse:
    """Fetch lightweight page metadata so the user can confirm a URL first."""
    url = _public_http_url(req.url)
    youtube_preview = await _fetch_youtube_oembed(url)
    if youtube_preview:
        return youtube_preview

    final_url, html = await _fetch_preview_html(url)
    return _parse_preview(url, final_url, html)


@app.post("/verify", response_model=CheckResponse)
async def verify(req: VerifyRequest) -> CheckResponse:
    """Step 2: dispatch one Investigator per (user-validated) claim."""
    if not req.claims:
        raise HTTPException(status_code=400, detail="Provide at least one claim.")

    sid = await _new_session()
    payload = json.dumps({"claims": [c.model_dump() for c in req.claims]})
    msg = types.Content(role="user", parts=[types.Part(text=payload)])

    started = time.perf_counter()
    state = await _run(_verify_runner, sid, msg)
    elapsed = time.perf_counter() - started

    results = _parse_results(state.get("per_claim_verdicts", "[]"))
    return CheckResponse(results=results, elapsed_seconds=round(elapsed, 2))


@app.post("/check", response_model=CheckResponse)
async def check(req: CheckRequest) -> CheckResponse:
    """One-shot: Manager + Dispatcher in a single call (no user review)."""
    if not (req.text or req.url or req.image_b64):
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of: 'text', 'url', or 'image_b64'.",
        )

    sid = await _new_session()
    started = time.perf_counter()
    state = await _run(_root_runner, sid, _build_user_message(req))
    elapsed = time.perf_counter() - started

    results = _parse_results(state.get("per_claim_verdicts", "[]"))
    return CheckResponse(results=results, elapsed_seconds=round(elapsed, 2))


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


PUBLIC_DIR = Path(__file__).resolve().parents[3] / "public"

if PUBLIC_DIR.is_dir():
    app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")
