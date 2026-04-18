import os
import pandas as pd
from datasets import load_dataset
from sklearn.model_selection import train_test_split
from catboost import CatBoostClassifier

def main():
    print("Downloading/Loading dataset...")
    dataset = load_dataset("electricsheepafrica/african-neonatal-sepsis-dataset")
    df = pd.DataFrame(dataset['train'])

    print(f"Dataset loaded! Shape: {df.shape}")

    y = df['sepsis_status'].map({'Positive': 1, 'Negative': 0})

    leakage_and_symptoms = [
        'patient_id', 'sepsis_status', 'sepsis_onset', 
        'culture_confirmed', 'pathogen', 'outcome', 
        'hospital_days', 'sepsis_probability_score',
        'fever', 'hypothermia', 'respiratory_distress', 
        'poor_feeding', 'lethargy', 'jaundice', 
        'wbc_count', 'crp_mg_l', 'birth_weight_grams'
    ]
    X_raw = df.drop(columns=leakage_and_symptoms)

    bool_cols = X_raw.select_dtypes(include='bool').columns
    X_raw[bool_cols] = X_raw[bool_cols].astype(int)

    X_cat = X_raw.copy()
    cat_features_list = ['delivery_mode'] 

    X_xgb = pd.get_dummies(X_raw, columns=['delivery_mode'], drop_first=True)

    X_train_xgb, X_test_xgb, y_train, y_test = train_test_split(
        X_xgb, y, test_size=0.2, random_state=42, stratify=y
    )
    X_train_cat, X_test_cat, _, _ = train_test_split(
        X_cat, y, test_size=0.2, random_state=42, stratify=y
    )

    print("\nSkipping XGBoost (requires OpenMP on this system)")
    
    print("Training CatBoost...")
    cat_model = CatBoostClassifier(
        auto_class_weights='Balanced',
        iterations=100, # reduced iterations
        depth=6,
        learning_rate=0.05,
        random_state=42,
        verbose=0 
    )
    cat_model.fit(X_train_cat, y_train, cat_features=cat_features_list)

    # Make models directory
    os.makedirs('backend/models', exist_ok=True)
    
    # Save the models
    cat_model.save_model('backend/models/cat_model.cbm')

    print("Model saved successfully in backend/models/")

if __name__ == '__main__':
    main()
