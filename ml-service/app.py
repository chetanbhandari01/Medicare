"""
MediCare ML Service - FastAPI prediction endpoint
Run: uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import os
import json
import datetime
import numpy as np
from typing import Optional

# ── Load model on startup ─────────────────────────────────────────────────────
MODEL_PATH    = os.path.join(os.path.dirname(__file__), 'model.pkl')
METADATA_PATH = os.path.join(os.path.dirname(__file__), 'model_metadata.json')

model    = None
metadata = None

def load_model():
    global model, metadata
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH) as f:
                metadata = json.load(f)
        print("✅ ML Model loaded successfully")
    else:
        print("⚠️  Model not found. Run train_model.py first.")

load_model()

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="MediCare ML Service",
    description="Consultation duration prediction & continuous learning API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ───────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    age:       int  = Field(..., ge=0, le=120, description="Patient age")
    visitType: str  = Field(..., description="Type of visit")
    firstVisit:bool = Field(..., description="Is this a first visit?")
    dayOfWeek: str  = Field(..., description="Day of week (Monday-Sunday)")
    timeOfDay: str  = Field(..., description="Morning / Afternoon / Evening")

class PredictResponse(BaseModel):
    predictedDuration: int
    confidenceRange:   int
    visitType:         str
    model_r2:          float

class ConsultationRecord(BaseModel):
    age:            int
    visitType:      str
    firstVisit:     bool
    dayOfWeek:      str
    timeOfDay:      str
    actualDuration: int

class RetrainRequest(BaseModel):
    records: list[ConsultationRecord]

# ── Encoding helpers ──────────────────────────────────────────────────────────
VISIT_TYPE_MAP = {
    'General Consultation': 0,
    'Fever': 1,
    'Diabetes': 2,
    'Blood Pressure': 3,
    'Skin Consultation': 4,
    'Child Consultation': 5,
    'Follow-up': 6,
    'First Visit': 7,
}
DAY_MAP  = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2,
            'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6}
TIME_MAP = {'Morning': 0, 'Afternoon': 1, 'Evening': 2}

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status":       "healthy",
        "model_loaded": model is not None,
        "model_r2":     metadata.get("r2_score") if metadata else None,
        "real_samples": metadata.get("real_samples", 0) if metadata else 0,
        "data_source":  metadata.get("data_source", "synthetic_only") if metadata else "unknown",
    }

@app.get("/model-info")
def model_info():
    """Return full model metadata including real vs synthetic sample counts."""
    if not metadata:
        raise HTTPException(status_code=503, detail="Model metadata not available.")
    return {
        "r2_score":          metadata.get("r2_score", 0.0),
        "cv_r2_score":       metadata.get("cv_r2_score"),
        "mae_minutes":       metadata.get("mae_minutes", 0.0),
        "real_samples":      metadata.get("real_samples", 0),
        "synthetic_samples": metadata.get("synthetic_samples", 0),
        "total_samples":     metadata.get("total_samples", metadata.get("training_samples", 0)),
        "data_source":       metadata.get("data_source", "synthetic_only"),
        "last_trained":      metadata.get("last_trained"),
        "n_estimators":      metadata.get("n_estimators", 200),
        "per_visit_type":    metadata.get("per_visit_type", {}),
    }

@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")

    visit_encoded      = VISIT_TYPE_MAP.get(request.visitType, 0)
    day_encoded        = DAY_MAP.get(request.dayOfWeek, 0)
    time_encoded       = TIME_MAP.get(request.timeOfDay, 0)
    first_visit_encoded = 1 if request.firstVisit else 0

    features = np.array([[
        request.age,
        visit_encoded,
        first_visit_encoded,
        day_encoded,
        time_encoded,
    ]])

    prediction       = model.predict(features)[0]
    predicted_duration = max(5, int(round(prediction)))

    tree_predictions = np.array([tree.predict(features)[0] for tree in model.estimators_])
    std_dev          = np.std(tree_predictions)
    confidence_range = max(2, int(round(std_dev)))

    return PredictResponse(
        predictedDuration=predicted_duration,
        confidenceRange=confidence_range,
        visitType=request.visitType,
        model_r2=metadata.get("r2_score", 0.0) if metadata else 0.0,
    )

@app.post("/predict-batch")
def predict_batch(requests: list[PredictRequest]):
    """Predict durations for multiple patients at once (for slot generation)."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    results = []
    for req in requests:
        visit_encoded       = VISIT_TYPE_MAP.get(req.visitType, 0)
        day_encoded         = DAY_MAP.get(req.dayOfWeek, 0)
        time_encoded        = TIME_MAP.get(req.timeOfDay, 0)
        first_visit_encoded = 1 if req.firstVisit else 0
        features = np.array([[req.age, visit_encoded, first_visit_encoded, day_encoded, time_encoded]])
        pred = model.predict(features)[0]
        results.append(max(5, int(round(pred))))
    return {"predictions": results}

@app.post("/retrain")
def retrain(body: RetrainRequest):
    """
    Retrain the model by blending synthetic data with real consultation records.
    Atomically replaces model.pkl on success.
    """
    global model, metadata

    from retrain_service import blend_and_retrain

    records = [r.model_dump() for r in body.records]
    try:
        result = blend_and_retrain(records)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retraining failed: {str(e)}")

    # Reload the newly saved model into memory
    load_model()

    return {
        "success":    True,
        "message":    f"Model retrained on {result['total_samples']} records "
                      f"({result['real_samples']} real + {result['synthetic_samples']} synthetic)",
        **result,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
