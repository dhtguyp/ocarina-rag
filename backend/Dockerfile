FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /srv

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
ENV PATH="/srv/.venv/bin:$PATH"
COPY pyproject.toml uv.lock ./


FROM base AS test
RUN uv sync --frozen
COPY app ./app
COPY tests ./tests
CMD ["pytest", "-q"]


# Last stage = default build target
FROM base AS runtime
RUN uv sync --frozen --no-dev
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
