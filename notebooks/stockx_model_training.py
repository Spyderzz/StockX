# %% [markdown]
# # StockX — Multi-Model ML Pipeline (5m Candles)
# HMM (Market Regime) + CatBoost (Behaviour) + XGBoost (Signal) + Isolation Forest + SHAP

# %% [markdown]
# ## 0. Install

# %%
!python3 -m pip install yfinance xgboost catboost hmmlearn scikit-learn shap pandas numpy joblib transformers torch --quiet

# %%
import warnings; warnings.filterwarnings('ignore')
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime
import os, joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                               f1_score, roc_auc_score, classification_report,
                               confusion_matrix)

print("✅ Imports loaded")

# %% [markdown]
# ## 1. Feature Definitions
# These must match exactly in training and inference.

# %%
SIGNAL_FEATURES = [
    'rsi', 'macd_hist',
    'price_above_ema20', 'price_above_ema50', 'price_above_ema200',
    'vol_ratio', 'bb_pos', 'atr_pct',
    'mom5', 'mom10', 'return_1bar', 'dist_from_high',
    'vix', 'vix_change', 'vix_spike',
    'regime',
]

BEHAVIOUR_FEATURES  = SIGNAL_FEATURES          # same feature set
BEHAVIOUR_CAT_IDX   = [SIGNAL_FEATURES.index('regime')]  # CatBoost categorical index
ISO_FEATURES        = ['vol_ratio', 'return_1bar', 'vol_price_div', 'delivery_proxy']
HMM_FEATURES        = ['returns_1bar', 'rolling_vol', 'vix']

print(f"SIGNAL_FEATURES  : {len(SIGNAL_FEATURES)} features")
print(f"ISO_FEATURES     : {len(ISO_FEATURES)} features")
print(f"BEHAVIOUR_CAT_IDX: {BEHAVIOUR_CAT_IDX} (regime)")

# %% [markdown]
# ## 2. Data Download (5m)

# %%
def download_vix_daily():
    """India VIX daily — merged into 5m bars by date."""
    try:
        v = yf.download("^INDIAVIX", period="60d", interval="1d",
                        progress=False, auto_adjust=True)
        if v.empty: return pd.DataFrame()
        v.columns = [c[0] if isinstance(c, tuple) else c for c in v.columns]
        v = v[['Close']].rename(columns={'Close': 'vix'})
        v.index = pd.to_datetime(v.index).tz_localize(None).normalize()
        v['vix_change'] = v['vix'].pct_change() * 100
        v['vix_spike']  = (v['vix'] / (v['vix'].rolling(20).mean() + 0.01) > 1.3).astype(int)
        return v.dropna()
    except Exception as e:
        print(f"  ⚠ VIX: {e}"); return pd.DataFrame()


def download_5m(ticker, period="60d"):
    try:
        df = yf.download(ticker, period=period, interval="5m",
                         progress=False, auto_adjust=True)
        if df.empty: return pd.DataFrame()
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        df.index = pd.to_datetime(df.index).tz_localize(None)
        return df.dropna()
    except Exception as e:
        print(f"  ⚠ {ticker}: {e}"); return pd.DataFrame()


# %%
print("📥 Downloading data...")
vix_daily = download_vix_daily()
print(f"  India VIX: {len(vix_daily)} days" +
      (f", last={vix_daily['vix'].iloc[-1]:.1f}" if not vix_daily.empty else " (unavailable — using default 15)"))

nifty_5m = download_5m("^NSEI")
print(f"  NIFTY 5m: {len(nifty_5m)} bars")

TICKERS = [
    "RELIANCE", "HDFCBANK", "INFY", "TCS", "ICICIBANK",
    "SBIN", "TATASTEEL", "WIPRO", "ADANIPORTS", "BAJFINANCE",
    "MARUTI", "SUNPHARMA", "TATAMOTORS", "AXISBANK", "LT",
]
stock_data = {}
for sym in TICKERS:
    df = download_5m(f"{sym}.NS")
    if len(df) >= 200:
        stock_data[sym] = df
        print(f"  ✅ {sym}: {len(df)} bars")
    else:
        print(f"  ⚠ {sym}: {len(df)} bars (skipped)")

print(f"\n📊 {len(stock_data)} stocks, {sum(len(v) for v in stock_data.values())} total bars")

# %% [markdown]
# ## 3. Shared Feature Pipeline

# %%
def merge_vix(df, vix_daily):
    """Add daily VIX columns to a 5m DataFrame by date."""
    df = df.copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    if not vix_daily.empty:
        date_idx = df.index.normalize()
        lkp = {c: vix_daily[c].to_dict() for c in ['vix', 'vix_change', 'vix_spike']}
        df['vix']        = pd.Series([lkp['vix'].get(d, np.nan) for d in date_idx], index=df.index)
        df['vix_change'] = pd.Series([lkp['vix_change'].get(d, np.nan) for d in date_idx], index=df.index)
        df['vix_spike']  = pd.Series([lkp['vix_spike'].get(d, np.nan) for d in date_idx], index=df.index)
    else:
        df['vix'] = 15.0; df['vix_change'] = 0.0; df['vix_spike'] = 0
    df['vix']        = df['vix'].ffill().fillna(15.0)
    df['vix_change'] = df['vix_change'].ffill().fillna(0.0)
    df['vix_spike']  = df['vix_spike'].ffill().fillna(0).astype(int)
    return df


def compute_features_5m(df):
    """Full feature pipeline. df must have vix/vix_change/vix_spike columns."""
    close = df['Close'].astype(float)
    high  = df['High'].astype(float)
    low   = df['Low'].astype(float)
    vol   = df['Volume'].astype(float)
    f = pd.DataFrame(index=df.index)

    # RSI
    d = close.diff()
    gain = d.clip(lower=0).rolling(14).mean()
    loss = (-d.clip(upper=0)).rolling(14).mean()
    f['rsi'] = 100 - 100 / (1 + gain / (loss + 1e-10))

    # MACD histogram
    macd_line = close.ewm(span=12).mean() - close.ewm(span=26).mean()
    f['macd_hist'] = macd_line - macd_line.ewm(span=9).mean()

    # EMA position flags
    ema20  = close.ewm(span=20).mean()
    ema50  = close.ewm(span=50).mean()
    ema200 = close.ewm(span=200, min_periods=50).mean()
    f['price_above_ema20']  = (close > ema20).astype(int)
    f['price_above_ema50']  = (close > ema50).astype(int)
    f['price_above_ema200'] = (close > ema200).astype(int)

    # ATR %
    tr = pd.concat([high-low, (high-close.shift()).abs(), (low-close.shift()).abs()], axis=1).max(axis=1)
    f['atr_pct'] = tr.rolling(14).mean() / (close + 1e-10) * 100

    # Volume ratio
    f['vol_ratio'] = vol / (vol.rolling(30).mean() + 1)

    # Bollinger position (0=at lower band, 1=at upper)
    bb_std = close.rolling(20).std()
    bb_mid = close.rolling(20).mean()
    f['bb_pos'] = (close - (bb_mid - 2*bb_std)) / (4*bb_std + 1e-10)

    # Returns / momentum
    f['mom5']        = close.pct_change(5) * 100
    f['mom10']       = close.pct_change(10) * 100
    f['return_1bar'] = close.pct_change() * 100

    # Distance from recent 20-bar high
    f['dist_from_high'] = (close.rolling(20).max() - close) / (close + 1e-10) * 100

    # VIX (pre-merged)
    f['vix']        = df['vix'].values        if 'vix'        in df.columns else 15.0
    f['vix_change'] = df['vix_change'].values if 'vix_change' in df.columns else 0.0
    f['vix_spike']  = df['vix_spike'].values  if 'vix_spike'  in df.columns else 0

    # Pump-detection extras
    f['vol_price_div']  = f['vol_ratio'] - f['return_1bar'].abs() / 3
    f['delivery_proxy'] = (close - low) / (high - low + 1e-10)

    return f.dropna()


# %% [markdown]
# ## 4. HMM — Market Regime

# %%
from hmmlearn import hmm as hmmlib

def train_hmm(nifty_df, vix_daily, n_states=3):
    """Train GaussianHMM on NIFTY 5m. Returns (model, state_map, feature_cols)."""
    df = merge_vix(nifty_df.copy(), vix_daily)
    close = df['Close'].astype(float)
    returns = close.pct_change() * 100
    rolling_vol = returns.rolling(10).std()
    hmm_df = pd.DataFrame({
        'returns_1bar': returns,
        'rolling_vol': rolling_vol,
        'vix': df['vix'],
    }).dropna()

    X = hmm_df.values.astype(float)
    model = hmmlib.GaussianHMM(n_components=n_states, covariance_type='diag',
                                n_iter=200, random_state=42)
    model.fit(X, [len(X)])
    states = model.predict(X, [len(X)])

    # Assign labels by mean return: highest → Bull(0), lowest → Bear(1), middle → Sideways(2)
    mean_ret = {s: X[states == s, 0].mean() for s in range(n_states)}
    ranked   = sorted(mean_ret.keys(), key=lambda s: mean_ret[s], reverse=True)
    state_map = {ranked[0]: 0, ranked[1]: 2, ranked[2]: 1}
    REGIME_NAMES = {0: 'Bull', 1: 'Bear', 2: 'Sideways'}

    print(f"  {'HMM State':<12} {'→ Label':<12} {'Mean Ret':>10} {'Count':>8}")
    for s in range(n_states):
        label = REGIME_NAMES[state_map[s]]
        cnt = (states == s).sum()
        print(f"  State {s}      → {label:<10} {mean_ret[s]:>+9.3f}%  {cnt:>5} ({cnt/len(states)*100:.0f}%)")

    return model, state_map, list(hmm_df.columns)


def predict_regime_series(hmm_model, state_map, df_5m, vix_daily):
    """Predict regime sequence for a 5m DataFrame. Returns pd.Series indexed to df_5m."""
    df = merge_vix(df_5m.copy(), vix_daily)
    close = df['Close'].astype(float)
    returns = close.pct_change() * 100
    rolling_vol = returns.rolling(10).std()
    hmm_df = pd.DataFrame({
        'returns_1bar': returns,
        'rolling_vol': rolling_vol,
        'vix': df['vix'],
    }).dropna()
    X = hmm_df.values.astype(float)
    raw = hmm_model.predict(X, [len(X)])
    mapped = np.array([state_map.get(int(s), 2) for s in raw])
    return pd.Series(mapped, index=hmm_df.index, dtype=int)


# %%
print(f"{'='*60}")
print("🧠 Training HMM Market Regime...")
print(f"{'='*60}")
if not nifty_5m.empty:
    hmm_model, state_map, hmm_feat_cols = train_hmm(nifty_5m, vix_daily)
    nifty_regime = predict_regime_series(hmm_model, state_map, nifty_5m, vix_daily)
    HMM_AVAILABLE = True
    last_regime = {0: 'Bull', 1: 'Bear', 2: 'Sideways'}[int(nifty_regime.iloc[-1])]
    print(f"\n✅ HMM trained — last regime: {last_regime}")
    regime_dist = pd.Series(nifty_regime).map({0:'Bull',1:'Bear',2:'Sideways'}).value_counts()
    print(f"  Distribution: {dict(regime_dist)}")
else:
    HMM_AVAILABLE = False
    state_map = {0: 2, 1: 0, 2: 1}
    print("⚠ NIFTY unavailable — HMM skipped, defaulting all regime=2 (Sideways)")

# %% [markdown]
# ## 5. Build Feature Matrix with Regime

# %%
print("⚙️ Computing features for all stocks + attaching NIFTY regime...")
all_feature_dfs = {}

for sym, raw_df in stock_data.items():
    df = merge_vix(raw_df.copy(), vix_daily)
    f  = compute_features_5m(df)
    if HMM_AVAILABLE:
        f['regime'] = nifty_regime.reindex(f.index, method='ffill').fillna(2).astype(int)
    else:
        f['regime'] = 2
    f['symbol'] = sym
    all_feature_dfs[sym] = f
    print(f"  {sym}: {len(f)} rows, regime dist: {dict(pd.Series(f['regime']).value_counts().sort_index())}")

# %% [markdown]
# ## 6. Label Creation

# %%
def add_labels(feature_dfs, stock_df_dict, vix_daily):
    """
    signal_label   : forward 10-bar return > +0.5%  → 1 (trade succeeds)
    behaviour_label: forward 10-bar min  return < -0.5% → 1 (bad entry / SL hit)
    """
    pieces = []
    for sym, f in feature_dfs.items():
        raw = stock_df_dict.get(sym)
        if raw is None: continue
        df = merge_vix(raw.copy(), vix_daily)
        close = df['Close'].astype(float)
        fwd_return = (close.shift(-10) / close - 1).reindex(f.index)
        # min over next 10 bars approximated by rolling min shifted back
        fwd_min = pd.Series(
            [close.iloc[i+1:i+11].min() / close.iloc[i] - 1
             if i + 11 <= len(close) else np.nan
             for i in range(len(close))],
            index=close.index
        ).reindex(f.index)
        f = f.copy()
        f['fwd_return'] = fwd_return.values
        f['fwd_min']    = fwd_min.values
        f['signal_label']    = (f['fwd_return'] > 0.005).astype(int)
        f['behaviour_label'] = (f['fwd_min'] < -0.005).astype(int)
        pieces.append(f)

    combined = pd.concat(pieces, ignore_index=True).dropna(
        subset=['signal_label', 'behaviour_label'] + SIGNAL_FEATURES
    )
    print(f"  Rows: {len(combined)}")
    print(f"  signal_label    : {dict(combined['signal_label'].value_counts())}")
    print(f"  behaviour_label : {dict(combined['behaviour_label'].value_counts())}")
    return combined


print("📊 Creating labels...")
labeled_df = add_labels(all_feature_dfs, stock_data, vix_daily)

# %% [markdown]
# ## 7. XGBoost — Signal Intelligence

# %%
from xgboost import XGBClassifier

print(f"\n{'='*60}")
print("📈 Layer 1: XGBoost Signal Model")
print(f"{'='*60}")

X_sig = labeled_df[SIGNAL_FEATURES]
y_sig = labeled_df['signal_label']

X_tr, X_te, y_tr, y_te = train_test_split(X_sig, y_sig, test_size=0.2, random_state=42, stratify=y_sig)
print(f"Train: {len(X_tr)} | Test: {len(X_te)} | Train balance: {dict(y_tr.value_counts())}")

xgb_model = XGBClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
    gamma=0.1, random_state=42, eval_metric='logloss',
    use_label_encoder=False, n_jobs=-1,
)
xgb_model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)

y_pred  = xgb_model.predict(X_te)
y_proba = xgb_model.predict_proba(X_te)[:, 1]
xgb_acc = accuracy_score(y_te, y_pred)
xgb_auc = roc_auc_score(y_te, y_proba)

print(f"\n┌─────────────────────────┐")
print(f"│  Accuracy : {xgb_acc:.4f}      │")
print(f"│  ROC-AUC  : {xgb_auc:.4f}      │")
print(f"└─────────────────────────┘")
print(classification_report(y_te, y_pred, target_names=['Fail', 'Success']))

imp = pd.Series(xgb_model.feature_importances_, index=SIGNAL_FEATURES).sort_values(ascending=False)
print("🏆 Feature Importance:")
for feat, score in imp.items():
    print(f"  {feat:25s} {score:.3f} {'█'*int(score*40)}")

# %% [markdown]
# ## 8. CatBoost — Behaviour Risk Model

# %%
from catboost import CatBoostClassifier

print(f"\n{'='*60}")
print("⚠️  Layer 5 (upgraded): CatBoost Behaviour Risk")
print(f"{'='*60}")

X_beh = labeled_df[BEHAVIOUR_FEATURES].copy()
y_beh = labeled_df['behaviour_label']

Xb_tr, Xb_te, yb_tr, yb_te = train_test_split(X_beh, y_beh, test_size=0.2, random_state=42, stratify=y_beh)
print(f"Train: {len(Xb_tr)} | Test: {len(Xb_te)} | Train balance: {dict(yb_tr.value_counts())}")

cb_model = CatBoostClassifier(
    iterations=500, learning_rate=0.05, depth=6,
    cat_features=BEHAVIOUR_CAT_IDX,
    eval_metric='AUC', random_seed=42,
    verbose=0, early_stopping_rounds=30,
)
cb_model.fit(Xb_tr, yb_tr, eval_set=(Xb_te, yb_te))

yb_pred  = cb_model.predict(Xb_te)
yb_proba = cb_model.predict_proba(Xb_te)[:, 1]
cb_acc   = accuracy_score(yb_te, yb_pred)
cb_auc   = roc_auc_score(yb_te, yb_proba)

print(f"\n┌─────────────────────────┐")
print(f"│  Accuracy : {cb_acc:.4f}      │")
print(f"│  ROC-AUC  : {cb_auc:.4f}      │")
print(f"└─────────────────────────┘")
print(classification_report(yb_te, yb_pred, target_names=['Good Entry', 'Bad Entry']))

cb_imp = pd.Series(cb_model.get_feature_importance(), index=BEHAVIOUR_FEATURES).sort_values(ascending=False)
print("🏆 CatBoost Feature Importance:")
for feat, score in cb_imp.items():
    print(f"  {feat:25s} {score:.2f} {'█'*int(score/5)}")

# %% [markdown]
# ## 9. Isolation Forest — Pump & Dump Detection

# %%
from sklearn.ensemble import IsolationForest

print(f"\n{'='*60}")
print("🔍 Layer 3: Isolation Forest")
print(f"{'='*60}")

iso_data = labeled_df[ISO_FEATURES]
iso_model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42, n_jobs=-1)
iso_model.fit(iso_data)
preds = iso_model.predict(iso_data)
n_anom = (preds == -1).sum()
print(f"  Anomalies: {n_anom} / {len(iso_data)} ({n_anom/len(iso_data)*100:.1f}%)")

# %% [markdown]
# ## 10. SHAP Explainers

# %%
import shap

print(f"\n{'='*60}")
print("📊 Building SHAP Explainers")
print(f"{'='*60}")

xgb_explainer = shap.TreeExplainer(xgb_model)
cb_explainer  = shap.TreeExplainer(cb_model)

# Quick validation
xgb_shap = xgb_explainer.shap_values(X_te.iloc[:200])
cb_shap  = cb_explainer.shap_values(Xb_te.iloc[:200])
print(f"  XGBoost SHAP: {np.array(xgb_shap).shape}")
print(f"  CatBoost SHAP: {np.array(cb_shap).shape}")
print("✅ SHAP explainers ready")

# %% [markdown]
# ## 11. Export All Models

# %%
MODEL_DIR = os.path.join(os.path.dirname(os.getcwd()), "backend", "models")
if not os.path.exists(os.path.join(os.path.dirname(os.getcwd()), "backend")):
    MODEL_DIR = os.path.join(os.getcwd(), "..", "backend", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

joblib.dump({
    'model': xgb_model, 'features': SIGNAL_FEATURES, 'cat_features': [],
    'accuracy': float(xgb_acc), 'auc': float(xgb_auc),
    'timestamp': datetime.now().isoformat(),
}, os.path.join(MODEL_DIR, 'xgboost_signal.joblib'))
print("✅ XGBoost saved")

joblib.dump({
    'model': cb_model, 'features': BEHAVIOUR_FEATURES,
    'cat_features': BEHAVIOUR_CAT_IDX,
    'accuracy': float(cb_acc), 'auc': float(cb_auc),
    'timestamp': datetime.now().isoformat(),
}, os.path.join(MODEL_DIR, 'catboost_behaviour.joblib'))
print("✅ CatBoost saved")

joblib.dump({
    'model': iso_model, 'features': ISO_FEATURES,
    'contamination': 0.05, 'timestamp': datetime.now().isoformat(),
}, os.path.join(MODEL_DIR, 'isolation_forest.joblib'))
print("✅ Isolation Forest saved")

if HMM_AVAILABLE:
    joblib.dump({
        'model': hmm_model, 'state_map': state_map,
        'feature_cols': hmm_feat_cols, 'n_states': 3,
        'timestamp': datetime.now().isoformat(),
    }, os.path.join(MODEL_DIR, 'hmm_regime.joblib'))
    print("✅ HMM saved")

joblib.dump({
    'xgb': xgb_explainer, 'catboost': cb_explainer,
    'xgb_features': SIGNAL_FEATURES, 'cb_features': BEHAVIOUR_FEATURES,
    'timestamp': datetime.now().isoformat(),
}, os.path.join(MODEL_DIR, 'shap_explainers.joblib'))
print("✅ SHAP explainers saved")

joblib.dump({
    'model_name': 'ProsusAI/finbert',
    'timestamp': datetime.now().isoformat(),
}, os.path.join(MODEL_DIR, 'finbert_config.joblib'))

joblib.dump({
    'tickers': TICKERS, 'timeframe': '5m',
    'signal_features': SIGNAL_FEATURES,
    'behaviour_features': BEHAVIOUR_FEATURES,
    'iso_features': ISO_FEATURES,
    'hmm_features': HMM_FEATURES,
    'behaviour_cat_idx': BEHAVIOUR_CAT_IDX,
    'timestamp': datetime.now().isoformat(),
}, os.path.join(MODEL_DIR, 'training_metadata.joblib'))

print(f"\n📁 All models saved → {MODEL_DIR}")
print(f"   Files: {os.listdir(MODEL_DIR)}")
print("\n🏁 StockX multi-model pipeline training complete!")
