#!/usr/bin/env bash
set -e
cd /root/trading-rpg
source venv/bin/activate
exec uvicorn server:app --host 0.0.0.0 --port 8090
