"""TikTok ingestion: yt-dlp downloads the audio, Gemma 4 E4B transcribes it.

Requires:
  - ffmpeg available on PATH
  - HuggingFace login with Gemma 4 license accepted (`huggingface-cli login`)
  - Disk space for the model (~16 GB on first run)
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from beacon.ingest.transcribe import transcribe
from beacon.schemas import IngestedContent

MAX_CHARS = 30_000


def _check_ffmpeg() -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg is required to extract TikTok audio. "
            "Install it with `brew install ffmpeg` (or `apt install ffmpeg`)."
        )


def _download_audio(url: str, out_dir: Path) -> tuple[Path, str | None]:
    import yt_dlp

    out_template = str(out_dir / "audio.%(ext)s")
    opts = {
        "format": "bestaudio/best",
        "outtmpl": out_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    title = info.get("title") if isinstance(info, dict) else None
    audio_path = out_dir / "audio.wav"
    if not audio_path.exists():
        candidates = list(out_dir.glob("audio.*"))
        if not candidates:
            raise RuntimeError(f"yt-dlp produced no audio file from {url}")
        audio_path = candidates[0]
    return audio_path, title


def extract_tiktok(url: str) -> IngestedContent:
    _check_ffmpeg()
    with tempfile.TemporaryDirectory(prefix="beacon-tiktok-") as tmp:
        audio_path, title = _download_audio(url, Path(tmp))
        text = transcribe(audio_path)

    if not text:
        raise RuntimeError("Transcription returned empty text.")

    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS]

    return IngestedContent(
        kind="tiktok",
        url=url,
        title=title,
        text=text,
        truncated=truncated,
    )
