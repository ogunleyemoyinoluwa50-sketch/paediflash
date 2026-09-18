import io
import json
import os
from functools import lru_cache
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import pymupdf

app = FastAPI(title="PaediFlash API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PDF_PATH = "/home/user/Completed Paediatrics Picture Test.pdf"
CARDS_FILE = "/home/user/app/cards_data.json"

# Load cards in memory
with open(CARDS_FILE, "r") as f:
    ALL_CARDS = json.load(f)

# Open PDF document
doc = None
if os.path.exists(PDF_PATH):
    doc = pymupdf.open(PDF_PATH)
    print(f"Loaded PDF with {len(doc)} pages.")
else:
    print(f"Warning: PDF not found at {PDF_PATH}")

@lru_cache(maxsize=200)
def render_page_image(page_num: int, dpi: int = 130) -> bytes:
    if not doc:
        raise HTTPException(status_code=500, detail="PDF not loaded")
    if page_num < 1 or page_num > len(doc):
        raise HTTPException(status_code=404, detail="Page out of range")
    page = doc[page_num - 1]
    pix = page.get_pixmap(dpi=dpi)
    return pix.tobytes("jpeg")

@app.get("/api/page/{page_num}")
def get_page_image(page_num: int, dpi: int = Query(130, ge=72, le=300)):
    try:
        img_bytes = render_page_image(page_num, dpi)
        return StreamingResponse(
            io.BytesIO(img_bytes),
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    if not doc:
        return {"pages": 0, "available": False}
    return {
        "pages": len(doc),
        "available": True,
        "title": "Completed Paediatrics Picture Test",
        "total_cards": len(ALL_CARDS)
    }

# Mount static files for the frontend
static_dir = "/home/user/app/static"
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
