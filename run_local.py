#!/usr/bin/env python3
import uvicorn

if __name__ == "__main__":
    print("Starting Sepsis Predictor API locally...")
    print("Once started, open your browser and go to: http://127.0.0.1:8000")
    
    # We point uvicorn to look at the api/index.py File for the 'app' variable
    uvicorn.run("api.index:app", host="127.0.0.1", port=8000, reload=True)
