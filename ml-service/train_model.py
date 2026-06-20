"""
MediCare ML Service - Train Random Forest model on consultation dataset
Usage: python train_model.py
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

# ── Load dataset ──────────────────────────────────────────────────────────────
# Check local directory first (Railway), then parent directory (local dev)
CSV_LOCAL  = os.path.join(os.path.dirname(__file__), 'medicare_consultation_dataset.csv')
CSV_PARENT = os.path.join(os.path.dirname(__file__), '..', 'medicare_consultation_dataset.csv')
CSV_PATH   = CSV_LOCAL if os.path.exists(CSV_LOCAL) else CSV_PARENT
df = pd.read_csv(CSV_PATH)
print(f"Dataset loaded: {len(df)} records")
print(df.head())

# ── Feature Engineering ───────────────────────────────────────────────────────
# visitType encoding
visit_type_map = {
    'General Consultation': 0,
    'Fever': 1,
    'Diabetes': 2,
    'Blood Pressure': 3,
    'Skin Consultation': 4,
    'Child Consultation': 5,
    'Follow-up': 6,
    'First Visit': 7,
}

# dayOfWeek encoding (Monday=0 ... Sunday=6)
day_map = {
    'Monday': 0,
    'Tuesday': 1,
    'Wednesday': 2,
    'Thursday': 3,
    'Friday': 4,
    'Saturday': 5,
    'Sunday': 6,
}

# timeOfDay encoding
time_map = {
    'Morning': 0,
    'Afternoon': 1,
    'Evening': 2,
}

df['visitTypeEncoded'] = df['visitType'].map(visit_type_map).fillna(0).astype(int)
df['firstVisitEncoded'] = (df['firstVisit'].str.strip().str.lower() == 'yes').astype(int)
df['dayOfWeekEncoded'] = df['dayOfWeek'].map(day_map).fillna(0).astype(int)
df['timeOfDayEncoded'] = df['timeOfDay'].map(time_map).fillna(0).astype(int)

# Features & target
FEATURES = ['age', 'visitTypeEncoded', 'firstVisitEncoded', 'dayOfWeekEncoded', 'timeOfDayEncoded']
TARGET = 'consultationDuration'

X = df[FEATURES]
y = df[TARGET]

# ── Train / Test split ────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# ── Model Training ────────────────────────────────────────────────────────────
model = RandomForestRegressor(
    n_estimators=200,
    max_depth=10,
    min_samples_split=4,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# ── Evaluation ────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f"\n=== Model Evaluation ===")
print(f"R² Score:  {r2:.4f}")
print(f"MAE:       {mae:.2f} minutes")

# Cross-validation
cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
print(f"CV R² (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Feature importances
print(f"\n=== Feature Importances ===")
for feat, imp in sorted(zip(FEATURES, model.feature_importances_), key=lambda x: -x[1]):
    print(f"  {feat:25s}: {imp:.4f}")

# ── Save Model & Metadata ─────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
METADATA_PATH = os.path.join(os.path.dirname(__file__), 'model_metadata.json')

joblib.dump(model, MODEL_PATH)
print(f"\nModel saved to: {MODEL_PATH}")

import json
metadata = {
    'features': FEATURES,
    'visit_type_map': visit_type_map,
    'day_map': day_map,
    'time_map': time_map,
    'r2_score': float(r2),
    'mae_minutes': float(mae),
    'n_estimators': 200,
    'training_samples': len(X_train),
}
with open(METADATA_PATH, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"Metadata saved to: {METADATA_PATH}")
