#!/usr/bin/env bash
# Fixtures for ptask slice classification (spawn vs fold vs block).
set -euo pipefail
exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/queue-slices.py" --test
