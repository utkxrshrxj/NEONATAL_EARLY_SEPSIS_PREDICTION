import os
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from catboost import CatBoostClassifier
import numpy as np

app = FastAPI(title="Neonatal Sepsis Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
cat_model = None

@app.on_event("startup")
def load_models():
    global cat_model
    print("Loading models...")
    
    base_dir = os.path.dirname(__file__)
    cat_path = os.path.join(base_dir, "models", "cat_model.cbm")
    
    if os.path.exists(cat_path):
        cat_model = CatBoostClassifier()
        cat_model.load_model(cat_path)
        
    print("Models loaded successfully!")

class PatientFeatures(BaseModel):
    gestational_age_weeks: float
    birth_weight_kg: float
    low_birth_weight: bool
    very_low_birth_weight: bool
    maternal_age: float
    young_mother: bool
    prom: bool
    maternal_infection: bool
    delivery_mode: str
    apgar_1min: int
    apgar_5min: int
    resuscitation_needed: bool

@app.post("/api/predict")
def predict_sepsis(features: PatientFeatures):
    if not cat_model:
        return {"error": "Models not loaded"}
        
    data = features.dict()
    df_raw = pd.DataFrame([data])
    df_cat = df_raw.copy()
    
    prob_cat = cat_model.predict_proba(df_cat)[0][1]
    prob_ensemble = float(prob_cat) 
    
    threshold = 0.4 
    is_high_risk = prob_ensemble >= threshold
    
    return {
        "risk_probability": round(prob_ensemble, 4),
        "is_high_risk": bool(is_high_risk),
        "details": {
            "catboost_prob": round(float(prob_cat), 4)
        }
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "models_loaded": (cat_model is not None)}
