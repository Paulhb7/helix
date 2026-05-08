.PHONY: install dev test lint clean ollama-pull

PYTHON ?= python3.11
VENV ?= .venv

install:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -U pip
	$(VENV)/bin/pip install -e ".[dev]"

ollama-pull:
	ollama pull gemma4:e4b
	ollama pull gemma4:e2b

dev:
	$(VENV)/bin/uvicorn beacon.api.main:app --reload --host $${BACKEND_HOST:-0.0.0.0} --port $${BACKEND_PORT:-8003}

test:
	$(VENV)/bin/pytest -v

lint:
	$(VENV)/bin/ruff check backend tests

clean:
	rm -rf $(VENV) .pytest_cache **/__pycache__
