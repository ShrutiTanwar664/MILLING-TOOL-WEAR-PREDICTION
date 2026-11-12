# ToolSense: Tool Wear Prediction and Remaining Useful Life Monitoring

ToolSense is a tool-condition monitoring system for CNC milling. It predicts how worn a cutting tool is after every cut, estimates how many cuts remain before the tool must be replaced (Remaining Useful Life, RUL), and shows the result on a live web dashboard and a mobile app with alerts and an alarm.

A machine learning model was trained on two milling runs of the PHM Society 2010 dataset (cutters c1 and c4). A third, unseen run (c6) is replayed cut by cut to **simulate a live machine**, so the system can be demonstrated without physical sensors.

**Team:** Anushka, Shruti, Divyaraj, Piyush, Abhishek Pareek and Dr. Mandeep Dhanda, MNNIT Allahabad.

---

## Features

- Predicted wear for each of the three cutting edges (flutes) and for the worst flute, compared with the measured wear.
- RUL in cuts, from a calibrated wear-to-remaining-life curve learned on the training cutters.
- Maintenance recommendation: `continue`, `reduce_feed` or `replace_tool`.
- Status levels on the dashboard: Normal, Warning, Critical and Limit exceeded.
- Alerts when the level rises, an alert history, and a repeating alarm (sound and vibration on mobile) for Critical and Limit exceeded until it is acknowledged.
- Simulation controls: Start, Pause, Resume, Reset and replay speed (Slow, Normal, Fast, Turbo).
- A live web dashboard (React) and a mobile app (React Native with Expo) that share one backend.

## How it works

```
 c6 features (CSV)                       ML API (FastAPI)
        |                                       ^   |
        v                                       |   v
  Simulator (Node/Express backend) -- one cut at a time --> wear, RUL, recommendation
        |
        +--> Web dashboard (live stream)
        +--> Mobile app (polls every second)
```

1. The backend replays one row of `c6_aggregated_features.csv` per step and sends it to the ML API (`POST /predict/{tool_id}`).
2. The ML API keeps the wear history of the tool, applies the model, smooths the result and returns flute wear, maximum wear, RUL and a recommendation.
3. The backend adds the measured wear from the CSV and pushes the result to the dashboard and the app.

The system does not read raw 50 kHz sensor signals. It uses per-cut aggregated features (378 statistical, frequency-band and wavelet features) that were computed beforehand.

---

## Repository structure

```
MILLING-TOOL-WEAR-PREDICTION/
├── CSV/                      Aggregated feature and wear data used for training and evaluation
├── ML/                       Notebook used to build and test the model (model_to_be_deployed.ipynb)
├── toolsense-ml-api/         Prediction service (FastAPI)
│   ├── toolsense_api.py        API endpoints and prediction logic
│   ├── toolsense_combined.py   Model training, wear prediction, RUL methods A and B, metrics
│   ├── toolsense_model.joblib  Trained model (Ridge + Random Forest) and the RUL calibration curve
│   ├── requirements.txt        Python dependencies
│   └── README.md               Short note about the API
├── backend/                  Simulation and web server (Node.js, Express)
│   ├── src/server.js           REST endpoints, live stream, serves the built dashboard
│   ├── src/simulator.js        Replays c6 cut by cut, calls the ML API, broadcasts results
│   ├── src/ml.js               Small client for the ML API
│   ├── data/c6_aggregated_features.csv   Simulated machine data (the unseen cutter)
│   ├── package.json            Node dependencies and start script
│   └── .env                    Local settings (not committed, see Configuration)
├── frontend/                 Web dashboard (React, Vite)
│   ├── index.html              Page shell, fonts and favicon
│   ├── public/favicon.svg      Logo icon
│   ├── src/main.jsx            Entry point
│   ├── src/App.jsx             Dashboard screen, charts, alerts and alarm logic
│   ├── src/Logo.jsx            ToolSense logo component
│   ├── src/alerts.js           Alert levels and alert history
│   ├── src/audio.js            Alarm and chime sounds (Web Audio, no audio files)
│   ├── src/index.css           Styling
│   ├── vite.config.js          Dev server settings (forwards /api to the backend)
│   └── package.json            Frontend dependencies
├── mobile/                   Mobile app (React Native, Expo)
│   ├── App.js                  The whole app: screen, charts, alerts, alarm
│   ├── assets/alarm.wav        Alarm sound
│   └── app.json, index.js, package.json   Expo project files
└── .gitignore                Excludes node_modules, build output and .env files
```

CSV datasets are **not** needed to run the ML API. They are only needed to retrain the model or run the dataset-based evaluation.

---

## Requirements

| Software | Version | Used for |
|---|---|---|
| Node.js and npm | 18 or newer (20 recommended) | Backend, web dashboard, mobile tooling |
| Python and pip | Python 3.10 or newer | ML API (the code uses `int \| None` syntax) |
| Git | any | Cloning the repository |
| Expo Go (phone app) | latest (the project uses Expo SDK 58) | Running the mobile app |
| A terminal | | Running the commands below |

Check your installations with `node --version`, `python --version` (or `python3 --version`) and `git --version`. On Windows, enable "Add Python to PATH" when installing Python.

**Python packages** (`toolsense-ml-api/requirements.txt`): FastAPI, Uvicorn, scikit-learn, NumPy, pandas and joblib. Install scikit-learn at the version in that file, because `toolsense_model.joblib` was saved with it and may not load with a very different version.

**Node packages** are installed with `npm install` in each folder. Main ones: Express, cors, csv-parse and dotenv (backend); React, Vite and Recharts (frontend); Expo, react-native-svg and expo-audio (mobile).

---

## Access the deployed version

Nothing to install:

- Web dashboard: https://milling-tool-wear-prediction.onrender.com
- ML API docs: https://toolsense-ml-api.onrender.com/docs

Both run on a free hosting plan and go to sleep when unused. The first request after a pause can take up to a minute. Open both links a few minutes before a demo.

---

## Run the project on your PC

Clone the repository:

```bash
git clone https://github.com/ShrutiTanwar664/MILLING-TOOL-WEAR-PREDICTION.git
cd MILLING-TOOL-WEAR-PREDICTION
```

You can either use the deployed ML API (skip step 1 and keep `ML_URL` pointing to it) or run the ML API yourself (do step 1).

### 1. ML API (optional locally)

```bash
cd toolsense-ml-api
```

Create and activate a virtual environment:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python3 -m venv venv
source venv/bin/activate
```

Install the dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn toolsense_api:app --host 127.0.0.1 --port 8000
```

Keep this terminal running. Verify it in a browser:

- http://localhost:8000/health should return `{"status": "ok", ...}` and the list of expected feature names.
- http://localhost:8000/docs opens the interactive Swagger page where you can try the endpoints.

Run the API with a single worker (the default), because the wear history is kept in memory. If port 8000 is busy, use `--port 8001`.

### 2. Backend

Open a new terminal:

```bash
cd backend
npm install
```

Create `backend/.env` (it is ignored by git, so create it on each machine):

```env
ML_URL=https://toolsense-ml-api.onrender.com
PORT=4000
TOOL_ID=c6-demo
THRESHOLD=180
```

If you started the ML API in step 1, set `ML_URL=http://127.0.0.1:8000` instead. Then start the backend:

```bash
npm start
```

It prints `ToolSense backend on :4000`. Make sure `backend/data/c6_aggregated_features.csv` exists.

### 3. Web dashboard

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173) and press **Start**.

**Single-server alternative.** The backend can also serve the built dashboard, which is how it runs on Render:

```bash
npm --prefix frontend install
npm --prefix frontend run build
npm --prefix backend install
npm --prefix backend start
```

Then open http://localhost:4000.

### 4. Mobile app

```bash
cd mobile
npm install
npx expo install react-native-svg expo-audio
npx expo start -c
```

1. Install **Expo Go** on your phone and scan the QR code. If the phone cannot connect, run `npx expo start --tunnel`.
2. The server address is set at the top of `mobile/App.js` (`API_URL`). It points to the deployed backend by default.
3. To use a backend running on your PC, set it to `http://<your-PC-LAN-IP>:4000` and keep the phone on the same Wi-Fi network.
4. Use the **Test alarm** button to check sound and vibration. Raise the media volume on Android and turn off silent mode on iPhone.

---

## Configuration

| Variable | Where | Meaning | Default |
|---|---|---|---|
| `ML_URL` | `backend/.env` or hosting dashboard | Address of the ML API, no trailing slash | none (required) |
| `PORT` | `backend/.env` | Backend port (the host sets it automatically) | 4000 |
| `TOOL_ID` | `backend/.env` | Name under which the ML API stores the tool's history | `c6-demo` |
| `THRESHOLD` | `backend/.env` | Wear limit in µm. Must match the model's threshold. | 180 |
| `NODE_VERSION` | hosting dashboard | Node version for the build | 20 |
| `API_URL` | top of `mobile/App.js` | Backend address used by the mobile app | deployed URL |

---

## API reference

### Backend (Express)

| Method and path | Purpose |
|---|---|
| `POST /api/simulation/start` | Start or resume the replay (optional body `{ "delay": ms }`) |
| `POST /api/simulation/pause` | Pause the replay |
| `POST /api/simulation/reset` | Reset to cut 0 and clear the tool history in the ML API |
| `POST /api/simulation/speed` | Change speed (body `{ "delay": ms }`) |
| `GET /api/simulation/status` | Current state: running, cut index, delay, threshold |
| `GET /api/readings?limit=N` | Readings so far |
| `GET /api/readings/latest` | Most recent reading |
| `GET /api/snapshot?since=N` | State plus only the readings after index N (used by the mobile app) |
| `GET /api/stream` | Live updates for the web dashboard (Server-Sent Events) |

### ML API (FastAPI)

| Method and path | Purpose |
|---|---|
| `GET /health` | Service status and the expected feature names |
| `POST /predict/{tool_id}` | Send one new cut. History is kept per tool in server memory. |
| `POST /predict_history?tool_id=...` | Send all cuts of a tool in order and get the result for the last one. No history is stored. |
| `DELETE /predict/{tool_id}` | Reset a tool's history (use when a new tool is mounted) |

**Live prediction** accepts the features of one cut:

```json
{ "features": { "feature_name_1": 0.0, "feature_name_2": 0.0 } }
```

**Stateless prediction** accepts several cuts in chronological order:

```json
{ "cuts": [ { "feature_name_1": 0.0 }, { "feature_name_1": 0.0 } ] }
```

The examples show only the structure. A real request must contain **all 378 features** with the exact names listed by `/health`. Missing features give a `422 Unprocessable Entity` response.

**Response** (values illustrative):

```json
{ "tool_id": "c6-demo", "cut": 120, "flutes": [95.2, 98.4, 101.3],
  "max_wear": 101.3, "rul": 76, "recommendation": "continue" }
```

`rul` is empty for the first 30 cuts. The 378 features cover cutting force, vibration and acoustic emission, using overall signal statistics and frequency-band statistics.

**Usage notes**

1. Send cuts in chronological order, because smoothing and RUL depend on earlier cuts.
2. Use a unique `tool_id` for each mounted tool, and call `DELETE` when a new tool is mounted.
3. Keep `toolsense_model.joblib` in the same folder as `toolsense_api.py`.
4. Feature names, units and order must match the training data.
5. Add authentication (API key or JWT) before exposing the ML API publicly.

---

## Model and RUL methodology

**Wear prediction.** An equal blend of Ridge regression (on the 30 best features) and a Random Forest. The output is smoothed with a 5-cut moving average and kept non-decreasing with a running maximum. The largest of the three flute values is the tool's maximum wear.

**RUL (Method B).** A calibrated lookup curve, learned from the training cutters with isotonic regression, maps the current wear to the remaining number of cuts. A rate-based Method A is also in the code and was compared in the RUL report, and the calibrated method was more stable. The tool failure limit is **180 µm**, and RUL is available after the first 30 cuts.

**Recommendation and status levels** (from `max_wear / 180`):

| Wear ratio | Wear | API recommendation | Dashboard status |
|---|---|---|---|
| below 0.60 | below 108 µm | `continue` | Normal |
| 0.60 to 0.85 | 108 to 153 µm | `reduce_feed` | Warning |
| 0.85 or more | 153 µm or more | `replace_tool` | Critical |
| | 180 µm or more | `replace_tool` | Limit exceeded |

**Retraining (optional).** Put the `c1`, `c4` and `c6` aggregated feature CSV files next to `toolsense_combined.py` and run:

```bash
cd toolsense-ml-api
python toolsense_combined.py
```

This prints accuracy metrics (including leave-one-cutter-out validation), writes a new `toolsense_model.joblib`, and saves the c6 results CSV and a report plot.

---

## Deploying on Render

**Web app (backend serving the dashboard).** Root directory empty. Build command:
`npm --prefix frontend install --include=dev && npm --prefix frontend run build && npm --prefix backend install`
Start command: `npm --prefix backend start`. Environment variables: `ML_URL` and `NODE_VERSION=20`.

**ML API (separate service).** Root directory `toolsense-ml-api`. Build command: `pip install -r requirements.txt`. Start command: `uvicorn toolsense_api:app --host 0.0.0.0 --port $PORT`. Make sure `toolsense_model.joblib` is committed to the repository.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `python` or `pip` not recognized | Install Python and enable "Add Python to PATH". |
| `ModuleNotFoundError` | Activate the virtual environment and run `pip install -r requirements.txt`. |
| ML API fails to load the model | Check that `toolsense_model.joblib` exists and that the scikit-learn version matches `requirements.txt`. |
| `422` error from the ML API | Some of the 378 features are missing or misnamed. Compare with `/health`. |
| Connection refused | Start the server you are calling, and check the port and `ML_URL`. |
| Port 8000 already in use | Start the ML API on another port, for example `--port 8001`, and update `ML_URL`. |
| "Simulation stopped: fetch failed" or a timeout on the first cut | The ML API was asleep. Wait a minute and press Resume. |
| "Out of sync with ML API" | The ML API restarted mid-run, or cuts arrived out of order. Press Reset, then Start. |
| Backend error about the CSV file | `backend/data/c6_aggregated_features.csv` is missing. |
| `vite: not found` or "Permission denied" during a build | `node_modules` was committed to git. Remove it from the repository and rebuild. |
| Mobile app stuck on "Offline" | Check `API_URL` in `mobile/App.js`, or open `<API_URL>/api/snapshot` in the phone's browser. |
| Mobile app shows an old design | Run `npx expo start -c` and fully close and reopen Expo Go. |
| No alarm sound in the browser | Click Start or the Alarm sound button once, because browsers block sound before a click. |

---

## Limitations

- The 180 µm wear limit is an assumption and should be checked against a cited wear criterion.
- The model is trained on only two cutters, and RUL accuracy cannot be better than wear accuracy. Results on unseen cutters are a preliminary demonstration, not proof of general tool-wear prediction.
- The system replays recorded data. It does not yet read live sensors from a CNC machine.
- The backend keeps one shared simulation in memory. Restarting it, or the ML API, clears the readings, and then you need to press Reset.

## Dataset and reference

Data: PHM Society 2010 Data Challenge, CNC milling tool-wear dataset (Röders Tech RFM760 machining stainless steel, 7 channels sampled at 50 kHz, runs c1 to c6, wear labels available for c1, c4 and c6).

Paper: *ToolSense: A Multi-Sensor Machine Learning Framework for CNC Tool Wear Prediction and Remaining Useful Life Estimation*.

This project was developed as part of the ToolSense tool-wear monitoring work at MNNIT Allahabad.
