# PaediFlash - Paediatrics Picture Test Flashcard Web App

## 🚀 Easy GitHub & Render Deployment (No 25MB File Upload Required!)

**You do NOT need to upload the large 82MB PDF to GitHub!**

`server.py` now includes an **automatic Google Drive downloader**. When your app boots up on Render:
1. It automatically downloads `Completed Paediatrics Picture Test.pdf` from your Google Drive link in ~3 seconds.
2. It caches it inside Render and immediately serves all 442 slide images!

### 2-Step Setup:
1. **Upload only the code files in this ZIP to your GitHub repository.**
   (All files are tiny — under 500 KB total — so GitHub's web uploader accepts them in 2 seconds with zero size warnings).
2. **On Render.com:**
   - Create a **Web Service** connected to your repository.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Click **Deploy**!

---

## 💻 Running Locally on your Computer:
If you want to run it locally on your computer offline:
- Place `Completed Paediatrics Picture Test.pdf` in this folder.
- On Windows: Double-click `start_windows.bat`
- On Mac/Linux: Run `./start_mac_linux.sh`
- Open http://localhost:8000
