import os
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from catboost import CatBoostClassifier, Pool
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

FEATURE_LABELS = {
    "gestational_age_weeks": "Gestational Age",
    "birth_weight_kg": "Birth Weight",
    "low_birth_weight": "Low Birth Weight Flag",
    "very_low_birth_weight": "Very Low Birth Weight",
    "maternal_age": "Maternal Age",
    "young_mother": "Young Mother Flag",
    "prom": "PROM (>18h)",
    "maternal_infection": "Maternal Infection",
    "delivery_mode": "Delivery Mode",
    "apgar_1min": "Apgar Score (1 min)",
    "apgar_5min": "Apgar Score (5 min)",
    "resuscitation_needed": "Resuscitation Needed",
}

@app.post("/api/predict")
def predict_sepsis(features: PatientFeatures):
    if not cat_model:
        return {"error": "Models not loaded"}
        
    data = features.dict()
    df_cat = pd.DataFrame([data])
    
    prob_cat = cat_model.predict_proba(df_cat)[0][1]
    prob_ensemble = float(prob_cat)
    threshold = 0.4
    is_high_risk = prob_ensemble >= threshold

    # Compute SHAP values — requires Pool with categorical feature declared
    contributions = []
    try:
        pool = Pool(df_cat, cat_features=["delivery_mode"])
        shap_vals = cat_model.get_feature_importance(pool, type='ShapValues')
        feature_names = list(data.keys())
        shap_for_positive = shap_vals[0][:-1]  # exclude bias term
        pairs = list(zip(feature_names, shap_for_positive))
        pairs.sort(key=lambda x: abs(x[1]), reverse=True)
        for fname, shap_val in pairs[:8]:
            contributions.append({
                "feature": FEATURE_LABELS.get(fname, fname),
                "value": round(float(shap_val), 4),
                "raw_value": str(data.get(fname, ""))
            })
    except Exception as e:
        print(f"SHAP error: {e}")

    return {
        "risk_probability": round(prob_ensemble, 4),
        "is_high_risk": bool(is_high_risk),
        "contributions": contributions,
        "details": {
            "catboost_prob": round(float(prob_cat), 4)
        }
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "models_loaded": (cat_model is not None)}

# ====== LOCAL SERVING LOGIC ======
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Get the root directory (one level up from api/index.py)
root_dir = os.path.dirname(os.path.dirname(__file__))

# Mount static files directly from the root directory so local running works
app.mount("/static", StaticFiles(directory=root_dir), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(root_dir, "index.html"))

@app.get("/{filename}")
def serve_root_files(filename: str):
    # Serve styles.css and app.js correctly if requested from root
    file_path = os.path.join(root_dir, filename)
    if os.path.exists(file_path) and filename in ["styles.css", "app.js", "hero.png", "output.png", "training_visual.png"]:
        return FileResponse(file_path)
    return {"error": "File not found"}
