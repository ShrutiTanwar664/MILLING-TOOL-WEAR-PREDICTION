"""
ToolSense API  (FastAPI)

Setup
  1. Rename your script untitled4.py -> toolsense_combined.py
  2. Run it once:  python toolsense_combined.py   (creates toolsense_model.joblib)
  3. Put toolsense_combined.py, toolsense_model.joblib and this file in one folder
  4. pip install -r requirements.txt
  5. uvicorn toolsense_api:app --host 0.0.0.0 --port 8000
  6. Open http://localhost:8000/docs  for the interactive docs

Endpoints
  POST   /predict/{tool_id}   live: send ONE new cut's features, history is kept per tool
  POST   /predict_history     stateless: send ALL cuts of a tool (in order), get the last result
  DELETE /predict/{tool_id}   reset a tool's history (use when a new tool is mounted)
  GET    /health              check the service and the expected feature names
"""
from threading import Lock
from typing import Dict, List

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from toolsense_combined import (WARMUP, WearPredictor, calibrated_rul,
                                get_recommendation)

MODEL_PATH = "toolsense_model.joblib"

artifacts = joblib.load(MODEL_PATH)
rul_curve = artifacts["rul_curve"]          # method B curve
FEATURE_COLS: List[str] = artifacts["feature_cols"]

app = FastAPI(title="ToolSense API", version="1.0")

# tool_id -> WearPredictor (in memory; run with ONE worker, see notes at the bottom)
sessions: Dict[str, WearPredictor] = {}
lock = Lock()


# ---------------------------------------------------------------- schemas
class CutFeatures(BaseModel):
    features: Dict[str, float]               # {feature_name: value}


class HistoryRequest(BaseModel):
    cuts: List[Dict[str, float]]              # one dict per cut, in cut order


class PredictionResponse(BaseModel):
    tool_id: str
    cut: int
    flutes: List[float]
    max_wear: float
    rul: int | None                           # method B, None until WARMUP cuts
    recommendation: str


# ---------------------------------------------------------------- helpers
def check_features(features: Dict[str, float]):
    missing = [c for c in FEATURE_COLS if c not in features]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"error": "missing features", "count": len(missing),
                    "examples": missing[:10]})


def build_response(tool_id: str, out: dict) -> PredictionResponse:
    max_wear = out["max_wear"]
    cut = out["cut"]
    rul = calibrated_rul(max_wear, rul_curve) if cut >= WARMUP else None
    return PredictionResponse(
        tool_id=tool_id, cut=cut, flutes=out["flutes"], max_wear=max_wear,
        rul=rul, recommendation=get_recommendation(max_wear))


# ---------------------------------------------------------------- endpoints
@app.get("/health")
def health():
    return {"status": "ok", "n_features": len(FEATURE_COLS),
            "feature_cols": FEATURE_COLS, "active_tools": list(sessions)}


@app.post("/predict/{tool_id}", response_model=PredictionResponse)
def predict_live(tool_id: str, body: CutFeatures):
    """Live mode: call once per new cut, in order."""
    check_features(body.features)
    with lock:
        if tool_id not in sessions:
            sessions[tool_id] = WearPredictor(artifacts)
        out = sessions[tool_id].predict_cut(body.features)
    return build_response(tool_id, out)


@app.delete("/predict/{tool_id}")
def reset_tool(tool_id: str):
    """Call when a new tool is mounted so the history starts from zero."""
    with lock:
        existed = sessions.pop(tool_id, None) is not None
    return {"tool_id": tool_id, "reset": existed}


@app.post("/predict_history", response_model=PredictionResponse)
def predict_history(tool_id: str, body: HistoryRequest):
    """Stateless mode: send every cut of one tool, in cut order."""
    if not body.cuts:
        raise HTTPException(status_code=422, detail="cuts is empty")
    predictor = WearPredictor(artifacts)      # fresh, nothing stored
    out = None
    for features in body.cuts:
        check_features(features)
        out = predictor.predict_cut(features)
    return build_response(tool_id, out)


# ---------------------------------------------------------------- notes
# * Run with ONE worker. Sessions live in memory, so several workers would each
#   have their own history. For many workers or restarts, store raw_history,
#   running and max_wear_history per tool in Redis/DB and restore them into a
#   WearPredictor before calling predict_cut (or use /predict_history).
# * Cuts of the same tool must arrive in order (smoothing + running max).
# * Add authentication (API key / JWT) before exposing this outside your network.
