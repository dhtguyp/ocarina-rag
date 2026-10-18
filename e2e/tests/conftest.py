import os
import time

import httpx
import pytest

# Public entrypoint: nginx serving the frontend and proxying /api (the real user path).
BASE_URL = os.environ.get("E2E_BASE_URL", "http://frontend")
# Backend container directly, bypassing nginx.
BACKEND_URL = os.environ.get("E2E_BACKEND_URL", "http://backend:8000")


@pytest.fixture(scope="session", autouse=True)
def stack_is_up() -> None:
    """Fail fast with a clear message if `docker compose up` wasn't run first."""
    deadline = time.monotonic() + 60
    while True:
        try:
            if httpx.get(f"{BASE_URL}/api/health", timeout=3).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        if time.monotonic() > deadline:
            pytest.exit(
                f"Stack not reachable at {BASE_URL}. Start it first with "
                "`docker compose up -d --build`, then re-run the E2E tests.",
                returncode=2,
            )
        time.sleep(2)


@pytest.fixture(scope="session")
def api() -> httpx.Client:
    with httpx.Client(base_url=BASE_URL, timeout=10) as client:
        yield client


@pytest.fixture(scope="session")
def backend() -> httpx.Client:
    with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
        yield client
