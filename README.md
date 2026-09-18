# PaediFlash - 442-Card Aesthetic Anki Paediatrics Decks

## 🚀 Easy GitHub & Render Deployment (Zero 25MB File Upload Required!)

`server.py` includes an **automatic Google Drive downloader**. When your app boots up on Render:
1. It automatically downloads `Completed Paediatrics Picture Test.pdf` directly into Render in ~3 seconds.
2. It caches it inside Render and immediately serves all 442 slide images!

### 2-Step Setup:
1. **Upload only the code files in this folder to your GitHub repository.**
2. **On Render.com:**
   - Create a **Web Service** connected to your repository.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Click **Deploy**!

---

## 🎴 Verified All 442 Flashcards:
- **Master Deck**: Slides 1 to 442 (100% verified, 2,163 total statements)
- **Classic Picture Test**: Slides 1 to 17
- **CMDA Paediatric Deck**: Slides 18 to 38
- **Neonatal & Pathology**: Slides 39 to 84
- **MB3 Clinical Exam Deck**: Slides 85 to 133
- **Paediatric Slide Quiz Deck**: Slides 134 to 223
- **Clerking & OSCE Stations**: Slides 224 to 274
- **Clinical Scenarios Deck**: Slides 275 to 384
- **Revision & Rapid Fire Deck**: Slides 385 to 442
