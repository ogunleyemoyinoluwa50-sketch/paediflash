#!/bin/bash
cd "$(dirname "$0")"
echo "=== Starting PaediFlash Medical Flashcards ==="
python3 -m pip install -r requirements.txt
python3 server.py
