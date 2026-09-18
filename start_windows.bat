@echo off
cd /d "%~dp0"
echo === Starting PaediFlash Medical Flashcards ===
pip install -r requirements.txt
python server.py
pause
