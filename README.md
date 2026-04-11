# NEONATAL_EARLY_SEPSIS_PREDICTION

## Model 2: Ensemble Approach

### Overview
Model 2 implements a **soft voting ensemble** combining XGBoost and CatBoost classifiers to predict neonatal sepsis from early clinical features. The model is designed for early detection with strict focus on minimizing data leakage and using only at-birth/early symptoms.

### Dataset
- **Source**: African Neonatal Sepsis Dataset (Hugging Face)
- **Size**: Full training split converted to Pandas DataFrame
- **Target**: Binary classification (`sepsis_status`: Positive/Negative)

### Preprocessing Strategy

#### Strict Early Prediction Mode
The preprocessing deliberately removes:
1. **True Leakage Features**: patient_id, sepsis_onset, culture_confirmed, pathogen, outcome, hospital_days, sepsis_probability_score
2. **Diagnostic Symptoms/Labs**: fever, hypothermia, respiratory_distress, poor_feeding, lethargy, jaundice, WBC count, CRP level
3. **Redundant Features**: birth_weight_grams (converted from kg)

#### Data Handling
- Boolean features converted to integers
- Categorical feature (`delivery_mode`) handled separately:
  - **XGBoost**: One-hot encoded
  - **CatBoost**: Native categorical support
- 80-20 train-test split with stratification

### Models

#### 1. XGBoost Classifier
- **Hyperparameters**:
  - `scale_pos_weight`: Dynamically calculated from class imbalance ratio
  - `n_estimators`: 200
  - `learning_rate`: 0.05
  - `max_depth`: 6
  - `n_jobs`: -1 (parallel processing)

#### 2. CatBoost Classifier
- **Hyperparameters**:
  - `auto_class_weights`: Balanced
  - `iterations`: 200
  - `depth`: 6
  - `learning_rate`: 0.05
  - `verbose`: 0
- Handles categorical features natively for better performance

#### 3. Soft Voting Ensemble
- **Strategy**: Average predicted probabilities from both models
- **Threshold Tuning**: Calibrated to achieve ~85% recall (high sensitivity for early detection)
- Formula: `y_prob_ensemble = (y_prob_xgb + y_prob_cat) / 2`

### Evaluation Metrics

#### Performance Comparison
The models are evaluated using:
- **ROC-AUC**: Overall discriminative ability
- **Precision-Recall AUC**: Class imbalance-aware metric
- **Confusion Matrix**: Visual assessment of FP/FN rates
- **Classification Report**: Precision, recall, F1-score per class

#### Key Finding
The ensemble approach provides balanced performance between XGBoost and CatBoost, with threshold tuning enabling:
- **Target Recall**: 85% (minimize missed sepsis cases)
- **Precision Optimization**: Determined by threshold selection

### Threshold Tuning
Using `precision_recall_curve`:
- Grid search across all probability thresholds
- Select threshold that achieves 85% recall on test set
- Evaluate expected precision at chosen threshold
- Apply threshold to predictions for deployment

### Results Visualization
The model generates three key visualizations:
1. **ROC & Precision-Recall Curves**: Side-by-side comparison of all three models
2. **Confusion Matrices**: Comparison across XGBoost, CatBoost, and Ensemble
3. **Threshold Visualization**: Precision-recall trade-off analysis

### Usage

#### Running the Model
```python
# Load and run the notebook
jupyter notebook model2.ipynb
```

#### Making Predictions
```python
# Using ensemble with tuned threshold
y_prob_ensemble = (xgb_model.predict_proba(X) + cat_model.predict_proba(X)[:, 1]) / 2
y_pred = (y_prob_ensemble >= optimal_threshold).astype(int)
```

### Dependencies
- `datasets`: For Hugging Face dataset loading
- `pandas`: Data manipulation
- `scikit-learn`: Train-test split, metrics, preprocessing
- `xgboost`: XGBoost classifier
- `catboost`: CatBoost classifier
- `matplotlib` & `seaborn`: Visualization
- `numpy`: Numerical operations

### Model Selection Rationale
1. **Ensemble Approach**: Combines strengths of both algorithms for robustness
2. **High Recall Focus**: Early sepsis detection is critical in clinical settings
3. **Strict Preprocessing**: Ensures model learns from at-birth features only, improving generalization
4. **Dynamic Class Weights**: Accounts for class imbalance without manual tuning

### Clinical Implications
- **Target Use**: Early neonatal sepsis screening
- **Conservative Thresholding**: Prioritizes sensitivity (catching true sepsis cases) over specificity
- **Not for Replacement**: Should supplement, not replace, clinical judgment

### Future Improvements
- Hyperparameter optimization using Bayesian search
- Cross-validation for robustness
- Feature importance analysis
- Model interpretability (SHAP values)
- Threshold optimization per deployment context

### Author Notes
This model demonstrates the importance of:
- Handling data leakage strictly in medical AI
- Balancing model performance metrics with clinical objectives
- Using ensemble methods for improved generalization