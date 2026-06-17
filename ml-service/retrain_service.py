"""
MediCare - Retrain Service
Blends synthetic training data with real clinic consultation history,
retrains the Random Forest model, and atomically replaces model.pkl.
"""
import os
import json
import shutil
import datetime
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR         = os.path.dirname(__file__)
CSV_PATH         = os.path.join(BASE_DIR, '..', 'medicare_consultation_dataset.csv')
MODEL_PATH       = os.path.join(BASE_DIR, 'model.pkl')
MODEL_TEMP_PATH  = os.path.join(BASE_DIR, 'model_new.pkl')
METADATA_PATH    = os.path.join(BASE_DIR, 'model_metadata.json')

# ── Encoding maps (must match app.py) ─────────────────────────────────────────
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
DAY_MAP  = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
            'Friday': 4, 'Saturday': 5, 'Sunday': 6}
TIME_MAP = {'Morning': 0, 'Afternoon': 1, 'Evening': 2}
FEATURES = ['age', 'visitTypeEncoded', 'firstVisitEncoded', 'dayOfWeekEncoded', 'timeOfDayEncoded']
TARGET   = 'consultationDuration'


def _compute_sample_weights(n_real: int, n_synthetic: int):
    """
    Returns (real_weight, synthetic_weight).
    As real data accumulates, its weight increases progressively.
    """
    if n_real < 50:
        return 1.0, 1.0
    elif n_real < 200:
        return 2.0, 1.0
    elif n_real < 500:
        return 3.0, 1.0
    else:
        return 5.0, 0.5


def _encode_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['visitTypeEncoded']  = df['visitType'].map(VISIT_TYPE_MAP).fillna(0).astype(int)
    df['firstVisitEncoded'] = df['firstVisit'].apply(
        lambda v: 1 if (v is True or str(v).strip().lower() in ('yes', 'true', '1')) else 0
    )
    df['dayOfWeekEncoded']  = df['dayOfWeek'].map(DAY_MAP).fillna(0).astype(int)
    df['timeOfDayEncoded']  = df['timeOfDay'].map(TIME_MAP).fillna(0).astype(int)
    return df


def blend_and_retrain(real_records: list) -> dict:
    """
    Blend synthetic CSV + real records, retrain Random Forest, atomically
    replace model.pkl + model_metadata.json. Returns a result dict.

    real_records: list of dicts with keys:
        age, visitType, firstVisit, dayOfWeek, timeOfDay, actualDuration
    """
    # ── Load synthetic data ────────────────────────────────────────────────────
    synth_df = pd.read_csv(CSV_PATH)
    synth_df = synth_df.rename(columns={'consultationDuration': TARGET})
    synth_df = _encode_df(synth_df)
    n_synthetic = len(synth_df)

    # ── Prepare real data ──────────────────────────────────────────────────────
    if real_records:
        real_df = pd.DataFrame(real_records)
        real_df = real_df.rename(columns={'actualDuration': TARGET})
        # Drop records missing essential fields or zero-duration
        real_df = real_df.dropna(subset=['age', 'visitType', 'actualDuration'])
        real_df = real_df[real_df[TARGET] > 0]
        real_df = _encode_df(real_df)
        n_real = len(real_df)
    else:
        real_df = pd.DataFrame(columns=synth_df.columns)
        n_real = 0

    # ── Build combined dataset with sample weights ─────────────────────────────
    real_w, synth_w = _compute_sample_weights(n_real, n_synthetic)

    synth_df['_weight'] = synth_w
    if n_real > 0:
        real_df['_weight'] = real_w

    combined = pd.concat([synth_df, real_df], ignore_index=True) if n_real > 0 else synth_df
    combined = combined.dropna(subset=FEATURES + [TARGET])

    X = combined[FEATURES]
    y = combined[TARGET]
    w = combined['_weight']

    # Need at least 10 samples to split
    if len(X) < 10:
        raise ValueError(f"Insufficient training data: {len(X)} records")

    # ── Train ──────────────────────────────────────────────────────────────────
    test_size = 0.2 if len(X) >= 20 else 0
    if test_size > 0:
        X_train, X_test, y_train, y_test, w_train, _ = train_test_split(
            X, y, w, test_size=test_size, random_state=42
        )
    else:
        X_train, X_test, y_train, y_test, w_train = X, X, y, y, w

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train, sample_weight=w_train)

    # ── Evaluate ───────────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    mae    = float(mean_absolute_error(y_test, y_pred))
    r2     = float(r2_score(y_test, y_pred)) if len(X_test) > 1 else 0.0

    # Cross-validation (only if enough data)
    cv_r2 = None
    if len(X) >= 25:
        cv_scores = cross_val_score(model, X, y, cv=min(5, len(X) // 5), scoring='r2',
                                    fit_params={'sample_weight': w.values})
        cv_r2 = float(cv_scores.mean())

    # Per-visit-type real averages
    per_visit = {}
    if n_real > 0:
        for vt, group in real_df.groupby('visitType'):
            per_visit[vt] = {
                'count':        int(len(group)),
                'avg_duration': round(float(group[TARGET].mean()), 1),
            }

    # ── Atomic model save ──────────────────────────────────────────────────────
    joblib.dump(model, MODEL_TEMP_PATH)
    shutil.move(MODEL_TEMP_PATH, MODEL_PATH)

    # ── Update metadata ────────────────────────────────────────────────────────
    metadata = {
        'features':          FEATURES,
        'visit_type_map':    VISIT_TYPE_MAP,
        'day_map':           DAY_MAP,
        'time_map':          TIME_MAP,
        'r2_score':          r2,
        'cv_r2_score':       cv_r2,
        'mae_minutes':       mae,
        'n_estimators':      200,
        'training_samples':  len(X_train),
        'real_samples':      n_real,
        'synthetic_samples': n_synthetic,
        'total_samples':     len(X),
        'real_weight':       real_w,
        'synthetic_weight':  synth_w,
        'per_visit_type':    per_visit,
        'last_trained':      datetime.datetime.utcnow().isoformat() + 'Z',
        'data_source':       'real_dominant' if n_real > 500 else ('blended' if n_real >= 50 else ('early_blend' if n_real > 0 else 'synthetic_only')),
    }
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)

    return {
        'r2_score':          r2,
        'cv_r2_score':       cv_r2,
        'mae_minutes':       mae,
        'real_samples':      n_real,
        'synthetic_samples': n_synthetic,
        'total_samples':     len(X),
        'data_source':       metadata['data_source'],
        'last_trained':      metadata['last_trained'],
        'per_visit_type':    per_visit,
    }
