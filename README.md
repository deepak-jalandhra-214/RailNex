# RailNex

RailNex is a railway passenger connectivity platform prototype designed to provide internet based on PNR information.

## Project Structure
- `frontend/`: Vanilla HTML, CSS, JS application for the user interface.
- `backend/`: FastAPI application handling logic and state.
- `database/`: SQLite database storage.

## How to Run

### Backend
1. Open terminal and navigate to `backend/`.
2. Create virtual environment: `python -m venv venv`
3. Activate environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install requirements: `pip install -r requirements.txt`
5. Run the server: `uvicorn main:app --reload`
6. API will be available at `http://127.0.0.1:8000`

### Frontend
1. Open `frontend/index.html` in your browser.
2. Alternatively, serve it using python: `python -m http.server 3000` inside the `frontend` folder and visit `http://localhost:3000`.

## Demo PNRs
- PNR: 1234567890 (Delhi -> Ludhiana, 312 km)
- PNR: 1111111111 (Ludhiana -> Jalandhar, 65 km)
- PNR: 2222222222 (Delhi -> Ambala, 198 km)
