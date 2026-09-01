# Buzrr-AI — the first Dockerfile in this repo.
#
# The Next.js app deploys to Vercel and the Nest server runs from source on a
# container host, but this service needs a Python runtime with native wheels
# (PyMuPDF), so it ships as an image. One image, two processes: the FastAPI web
# service and the arq worker (`command:` decides which).

FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Dependency layer first so application edits don't invalidate the wheel cache.
COPY pyproject.toml README.md ./
COPY src ./src
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install .

# --------------------------------------------------------------------------- #

FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    AI_TMP_DIR=/tmp/buzrr-ai

# Never run as root: this process writes uploaded files to disk.
RUN useradd --create-home --uid 10001 buzrr

COPY --from=builder /opt/venv /opt/venv
WORKDIR /app
COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src

RUN mkdir -p "$AI_TMP_DIR" && chown -R buzrr:buzrr "$AI_TMP_DIR" /app
USER buzrr

EXPOSE 3002

# Migrations are a release/pre-deploy step (`alembic upgrade head`), never run at
# boot — same discipline as `prisma migrate deploy` for the Nest side.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3002/health', timeout=2).status==200 else 1)"

CMD ["sh", "-c", "uvicorn buzrr_ai.main:app --host 0.0.0.0 --port ${AI_PORT:-3002}"]
