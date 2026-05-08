"""Audio → text transcription using Gemma 4 E4B (multimodal, audio-capable).

Loads the model lazily on first call and keeps it in memory (singleton).
~16 GB on disk in BF16. Requires `huggingface-cli login` with Gemma license accepted.

Audio is constrained to 30s segments per the model card — longer clips are
split before transcription and concatenated back.
"""
from __future__ import annotations

import os
from pathlib import Path
from threading import Lock

MODEL_ID = os.getenv("GEMMA_AUDIO_MODEL", "google/gemma-4-E4B-it")
MAX_CHUNK_SECONDS = 28  # under the model's 30s ceiling, with safety margin
TARGET_SR = 16_000

_lock = Lock()
_model = None
_processor = None


def _device() -> str:
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load() -> tuple[object, object, str]:
    global _model, _processor
    if _model is not None and _processor is not None:
        return _model, _processor, _device()

    with _lock:
        if _model is not None and _processor is not None:
            return _model, _processor, _device()

        from transformers import AutoModelForMultimodalLM, AutoProcessor

        device = _device()
        _processor = AutoProcessor.from_pretrained(MODEL_ID)
        _model = AutoModelForMultimodalLM.from_pretrained(
            MODEL_ID,
            dtype="auto",
            device_map=device if device != "mps" else None,
        )
        if device == "mps":
            _model = _model.to(device)
        return _model, _processor, device


def _load_audio(path: Path) -> "tuple[list, int]":
    """Load and resample to TARGET_SR mono, return (numpy waveform, sample_rate)."""
    import librosa
    audio, sr = librosa.load(str(path), sr=TARGET_SR, mono=True)
    return audio, sr


def _chunk(audio, sr: int) -> "list":
    chunk_size = MAX_CHUNK_SECONDS * sr
    return [audio[i : i + chunk_size] for i in range(0, len(audio), chunk_size)]


def transcribe(audio_path: Path) -> str:
    """Transcribe a single audio file to text. Long files are auto-chunked."""
    model, processor, device = _load()
    audio, sr = _load_audio(audio_path)
    chunks = _chunk(audio, sr)

    pieces: list[str] = []
    for i, chunk in enumerate(chunks):
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "audio", "audio": chunk},
                    {
                        "type": "text",
                        "text": (
                            "Transcribe this audio segment exactly as spoken, "
                            "in its original language. Output only the transcript, "
                            "no preamble, no formatting."
                        ),
                    },
                ],
            }
        ]
        inputs = processor.apply_chat_template(
            messages,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
            add_generation_prompt=True,
        ).to(device)
        input_len = inputs["input_ids"].shape[-1]

        outputs = model.generate(**inputs, max_new_tokens=512, do_sample=False)
        text = processor.decode(outputs[0][input_len:], skip_special_tokens=True).strip()
        pieces.append(text)

    return " ".join(p for p in pieces if p).strip()
