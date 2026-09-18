# PaediFlash - Paediatrics Picture Test Flashcard Web App

## How to run locally on your Computer (Mac, Windows, or Linux):

1. Ensure Python 3.9+ is installed on your computer.
2. Place `Completed Paediatrics Picture Test.pdf` in this same folder.
3. Start the application:
   - On Windows: Double-click `start_windows.bat` (or open Command Prompt and run `python server.py`).
   - On Mac/Linux: Open Terminal and run `./start_mac_linux.sh` (or `python3 server.py`).
4. Open your browser and navigate to:
   http://localhost:8000

---

## How to host it permanently online for FREE (Use on Phone, iPad, or Laptop anywhere):

### Option 1: Render.com (Free)
1. Push this folder to a GitHub repository.
2. Go to https://render.com and create a new **Web Service**.
3. Connect your GitHub repository.
4. Set Build Command: `pip install -r requirements.txt`
5. Set Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. You will get a permanent public link like `https://paediflash.onrender.com` that you can open from any device!

### Option 2: Hugging Face Spaces (Free Docker/FastAPI)
1. Go to https://huggingface.co/spaces and create a new Space with the **Docker** or **FastAPI** template.
2. Upload these files and the PDF.
3. It will run 24/7 with a permanent public link.
