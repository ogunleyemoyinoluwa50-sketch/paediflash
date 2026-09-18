import io
import json
import os
import re
import threading
import time
from functools import lru_cache
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
import pymupdf
import requests

app = FastAPI(title="PaediFlash API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. LOAD FLASHCARDS (Bulletproof fallback)
ALL_CARDS = []
candidate_card_paths = [
    os.path.join(BASE_DIR, "cards_data.json"),
    os.path.join(os.getcwd(), "cards_data.json"),
    os.path.join(BASE_DIR, "app", "cards_data.json"),
    os.path.join(os.getcwd(), "app", "cards_data.json"),
    os.path.join(BASE_DIR, "PaediFlash_Package", "cards_data.json"),
    os.path.join(os.getcwd(), "PaediFlash_Package", "cards_data.json"),
    "/home/user/app/cards_data.json",
    "/home/user/cards_data.json"
]

cards_file = next((p for p in candidate_card_paths if os.path.exists(p)), None)

if cards_file:
    try:
        with open(cards_file, "r", encoding="utf-8") as f:
            ALL_CARDS = json.load(f)
        print(f"Loaded {len(ALL_CARDS)} cards from {cards_file}")
    except Exception as e:
        print(f"Notice reading {cards_file}: {e}")

if not ALL_CARDS:
    try:
        from cards_data import ALL_CARDS
        print(f"Loaded {len(ALL_CARDS)} cards from python module 'cards_data.py'")
    except Exception as e:
        print(f"Error loading cards: {e}")
        ALL_CARDS = []

# 2. LOCATE OR AUTO-DOWNLOAD PDF FILE
PDF_FILENAME = "Completed Paediatrics Picture Test.pdf"
GDRIVE_FILE_ID = "1bhCCc2okXBegBN3oQRLCxqE4xcQr9CCM"

candidate_pdf_paths = [
    os.path.join(BASE_DIR, PDF_FILENAME),
    os.path.join(os.getcwd(), PDF_FILENAME),
    os.path.join(os.path.dirname(BASE_DIR), PDF_FILENAME),
    os.path.join(BASE_DIR, "app", PDF_FILENAME),
    os.path.join(os.getcwd(), "app", PDF_FILENAME),
    os.path.join("/home/user", PDF_FILENAME),
]
PDF_PATH = next((p for p in candidate_pdf_paths if os.path.exists(p) and os.path.getsize(p) > 1000000), None)

doc = None
pdf_lock = threading.Lock()
pdf_download_in_progress = False
pdf_download_error = None

def init_doc(filepath):
    global doc
    try:
        with pdf_lock:
            doc = pymupdf.open(filepath)
            print(f"PDF successfully loaded from {filepath} ({len(doc)} pages).")
    except Exception as e:
        print(f"Error opening PDF at {filepath}: {e}")

if PDF_PATH:
    init_doc(PDF_PATH)

def download_pdf_from_gdrive():
    global pdf_download_in_progress, pdf_download_error, PDF_PATH
    target_path = os.path.join(BASE_DIR, PDF_FILENAME)
    pdf_download_in_progress = True
    print(f"Auto-downloading {PDF_FILENAME} from Google Drive to {target_path}...")

    try:
        url = f"https://drive.google.com/uc?export=download&id={GDRIVE_FILE_ID}"
        session = requests.Session()
        resp = session.get(url, timeout=30)
        
        match = re.search(r'<form id="download-form" action="([^"]+)" method="get">(.*?)</form>', resp.text, re.DOTALL)
        if match:
            action = match.group(1)
            inputs = re.findall(r'<input type="hidden" name="([^"]+)" value="([^"]*)"', match.group(2))
            params = {k: v for k, v in inputs}
            file_resp = session.get(action, params=params, stream=True, timeout=120)
        else:
            file_resp = session.get(url, stream=True, timeout=120)

        if file_resp.status_code == 200:
            temp_path = target_path + ".tmp"
            with open(temp_path, "wb") as f:
                for chunk in file_resp.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
            os.replace(temp_path, target_path)
            PDF_PATH = target_path
            print(f"Download complete: {os.path.getsize(target_path)} bytes.")
            init_doc(target_path)
        else:
            pdf_download_error = f"Google Drive HTTP status {file_resp.status_code}"
            print(f"Download error: {pdf_download_error}")
    except Exception as e:
        pdf_download_error = str(e)
        print(f"Exception during PDF download: {e}")
    finally:
        pdf_download_in_progress = False

# If PDF is not present, launch background downloader immediately
if not doc:
    threading.Thread(target=download_pdf_from_gdrive, daemon=True).start()

# 3. LOCATE STATIC FOLDER
candidate_static_paths = [
    os.path.join(BASE_DIR, "static"),
    os.path.join(os.getcwd(), "static"),
    os.path.join(BASE_DIR, "app", "static"),
    os.path.join(os.getcwd(), "app", "static"),
    os.path.join(BASE_DIR, "PaediFlash_Package", "static"),
    "/home/user/app/static"
]
static_dir = next((p for p in candidate_static_paths if os.path.exists(p)), os.path.join(BASE_DIR, "static"))
os.makedirs(static_dir, exist_ok=True)

@lru_cache(maxsize=200)
def render_page_image(page_num: int, dpi: int = 130) -> Optional[bytes]:
    if not doc:
        return None
    if page_num < 1 or page_num > len(doc):
        return None
    with pdf_lock:
        page = doc[page_num - 1]
        pix = page.get_pixmap(dpi=dpi)
        return pix.tobytes("jpeg")

@app.get("/api/page/{page_num}")
def get_page_image(page_num: int, dpi: int = Query(130, ge=72, le=300)):
    if not doc:
        if pdf_download_in_progress:
            svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
                <rect width="600" height="400" fill="#0f172a"/>
                <circle cx="300" cy="180" r="30" stroke="#38bdf8" stroke-width="4" fill="none" stroke-dasharray="120" stroke-linecap="round"/>
                <text x="50%" y="240" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold">Downloading slide images from Google Drive...</text>
                <text x="50%" y="270" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="13">This takes just a few seconds on first launch. Refresh soon!</text>
            </svg>"""
        else:
            svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
                <rect width="600" height="400" fill="#1e293b"/>
                <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="18" font-weight="bold">Slide Image #{page_num}</text>
                <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="13">PDF initializing... Please reload in a moment.</text>
            </svg>"""
        return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "no-cache"})

    img_bytes = render_page_image(page_num, dpi)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Page not found")
    return StreamingResponse(
        io.BytesIO(img_bytes),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@app.get("/api/cards")
def get_cards(
    category: Optional[str] = None,
    deck: Optional[str] = None,
    search: Optional[str] = None
):
    results = ALL_CARDS
    if category and category != "All":
        results = [c for c in results if c.get("category") == category]
    if deck and deck != "All":
        results = [c for c in results if c.get("deck") == deck]
    if search:
        s = search.lower()
        results = [
            c for c in results
            if s in c.get("title", "").lower()
            or s in c.get("vignette", "").lower()
            or s in c.get("clinical_summary", "").lower()
            or any(s in opt.get("text", "").lower() or s in opt.get("explanation", "").lower() for opt in c.get("statements", []))
        ]
    return results

@app.get("/api/cards/{card_id}")
def get_card(card_id: str):
    for c in ALL_CARDS:
        if c.get("id") == card_id:
            return c
    raise HTTPException(status_code=404, detail="Card not found")

@app.get("/api/categories")
def get_categories():
    counts = {}
    for c in ALL_CARDS:
        cat = c.get("category", "General")
        counts[cat] = counts.get(cat, 0) + 1
    return [{"name": k, "count": v} for k, v in sorted(counts.items())]

@app.get("/api/decks")
def get_decks():
    counts = {}
    for c in ALL_CARDS:
        d = c.get("deck", "General")
        counts[d] = counts.get(d, 0) + 1
    return [{"name": k, "count": v} for k, v in sorted(counts.items())]

@app.get("/api/pdf-info")
def get_pdf_info():
    return {
        "pages": len(doc) if doc else 0,
        "available": doc is not None,
        "downloading": pdf_download_in_progress,
        "error": pdf_download_error,
        "title": "Completed Paediatrics Picture Test",
        "total_cards": len(ALL_CARDS)
    }

# Mount static frontend
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
