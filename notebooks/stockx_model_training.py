# %% [markdown]
# # 🚀 StockX — Model Training Pipeline
# **Decision Quality Engine for NSE Retail Traders**
#
# This notebook trains and exports all ML models used in the StockX 5-layer stack:
# | Layer | Model | Purpose |
# |-------|-------|---------|
# | 1 | XGBoost | Signal Intelligence — technical setup quality scoring |
# | 2 | Monte Carlo (GBM) | Risk Simulation — no training needed (statistical) |
# | 3 | Isolation Forest | Pump & Dump Detection — anomaly detection |
# | 4 | FinBERT (HuggingFace) | Sentiment Gap — financial text classification |
# | 5 | Rule-Based | Behavioural Guardrails — no training needed |
#
# **Dataset**: NIFTY 50 stocks via `yfinance` (free, widely available), chunked to 6 months.

# %% [markdown]
# ## 0. Install Dependencies

# %%
!python3 -m pip install yfinance xgboost scikit-learn pandas numpy joblib transformers torch --quiet

# %%
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import os, joblib

print("✅ Core imports loaded")

# %% [markdown]
# ## 1. Data Collection — NIFTY 50 Stocks (Chunked)
# We download 6-month daily OHLCV for 15 liquid NIFTY stocks.
# This keeps the dataset ~15K rows — lightweight but representative.

# %%
TICKERS = [
    "RELIANCE", "HDFCBANK", "INFY", "TCS", "ICICIBANK",
    "SBIN", "TATASTEEL", "WIPRO", "ADANIPORTS", "BAJFINANCE",
    "MARUTI", "SUNPHARMA", "TATAMOTORS", "AXISBANK", "LT"
]

def download_nifty_data(tickers, period="6mo"):
    """Download OHLCV data for a list of NSE tickers."""
    all_data = {}
    for sym in tickers:
        try:
            df = yf.download(f"{sym}.NS", period=period, interval="1d",
                             progress=False, auto_adjust=True)
            if df.empty:
                print(f"  ⚠ {sym}: No data")
                continue
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df = df.dropna()
            if len(df) < 50:
                print(f"  ⚠ {sym}: Only {len(df)} rows, skipping")
                continue
            df['Symbol'] = sym
            all_data[sym] = df
            print(f"  ✅ {sym}: {len(df)} rows")
        except Exception as e:
            print(f"  ❌ {sym}: {e}")
    return all_data

print("📥 Downloading NIFTY stock data...")
stock_data = download_nifty_data(TICKERS)
print(f"\n📊 Total stocks loaded: {len(stock_data)}")
print(f"📊 Total rows: {sum(len(v) for v in stock_data.values())}")

# %% [markdown]
# ## 2. Feature Engineering
# Compute all technical indicators used by StockX layers.

# %%
def compute_features(df):
    """Compute full technical feature set from OHLCV data."""
    close = df['Close'].astype(float)
    volume = df['Volume'].astype(float)
    high = df['High'].astype(float)
    low = df['Low'].astype(float)

    feat = pd.DataFrame(index=df.index)

    # RSI (14-period)
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    rs = gain / (loss + 1e-10)
    feat['rsi'] = 100 - (100 / (1 + rs))

    # MACD
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    feat['macd'] = ema12 - ema26
    feat['macd_signal'] = feat['macd'].ewm(span=9).mean()
    feat['macd_hist'] = feat['macd'] - feat['macd_signal']

    # EMAs
    feat['ema20'] = close.ewm(span=20).mean()
    feat['ema50'] = close.ewm(span=50).mean()
    feat['ema200'] = close.ewm(span=200, min_periods=50).mean()
    feat['price'] = close

    # Price relative to EMAs
    feat['price_above_ema20'] = (close > feat['ema20']).astype(int)
    feat['price_above_ema50'] = (close > feat['ema50']).astype(int)
    feat['price_above_ema200'] = (close > feat['ema200']).astype(int)

    # ATR (14-period)
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs()
    ], axis=1).max(axis=1)
    feat['atr'] = tr.rolling(14).mean()
    feat['atr_pct'] = feat['atr'] / close * 100

    # Volume ratio
    feat['vol_30d_avg'] = volume.rolling(30).mean()
    feat['vol_ratio'] = volume / (feat['vol_30d_avg'] + 1)

    # Bollinger Bands position
    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std
    feat['bb_pos'] = (close - bb_lower) / (bb_upper - bb_lower + 1e-10)

    # Momentum
    feat['mom5'] = close.pct_change(5) * 100
    feat['mom20'] = close.pct_change(20) * 100
    feat['daily_return'] = close.pct_change() * 100

    # Volume-price divergence (for pump detection)
    feat['vol_price_div'] = feat['vol_ratio'] - feat['daily_return'].abs() / 3
    feat['delivery_proxy'] = (close - low) / (high - low + 1e-10)

    return feat.dropna()


print("⚙️ Computing features for all stocks...")
features_dict = {}
for sym, df in stock_data.items():
    feat = compute_features(df)
    feat['symbol'] = sym
    features_dict[sym] = feat
    print(f"  {sym}: {len(feat)} feature rows")

all_features = pd.concat(features_dict.values(), ignore_index=True)
print(f"\n✅ Total feature matrix: {all_features.shape}")

# %% [markdown]
# ## 3. LAYER 1 — XGBoost Signal Intelligence
#
# **Goal**: Score technical setup quality (0–100).
#
# **Label generation**: We create a forward-looking label — did the stock go up >3%
# in the next 5 trading days? This becomes our "good setup" target.

# %%
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    classification_report, accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, roc_auc_score, roc_curve
)

def create_signal_labels(df_features, stock_df_dict):
    """Create forward-looking labels: did price rise >3% in next 5 days?"""
    labels = []
    for sym in df_features['symbol'].unique():
        sym_feat = df_features[df_features['symbol'] == sym].copy()
        if sym not in stock_df_dict:
            continue
        close = stock_df_dict[sym]['Close'].astype(float)
        # Forward return over next 5 days
        fwd_return = close.shift(-5) / close - 1
        fwd_return = fwd_return.reindex(sym_feat.index if hasattr(sym_feat, 'original_index') else close.index)
        sym_feat = sym_feat.head(len(fwd_return))
        sym_feat['fwd_return'] = fwd_return.values[:len(sym_feat)]
        sym_feat['label'] = (sym_feat['fwd_return'] > 0.03).astype(int)
        labels.append(sym_feat)
    return pd.concat(labels, ignore_index=True).dropna()

# Rebuild features keeping the original index
features_with_idx = {}
for sym, df in stock_data.items():
    feat = compute_features(df)
    close = df['Close'].astype(float)
    fwd = (close.shift(-5) / close - 1).reindex(feat.index)
    feat['fwd_return'] = fwd
    feat['label'] = (feat['fwd_return'] > 0.03).astype(int)
    feat['symbol'] = sym
    features_with_idx[sym] = feat

labeled_df = pd.concat(features_with_idx.values()).dropna()
print(f"📊 Labeled dataset: {len(labeled_df)} rows")
print(f"📊 Label distribution:\n{labeled_df['label'].value_counts()}")

# %%
# Select XGBoost features
XGBOOST_FEATURES = [
    'rsi', 'macd_hist', 'price_above_ema20', 'price_above_ema50',
    'price_above_ema200', 'vol_ratio', 'bb_pos', 'atr_pct',
    'mom5', 'mom20', 'daily_return'
]

X = labeled_df[XGBOOST_FEATURES]
y = labeled_df['label']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"Train: {len(X_train)} | Test: {len(X_test)}")
print(f"Train label split: {dict(y_train.value_counts())}")

# %%
# Train XGBoost
xgb_model = XGBClassifier(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=3,
    gamma=0.1,
    random_state=42,
    eval_metric='logloss',
    use_label_encoder=False
)

xgb_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

y_pred = xgb_model.predict(X_test)
y_proba = xgb_model.predict_proba(X_test)[:, 1]

# Cross-validation
cv_scores = cross_val_score(xgb_model, X, y, cv=5, scoring='accuracy')

print("=" * 60)
print("📈 LAYER 1: XGBoost Signal Intelligence — FULL METRICS")
print("=" * 60)

# Core metrics
acc  = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred, zero_division=0)
rec  = recall_score(y_test, y_pred, zero_division=0)
f1   = f1_score(y_test, y_pred, zero_division=0)
auc  = roc_auc_score(y_test, y_proba)

print(f"\n┌─────────────────────────────────────┐")
print(f"│  Accuracy       :  {acc:.4f}           │")
print(f"│  Precision      :  {prec:.4f}           │")
print(f"│  Recall         :  {rec:.4f}           │")
print(f"│  F1 Score       :  {f1:.4f}           │")
print(f"│  ROC-AUC        :  {auc:.4f}           │")
print(f"│  5-Fold CV Acc  :  {cv_scores.mean():.4f} ± {cv_scores.std():.4f}  │")
print(f"└─────────────────────────────────────┘")

# Classification report
print(f"\n📋 Classification Report:")
print(classification_report(y_test, y_pred, target_names=['Bad Setup (0)', 'Good Setup (1)']))

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)
print(f"📊 Confusion Matrix:")
print(f"                 Predicted")
print(f"                 Bad   Good")
print(f"  Actual Bad   [{cm[0,0]:5d}  {cm[0,1]:5d}]")
print(f"  Actual Good  [{cm[1,0]:5d}  {cm[1,1]:5d}]")
print(f"")
print(f"  True Negatives:  {cm[0,0]}  (correctly flagged bad setups)")
print(f"  False Positives: {cm[0,1]}  (bad setups predicted as good)")
print(f"  False Negatives: {cm[1,0]}  (missed good setups)")
print(f"  True Positives:  {cm[1,1]}  (correctly found good setups)")

# ROC curve data
fpr, tpr, thresholds = roc_curve(y_test, y_proba)
print(f"\n📈 ROC Curve Sample Points (FPR → TPR):")
for i in range(0, len(fpr), max(1, len(fpr)//8)):
    print(f"  FPR={fpr[i]:.3f}  TPR={tpr[i]:.3f}  threshold={thresholds[i]:.3f}")

# %%
# Feature importance
import_df = pd.DataFrame({
    'feature': XGBOOST_FEATURES,
    'importance': xgb_model.feature_importances_
}).sort_values('importance', ascending=False)
print("\n🏆 Feature Importance:")
for _, row in import_df.iterrows():
    bar = "█" * int(row['importance'] * 50)
    print(f"  {row['feature']:25s} {row['importance']:.3f} {bar}")

# %% [markdown]
# ## 4. LAYER 3 — Isolation Forest (Pump & Dump Detection)
#
# **Goal**: Detect anomalous volume-price patterns.
# Trained on historical "normal" data, flags outliers as potential manipulation.

# %%
from sklearn.ensemble import IsolationForest

ISO_FEATURES = ['vol_ratio', 'daily_return', 'vol_price_div', 'delivery_proxy']

# Use all historical data as "mostly normal"
iso_data = all_features[ISO_FEATURES].copy()
print(f"📊 Isolation Forest training data: {len(iso_data)} rows")

iso_model = IsolationForest(
    n_estimators=200,
    contamination=0.05,  # expect ~5% anomalies
    max_samples='auto',
    random_state=42,
    n_jobs=-1
)

iso_model.fit(iso_data)

# Predict anomalies
predictions = iso_model.predict(iso_data)
anomaly_scores = iso_model.decision_function(iso_data)

n_anomalies = (predictions == -1).sum()
n_normal = (predictions == 1).sum()

print(f"\n{'=' * 60}")
print(f"🔍 LAYER 3: Isolation Forest — FULL METRICS")
print(f"{'=' * 60}")

# Create synthetic ground truth using extreme thresholds
# (vol_ratio > 3 AND |daily_return| > 4%) → likely pump
gt_anomaly = ((iso_data['vol_ratio'] > 3) & (iso_data['daily_return'].abs() > 4)).astype(int)
iso_pred_binary = (predictions == -1).astype(int)

iso_acc  = accuracy_score(gt_anomaly, iso_pred_binary)
iso_prec = precision_score(gt_anomaly, iso_pred_binary, zero_division=0)
iso_rec  = recall_score(gt_anomaly, iso_pred_binary, zero_division=0)
iso_f1   = f1_score(gt_anomaly, iso_pred_binary, zero_division=0)

print(f"\n┌──────────────────────────────────────────┐")
print(f"│  Total Samples     :  {len(iso_data):>6d}              │")
print(f"│  Anomalies Found   :  {n_anomalies:>6d} ({n_anomalies/len(iso_data)*100:.1f}%)       │")
print(f"│  Normal            :  {n_normal:>6d} ({n_normal/len(iso_data)*100:.1f}%)       │")
print(f"│                                          │")
print(f"│  vs Heuristic Ground Truth:              │")
print(f"│  Accuracy          :  {iso_acc:.4f}              │")
print(f"│  Precision         :  {iso_prec:.4f}              │")
print(f"│  Recall            :  {iso_rec:.4f}              │")
print(f"│  F1 Score          :  {iso_f1:.4f}              │")
print(f"└──────────────────────────────────────────┘")

# Confusion matrix
iso_cm = confusion_matrix(gt_anomaly, iso_pred_binary)
print(f"\n📊 Confusion Matrix (vs heuristic ground truth):")
print(f"                 Predicted")
print(f"                Normal  Anomaly")
print(f"  Actual Normal [{iso_cm[0,0]:5d}   {iso_cm[0,1]:5d}]")
print(f"  Actual Anomaly[{iso_cm[1,0]:5d}   {iso_cm[1,1]:5d}]")

print(f"\n📊 Anomaly Score Distribution:")
print(f"  Min:    {anomaly_scores.min():.4f}")
print(f"  Q1:     {np.percentile(anomaly_scores, 25):.4f}")
print(f"  Median: {np.median(anomaly_scores):.4f}")
print(f"  Q3:     {np.percentile(anomaly_scores, 75):.4f}")
print(f"  Max:    {anomaly_scores.max():.4f}")
print(f"  Mean:   {anomaly_scores.mean():.4f}")
print(f"  Std:    {anomaly_scores.std():.4f}")

# Show anomalous samples
anomaly_mask = predictions == -1
if anomaly_mask.any():
    print(f"\n📋 Top 5 anomalous data points:")
    anomaly_df = iso_data[anomaly_mask].copy()
    anomaly_df['anomaly_score'] = anomaly_scores[anomaly_mask]
    print(anomaly_df.sort_values('anomaly_score').head(5).to_string())

# %% [markdown]
# ## 5. LAYER 4 — Sentiment Analysis (FinBERT)
#
# We load the pre-trained **ProsusAI/finbert** model from HuggingFace.
# FinBERT is already trained on financial text — we just validate it works
# and export the pipeline for inference.
#
# > **Note**: FinBERT download is ~400MB. Skip this cell if on slow internet.

# %%
try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    import torch

    print("📥 Loading FinBERT (ProsusAI/finbert)...")
    finbert_tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
    finbert_model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")

    sentiment_pipeline = pipeline(
        "sentiment-analysis",
        model=finbert_model,
        tokenizer=finbert_tokenizer,
        top_k=None
    )

    # Validate with sample financial headlines
    test_headlines = [
        "Reliance Industries reports record quarterly profit, beats all estimates",
        "HDFC Bank shares plunge 8% after disappointing loan growth numbers",
        "Infosys maintains guidance, stable outlook for IT sector",
        "Suzlon Energy stock surges 15% on massive order win",
        "Tata Steel warns of margin pressure amid falling steel prices",
        "SBI posts strong NII growth, asset quality improves significantly",
        "Adani Ports faces fresh regulatory probe, shares under pressure",
        "Market remains range-bound, Nifty closes flat near 22000 level"
    ]

    # Expected labels for our test headlines
    expected_labels = [
        'positive', 'negative', 'neutral', 'positive',
        'negative', 'positive', 'negative', 'neutral'
    ]

    print(f"\n{'=' * 60}")
    print(f"🧠 LAYER 4: FinBERT Sentiment Analysis — FULL METRICS")
    print(f"{'=' * 60}")
    print(f"Model: ProsusAI/finbert")
    print(f"Parameters: ~110M (BERT-base)")
    print(f"\n📋 Validation on sample headlines:\n")

    predicted_labels = []
    confidences = []
    for i, headline in enumerate(test_headlines):
        result = sentiment_pipeline(headline)[0]
        top = max(result, key=lambda x: x['score'])
        predicted_labels.append(top['label'])
        confidences.append(top['score'])
        match = "✅" if top['label'] == expected_labels[i] else "❌"
        emoji = "🟢" if top['label'] == 'positive' else "🔴" if top['label'] == 'negative' else "⚪"
        print(f"  {emoji} [{top['label']:8s} {top['score']:.2f}] {match} {headline[:65]}")

    # Compute metrics
    from sklearn.metrics import classification_report as cr, confusion_matrix as cm_fn
    from sklearn.preprocessing import LabelEncoder
    le = LabelEncoder()
    all_labels = list(set(expected_labels + predicted_labels))
    le.fit(all_labels)
    y_true_enc = le.transform(expected_labels)
    y_pred_enc = le.transform(predicted_labels)

    fb_acc = accuracy_score(y_true_enc, y_pred_enc)
    fb_prec = precision_score(y_true_enc, y_pred_enc, average='weighted', zero_division=0)
    fb_rec = recall_score(y_true_enc, y_pred_enc, average='weighted', zero_division=0)
    fb_f1 = f1_score(y_true_enc, y_pred_enc, average='weighted', zero_division=0)

    print(f"\n┌─────────────────────────────────────────┐")
    print(f"│  Accuracy  (weighted) :  {fb_acc:.4f}          │")
    print(f"│  Precision (weighted) :  {fb_prec:.4f}          │")
    print(f"│  Recall    (weighted) :  {fb_rec:.4f}          │")
    print(f"│  F1 Score  (weighted) :  {fb_f1:.4f}          │")
    print(f"│  Avg Confidence       :  {np.mean(confidences):.4f}          │")
    print(f"└─────────────────────────────────────────┘")

    print(f"\n📋 Per-Class Report:")
    print(cr(expected_labels, predicted_labels, zero_division=0))

    fb_cm = cm_fn(y_true_enc, y_pred_enc)
    print(f"📊 Confusion Matrix:")
    print(f"  Labels: {le.classes_.tolist()}")
    for i, row_label in enumerate(le.classes_):
        print(f"  {row_label:10s} {fb_cm[i].tolist()}")

    FINBERT_LOADED = True
    print(f"\n✅ FinBERT loaded and validated successfully!")

except ImportError:
    print("⚠️ transformers/torch not installed. Skipping FinBERT.")
    print("   Run: pip install transformers torch")
    FINBERT_LOADED = False
except Exception as e:
    print(f"⚠️ FinBERT loading failed: {e}")
    FINBERT_LOADED = False

# %% [markdown]
# ## 6. LAYER 2 — Monte Carlo Simulation (Validation)
#
# Monte Carlo isn't a trained model — it's a statistical simulation.
# Here we validate the GBM engine produces sensible distributions.

# %%
def run_monte_carlo(close_prices, n_sims=10000, n_days=15, target_pct=0.08, sl_pct=0.04):
    """Run Monte Carlo simulation using Geometric Brownian Motion."""
    returns = close_prices.pct_change().dropna()
    mu = returns.mean()
    sigma = returns.std()
    current = float(close_prices.iloc[-1])
    target = current * (1 + target_pct)
    stop_loss = current * (1 - sl_pct)

    np.random.seed(42)
    hits_target = 0
    hits_sl = 0

    for _ in range(n_sims):
        price = current
        hit = None
        for _ in range(n_days):
            z = np.random.standard_normal()
            price = price * np.exp((mu - 0.5 * sigma**2) + sigma * z)
            if price >= target:
                hits_target += 1; hit = 'target'; break
            elif price <= stop_loss:
                hits_sl += 1; hit = 'sl'; break
        if hit is None:
            if price >= target: hits_target += 1
            elif price <= stop_loss: hits_sl += 1

    return {
        'target_prob': round(hits_target / n_sims * 100, 1),
        'sl_prob': round(hits_sl / n_sims * 100, 1),
        'mu': round(mu * 100, 4),
        'sigma': round(sigma * 100, 2)
    }

print(f"{'=' * 50}")
print(f"🎲 LAYER 2: Monte Carlo Simulation Validation")
print(f"{'=' * 50}\n")

for sym in list(stock_data.keys())[:5]:
    close = stock_data[sym]['Close'].astype(float)
    mc = run_monte_carlo(close)
    print(f"  {sym:12s} | Target: {mc['target_prob']:5.1f}% | SL: {mc['sl_prob']:5.1f}% | μ={mc['mu']:.3f}%/day | σ={mc['sigma']:.2f}%/day")

# %% [markdown]
# ## 7. LAYER 5 — Behavioural Risk Engine (Validation)
#
# Rule-based — no training needed. We validate the rules on our dataset.

# %%
def check_behavioural_risk(df):
    """Score behavioural risk flags."""
    close = df['Close'].astype(float)
    volume = df['Volume'].astype(float)
    today_change = float(close.pct_change().iloc[-1] * 100)
    vol_avg = float(volume.rolling(30).mean().iloc[-1])
    vol_ratio = float(volume.iloc[-1]) / (vol_avg + 1)

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    rs = gain / (loss + 1e-10)
    rsi = float((100 - (100 / (1 + rs))).iloc[-1])

    risk = 0
    flags = []
    if today_change > 8: risk += 20; flags.append("MOMENTUM_CHASE")
    if rsi > 75: risk += 30; flags.append("FOMO")
    elif rsi > 70: risk += 15; flags.append("OVERBOUGHT")
    if vol_ratio > 4 and today_change > 3: risk += 25; flags.append("CHASING")
    if not flags: flags.append("CLEAR")

    return {"risk": min(95, risk), "flags": flags, "rsi": round(rsi, 1), "change": round(today_change, 1)}

print(f"{'=' * 50}")
print(f"⚠️ LAYER 5: Behavioural Risk Engine Validation")
print(f"{'=' * 50}\n")

for sym in list(stock_data.keys())[:8]:
    result = check_behavioural_risk(stock_data[sym])
    print(f"  {sym:12s} | Risk: {result['risk']:3d}/100 | RSI: {result['rsi']:5.1f} | Δ: {result['change']:+5.1f}% | {', '.join(result['flags'])}")

# %% [markdown]
# ## 8. Export Models
# Save all trained models to `backend/models/` for production use.

# %%
MODEL_DIR = os.path.join(os.path.dirname(os.getcwd()), "backend", "models")
# If running from notebooks/, go up one level
if not os.path.exists(os.path.join(os.path.dirname(os.getcwd()), "backend")):
    MODEL_DIR = os.path.join(os.getcwd(), "..", "backend", "models")

os.makedirs(MODEL_DIR, exist_ok=True)

# 1. XGBoost
xgb_path = os.path.join(MODEL_DIR, "xgboost_signal.joblib")
joblib.dump({
    'model': xgb_model,
    'features': XGBOOST_FEATURES,
    'accuracy': accuracy_score(y_test, y_pred),
    'cv_score': cv_scores.mean(),
    'trained_on': len(X_train),
    'timestamp': datetime.now().isoformat()
}, xgb_path)
print(f"✅ XGBoost saved: {xgb_path}")

# 2. Isolation Forest
iso_path = os.path.join(MODEL_DIR, "isolation_forest.joblib")
joblib.dump({
    'model': iso_model,
    'features': ISO_FEATURES,
    'contamination': 0.05,
    'trained_on': len(iso_data),
    'timestamp': datetime.now().isoformat()
}, iso_path)
print(f"✅ Isolation Forest saved: {iso_path}")

# 3. FinBERT (save tokenizer name for lazy loading)
finbert_path = os.path.join(MODEL_DIR, "finbert_config.joblib")
joblib.dump({
    'model_name': 'ProsusAI/finbert',
    'loaded': FINBERT_LOADED if 'FINBERT_LOADED' in dir() else False,
    'timestamp': datetime.now().isoformat()
}, finbert_path)
print(f"✅ FinBERT config saved: {finbert_path}")

# 4. Feature list and metadata
meta_path = os.path.join(MODEL_DIR, "training_metadata.joblib")
joblib.dump({
    'tickers_used': TICKERS,
    'total_rows': len(all_features),
    'date_range': f"{all_features.index.min()} to {all_features.index.max()}" if hasattr(all_features.index, 'min') else 'N/A',
    'xgboost_features': XGBOOST_FEATURES,
    'iso_features': ISO_FEATURES,
    'timestamp': datetime.now().isoformat()
}, meta_path)
print(f"✅ Metadata saved: {meta_path}")

print(f"\n📁 All models saved to: {MODEL_DIR}")
print(f"📁 Files: {os.listdir(MODEL_DIR)}")

# %% [markdown]
# ## 9. Summary
#
# | Layer | Model | Status | Metric |
# |-------|-------|--------|--------|
# | 1 — Signal Intel | XGBoost | ✅ Trained & Exported | See accuracy above |
# | 2 — Risk Sim | Monte Carlo GBM | ✅ Validated | Statistical (no training) |
# | 3 — Pump Detection | Isolation Forest | ✅ Trained & Exported | 5% contamination |
# | 4 — Sentiment | FinBERT | ✅ Loaded & Validated | Pre-trained (110M params) |
# | 5 — Behaviour | Rule-Based | ✅ Validated | Deterministic rules |
#
# ### Next Steps
# 1. Run this notebook: `jupyter notebook stockx_model_training.py`
# 2. Models are saved to `backend/models/`
# 3. Update `backend/main.py` to load `.joblib` models instead of inline logic
# 4. For better XGBoost accuracy, increase dataset to 12 months + more tickers
# 5. For FinBERT fine-tuning, collect labeled Indian financial headlines

# %%
print("🏁 StockX Model Training Complete!")
print(f"   Models exported to: {MODEL_DIR}")
print(f"   Ready for integration with backend/main.py")

# %% [markdown]
# ## 10. Confusion Matrix Heatmaps — All Trained Models
#
# Visual summary of every model's confusion matrix on its respective test / validation set.

# %%
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from sklearn.metrics import confusion_matrix

# ── Shared style ────────────────────────────────────────────────────
plt.rcParams.update({
    'figure.facecolor': '#0d1117',
    'axes.facecolor':   '#161b22',
    'text.color':       '#e6edf3',
    'axes.labelcolor':  '#e6edf3',
    'xtick.color':      '#8b949e',
    'ytick.color':      '#8b949e',
    'font.family':      'DejaVu Sans',
})
CMAP = sns.color_palette("rocket_r", as_cmap=True)

def draw_heatmap(ax, cm, labels, title, subtitle):
    """Draw a single annotated heatmap on the given Axes."""
    sns.heatmap(
        cm, annot=True, fmt='d', cmap=CMAP,
        linewidths=0.5, linecolor='#21262d',
        xticklabels=labels, yticklabels=labels,
        ax=ax, cbar=False,
        annot_kws={"size": 14, "weight": "bold", "color": "white"}
    )
    ax.set_title(f"{title}\n", fontsize=13, fontweight='bold', color='#e6edf3', pad=6)
    ax.set_xlabel(f"\nPredicted\n{subtitle}", fontsize=9, color='#8b949e')
    ax.set_ylabel("Actual", fontsize=10, color='#8b949e')
    ax.tick_params(labelsize=9)


fig, axes = plt.subplots(1, 3, figsize=(17, 5))
fig.patch.set_facecolor('#0d1117')
fig.suptitle("StockX — Confusion Matrix Heatmaps", fontsize=16,
             fontweight='bold', color='#e6edf3', y=1.03)

# ── 1. XGBoost ──────────────────────────────────────────────────────
xgb_cm = confusion_matrix(y_test, y_pred)
draw_heatmap(
    axes[0], xgb_cm,
    labels=['Bad Setup', 'Good Setup'],
    title='Layer 1 · XGBoost\nSignal Intelligence',
    subtitle=f'Accuracy {accuracy_score(y_test, y_pred):.3f}  ·  AUC {roc_auc_score(y_test, y_proba):.3f}'
)

# ── 2. Isolation Forest ─────────────────────────────────────────────
# gt_anomaly and iso_pred_binary were computed in the Isolation Forest cell
iso_cm = confusion_matrix(gt_anomaly, iso_pred_binary)
draw_heatmap(
    axes[1], iso_cm,
    labels=['Normal', 'Anomaly'],
    title='Layer 3 · Isolation Forest\nPump & Dump Detection',
    subtitle=f'F1 {iso_f1:.3f}  ·  Precision {iso_prec:.3f}  ·  Recall {iso_rec:.3f}'
)

# ── 3. FinBERT ──────────────────────────────────────────────────────
if 'fb_cm' in dir() and 'le' in dir():
    draw_heatmap(
        axes[2], fb_cm,
        labels=le.classes_.tolist(),
        title='Layer 4 · FinBERT\nSentiment Analysis',
        subtitle=f'Weighted F1 {fb_f1:.3f}  ·  Avg Confidence {np.mean(confidences):.3f}'
    )
else:
    axes[2].set_facecolor('#161b22')
    axes[2].text(0.5, 0.5, 'FinBERT not loaded\n(run FinBERT cell first)',
                 ha='center', va='center', fontsize=11,
                 color='#8b949e', transform=axes[2].transAxes)
    axes[2].set_title('Layer 4 · FinBERT\nSentiment Analysis',
                      fontsize=13, fontweight='bold', color='#e6edf3')
    axes[2].axis('off')

plt.tight_layout(pad=2.5)
plt.savefig(os.path.join(MODEL_DIR, 'confusion_matrices.png'),
            dpi=150, bbox_inches='tight', facecolor='#0d1117')
plt.show()
print(f"\n✅ Heatmap saved → {os.path.join(MODEL_DIR, 'confusion_matrices.png')}")

