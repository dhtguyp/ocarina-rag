FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /e2e

ENV UV_LINK_MODE=copy
ENV PATH="/e2e/.venv/bin:$PATH"
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY tests ./tests
CMD ["pytest", "-v"]
