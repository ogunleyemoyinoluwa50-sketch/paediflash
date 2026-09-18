# PaediFlash - Paediatrics Picture Test Flashcards

## 🚀 Deploy to Render.com (Free & Permanent)

1. Create a repository on GitHub (e.g. `paediflash`).
2. Upload all files from this folder directly into your repository.
3. On **Render.com**:
   - Create a new **Web Service** connected to your repo.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Click **Deploy**. Render will build the app and download the test slide images directly from Google Drive!
