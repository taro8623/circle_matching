#!/usr/bin/env bash
set -euo pipefail

alembic upgrade head
python seed_roots_demo_users.py

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8001}"
