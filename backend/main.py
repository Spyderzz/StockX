from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import requests
import os
import joblib
from dotenv import load_dotenv
from datetime import datetime, timezone
import warnings
warnings.filterwarnings('ignore')

try:
    from transformers import pipeline as hf_pipeline
    print("Loading FinBERT...")
    sentiment_pipeline = hf_pipeline("sentiment-analysis", model="ProsusAI/finbert")
    print("FinBERT loaded.")
except Exception as e:
    print(f"FinBERT not loaded: {e}")
    sentiment_pipeline = None

load_dotenv()

app = FastAPI(title="StockX API", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
_MODELS_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

# ─────────────────────────────────────────────
# FEATURE DEFINITIONS  (must match training)
# ─────────────────────────────────────────────
SIGNAL_FEATURES = [
    'rsi', 'macd_hist',
    'price_above_ema20', 'price_above_ema50', 'price_above_ema200',
    'vol_ratio', 'bb_pos', 'atr_pct',
    'mom5', 'mom10', 'return_1bar', 'dist_from_high',
    'vix', 'vix_change', 'vix_spike',
    'regime',
]
BEHAVIOUR_CAT_IDX = [SIGNAL_FEATURES.index('regime')]
ISO_FEATURES      = ['vol_ratio', 'return_1bar', 'vol_price_div', 'delivery_proxy']
REGIME_NAMES      = {0: 'Bull', 1: 'Bear', 2: 'Sideways'}

# ─────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────
_xgb_artifact  = None
_iso_artifact  = None
_hmm_artifact  = None
_cb_artifact   = None
_shap_artifact = None


def _try_load(fname, label):
    path = os.path.join(_MODELS_DIR, fname)
    if os.path.exists(path):
        try:
            a = joblib.load(path)
            print(f"✅ {label} loaded")
            return a
        except Exception as e:
            print(f"⚠  {label} load failed: {e}")
    else:
        print(f"⚠  {label} not found at {path}")
    return None


def _load_models():
    global _xgb_artifact, _iso_artifact, _hmm_artifact, _cb_artifact, _shap_artifact
    _xgb_artifact  = _try_load('xgboost_signal.joblib',    'XGBoost')
    _iso_artifact  = _try_load('isolation_forest.joblib',  'IsoForest')
    _hmm_artifact  = _try_load('hmm_regime.joblib',        'HMM')
    _cb_artifact   = _try_load('catboost_behaviour.joblib','CatBoost')
    _shap_artifact = _try_load('shap_explainers.joblib',   'SHAP')


_load_models()

# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"

# ─────────────────────────────────────────────
# CACHES
# ─────────────────────────────────────────────
_vix_cache    = {'data': None, 'ts': None}
_regime_cache = {'regime': 2, 'regime_name': 'Sideways', 'confidence': 0.5, 'ts': None}
_name_cache   = {}


def _stale(ts, ttl):
    return ts is None or (datetime.now() - ts).total_seconds() > ttl

# ─────────────────────────────────────────────
# VIX DATA
# ─────────────────────────────────────────────

def fetch_vix_data() -> dict:
    """Fetch India VIX daily. Cached 1 hour."""
    if not _stale(_vix_cache['ts'], 3600) and _vix_cache['data']:
        return _vix_cache['data']
    try:
        v = yf.download("^INDIAVIX", period="60d", interval="1d",
                        progress=False, auto_adjust=True)
        if v.empty:
            raise ValueError("empty")
        v.columns = [c[0] if isinstance(c, tuple) else c for c in v.columns]
        v = v[['Close']].rename(columns={'Close': 'vix'})
        v.index = pd.to_datetime(v.index).tz_localize(None).normalize()
        v['vix_change'] = v['vix'].pct_change() * 100
        v['vix_spike']  = (v['vix'] / (v['vix'].rolling(20).mean() + 0.01) > 1.3).astype(int)
        v = v.dropna()
        result = {
            'vix':        float(v['vix'].iloc[-1]),
            'vix_change': float(v['vix_change'].iloc[-1]),
            'vix_spike':  int(v['vix_spike'].iloc[-1]),
            'df': v,
        }
        _vix_cache.update({'data': result, 'ts': datetime.now()})
        return result
    except Exception as e:
        print(f"VIX fetch failed: {e}")
        return {'vix': 15.0, 'vix_change': 0.0, 'vix_spike': 0, 'df': pd.DataFrame()}


def _merge_vix(df: pd.DataFrame, vix_info: dict) -> pd.DataFrame:
    """Add daily VIX columns to a 5m DataFrame by date."""
    df = df.copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    vix_df = vix_info.get('df', pd.DataFrame())
    if not vix_df.empty:
        date_idx = df.index.normalize()
        lkp = {c: vix_df[c].to_dict() for c in ['vix', 'vix_change', 'vix_spike']}
        df['vix']        = pd.Series([lkp['vix'].get(d, np.nan)        for d in date_idx], index=df.index)
        df['vix_change'] = pd.Series([lkp['vix_change'].get(d, np.nan) for d in date_idx], index=df.index)
        df['vix_spike']  = pd.Series([lkp['vix_spike'].get(d, np.nan)  for d in date_idx], index=df.index)
    else:
        df['vix'] = vix_info.get('vix', 15.0)
        df['vix_change'] = vix_info.get('vix_change', 0.0)
        df['vix_spike']  = vix_info.get('vix_spike', 0)
    df['vix']        = df['vix'].ffill().fillna(15.0)
    df['vix_change'] = df['vix_change'].ffill().fillna(0.0)
    df['vix_spike']  = df['vix_spike'].ffill().fillna(0).astype(int)
    return df

# ─────────────────────────────────────────────
# STOCK DATA (5m)
# ─────────────────────────────────────────────

def fetch_stock_data(symbol: str) -> pd.DataFrame:
    """Fetch 15 calendar days of 5m OHLCV for an NSE stock."""
    for suffix in ['.NS', '.BO']:
        try:
            df = yf.download(f"{symbol}{suffix}", period="15d", interval="5m",
                             progress=False, auto_adjust=True)
            if not df.empty:
                break
        except Exception:
            continue
    else:
        raise HTTPException(status_code=404,
                            detail=f"No 5m data for '{symbol}' on NSE or BSE.")

    df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    df.index = pd.to_datetime(df.index).tz_localize(None)
    df = df.dropna()
    if len(df) < 50:
        raise HTTPException(status_code=404,
                            detail=f"Insufficient data for '{symbol}' ({len(df)} bars).")
    return df


def get_stock_name(symbol: str) -> str:
    if symbol in _name_cache:
        return _name_cache[symbol]
    try:
        t = yf.Ticker(f"{symbol}.NS")
        name = t.info.get("longName") or t.info.get("shortName") or symbol
        _name_cache[symbol] = name
        return name
    except:
        return symbol

# ─────────────────────────────────────────────
# SHARED FEATURE COMPUTATION (5m pipeline)
# ─────────────────────────────────────────────

def compute_features_5m(df: pd.DataFrame) -> pd.DataFrame:
    """Full feature pipeline. df must already have vix/vix_change/vix_spike columns."""
    close = df['Close'].astype(float)
    high  = df['High'].astype(float)
    low   = df['Low'].astype(float)
    vol   = df['Volume'].astype(float)
    f = pd.DataFrame(index=df.index)

    d    = close.diff()
    gain = d.clip(lower=0).rolling(14).mean()
    loss = (-d.clip(upper=0)).rolling(14).mean()
    f['rsi'] = 100 - 100 / (1 + gain / (loss + 1e-10))

    macd_line  = close.ewm(span=12).mean() - close.ewm(span=26).mean()
    f['macd_hist'] = macd_line - macd_line.ewm(span=9).mean()

    ema20  = close.ewm(span=20).mean()
    ema50  = close.ewm(span=50).mean()
    ema200 = close.ewm(span=200, min_periods=50).mean()
    f['price_above_ema20']  = (close > ema20).astype(int)
    f['price_above_ema50']  = (close > ema50).astype(int)
    f['price_above_ema200'] = (close > ema200).astype(int)

    tr = pd.concat([high-low, (high-close.shift()).abs(), (low-close.shift()).abs()],
                   axis=1).max(axis=1)
    f['atr_pct'] = tr.rolling(14).mean() / (close + 1e-10) * 100

    f['vol_ratio'] = vol / (vol.rolling(30).mean() + 1)

    bb_std = close.rolling(20).std()
    bb_mid = close.rolling(20).mean()
    f['bb_pos'] = (close - (bb_mid - 2*bb_std)) / (4*bb_std + 1e-10)

    f['mom5']        = close.pct_change(5) * 100
    f['mom10']       = close.pct_change(10) * 100
    f['return_1bar'] = close.pct_change() * 100
    f['dist_from_high'] = (close.rolling(20).max() - close) / (close + 1e-10) * 100

    f['vix']        = df['vix'].values        if 'vix'        in df.columns else 15.0
    f['vix_change'] = df['vix_change'].values if 'vix_change' in df.columns else 0.0
    f['vix_spike']  = df['vix_spike'].values  if 'vix_spike'  in df.columns else 0

    f['vol_price_div']  = f['vol_ratio'] - f['return_1bar'].abs() / 3
    f['delivery_proxy'] = (close - low) / (high - low + 1e-10)

    return f.dropna()


def _latest_row(feat_df: pd.DataFrame) -> pd.Series:
    return feat_df.iloc[-1]


def _build_tech_snapshot(df: pd.DataFrame, feat: pd.Series) -> dict:
    """Compact technicals dict for downstream use and API response."""
    close  = df['Close'].astype(float)
    high   = df['High'].astype(float)
    low    = df['Low'].astype(float)
    vol    = df['Volume'].astype(float)
    ema20  = float(close.ewm(span=20).mean().iloc[-1])
    ema50  = float(close.ewm(span=50).mean().iloc[-1])
    ema200 = float(close.ewm(span=200, min_periods=50).mean().iloc[-1])
    macd_l = close.ewm(span=12).mean() - close.ewm(span=26).mean()
    bb_std = close.rolling(20).std()
    bb_mid_s = close.rolling(20).mean()
    return {
        'current_price':    float(close.iloc[-1]),
        'prev_close':       float(close.iloc[-2]) if len(close) >= 2 else float(close.iloc[-1]),
        'rsi':              float(feat['rsi']),
        'macd':             float(macd_l.iloc[-1]),
        'macd_signal':      float(macd_l.ewm(span=9).mean().iloc[-1]),
        'macd_hist':        float(feat['macd_hist']),
        'ema20': ema20, 'ema50': ema50, 'ema200': ema200,
        'atr':              float(feat['atr_pct']) * float(close.iloc[-1]) / 100,
        'atr_pct':          float(feat['atr_pct']),
        'vol_ratio':        float(feat['vol_ratio']),
        'vol_today':        float(vol.iloc[-1]),
        'vol_30d_avg':      float(vol.rolling(30).mean().iloc[-1]),
        'bb_upper':         float((bb_mid_s + 2*bb_std).iloc[-1]),
        'bb_lower':         float((bb_mid_s - 2*bb_std).iloc[-1]),
        'bb_mid':           float(bb_mid_s.iloc[-1]),
        'bb_pos':           float(feat['bb_pos']),
        'mom5':             float(feat['mom5']),
        'mom20':            float(feat['mom10']),
        'today_change_pct': float(feat['return_1bar']),
        'w52_high':         float(high.rolling(min(len(close), 252*75)).max().iloc[-1]),
        'w52_low':          float(low.rolling(min(len(close), 252*75)).min().iloc[-1]),
        'vix':              float(feat.get('vix', 15.0)),
        'vix_change':       float(feat.get('vix_change', 0.0)),
        'vix_spike':        int(feat.get('vix_spike', 0)),
    }

# ─────────────────────────────────────────────
# LAYER 0: MARKET REGIME (HMM)
# ─────────────────────────────────────────────

def layer_market_regime(vix_info: dict) -> dict:
    """Predict current market regime. Cached 15 min."""
    if not _stale(_regime_cache['ts'], 900):
        return dict(_regime_cache)

    if _hmm_artifact is None:
        return {'regime': 2, 'regime_name': 'Sideways', 'confidence': 0.5}

    try:
        nifty = yf.download("^NSEI", period="15d", interval="5m", progress=False, auto_adjust=True)
        if nifty.empty:
            raise ValueError("empty NIFTY data")
        nifty.columns = [c[0] if isinstance(c, tuple) else c for c in nifty.columns]
        nifty.index = pd.to_datetime(nifty.index).tz_localize(None)
        nifty = _merge_vix(nifty, vix_info)

        close = nifty['Close'].astype(float)
        returns = close.pct_change() * 100
        rolling_vol = returns.rolling(10).std()
        hmm_df = pd.DataFrame({
            'returns_1bar': returns,
            'rolling_vol':  rolling_vol,
            'vix':          nifty['vix'],
        }).dropna()

        X = hmm_df.values.astype(float)
        hmm_model = _hmm_artifact['model']
        state_map  = _hmm_artifact['state_map']

        raw_states = hmm_model.predict(X, [len(X)])
        mapped     = state_map.get(int(raw_states[-1]), 2)
        last20     = np.array([state_map.get(int(s), 2) for s in raw_states[-20:]])
        confidence = round(float((last20 == mapped).mean()), 2)

        result = {
            'regime':      mapped,
            'regime_name': REGIME_NAMES[mapped],
            'confidence':  confidence,
        }
        _regime_cache.update({**result, 'ts': datetime.now()})
        return result

    except Exception as e:
        print(f"HMM inference failed: {e}")
        return {'regime': 2, 'regime_name': 'Sideways', 'confidence': 0.5}

# ─────────────────────────────────────────────
# LAYER 1: SIGNAL INTELLIGENCE (XGBoost)
# ─────────────────────────────────────────────

def _rule_signal_score(tech: dict) -> float:
    score = 50.0
    rsi, price = tech['rsi'], tech['current_price']
    if 40 <= rsi <= 65:  score += 15
    elif rsi > 75:        score -= 20
    elif rsi < 30:        score += 8
    if price > tech['ema20']:  score += 8
    if price > tech['ema50']:  score += 8
    if price > tech['ema200']: score += 8
    if tech['macd_hist'] > 0:  score += 8
    else:                      score -= 5
    if tech['vix'] > 25:       score -= 10
    return max(5.0, min(95.0, score))


def layer_signal_intelligence(feat: pd.Series, tech: dict) -> dict:
    features = [[feat[f] for f in SIGNAL_FEATURES]]

    if _xgb_artifact is not None:
        try:
            proba = float(_xgb_artifact['model'].predict_proba(features)[0][1])
            score = round(max(5.0, min(95.0, proba * 100)), 1)
            model_label = "XGBoost (5m Signal)"
        except Exception as e:
            print(f"XGBoost inference error: {e}")
            score = _rule_signal_score(tech)
            model_label = "Rule-based (XGBoost error)"
    else:
        score = _rule_signal_score(tech)
        model_label = "Rule-based (no model)"

    rsi = tech['rsi']
    ema_pos    = "above" if tech['current_price'] > tech['ema200'] else "below"
    rsi_status = "overbought" if rsi > 70 else "oversold" if rsi < 30 else "neutral"
    setup_label = "STRONG SETUP" if score >= 65 else "NEUTRAL SETUP" if score >= 40 else "WEAK SETUP"
    setup_color = "green" if score >= 65 else "yellow" if score >= 40 else "red"

    return {
        "score": score,
        "setup_label": setup_label,
        "setup_color": setup_color,
        "finding": (f"RSI {rsi:.0f} ({rsi_status}). Price {ema_pos} EMA200 ₹{tech['ema200']:.1f}. "
                    f"MACD {'positive' if tech['macd_hist'] > 0 else 'negative'}. "
                    f"Vol {tech['vol_ratio']:.1f}x avg. VIX {tech['vix']:.1f}."),
        "model": model_label,
    }

# ─────────────────────────────────────────────
# LAYER 2: MONTE CARLO (VIX-adjusted volatility)
# ─────────────────────────────────────────────

def layer_monte_carlo(df: pd.DataFrame, tech: dict) -> dict:
    close = df['Close'].astype(float)
    returns = close.pct_change().dropna()
    mu = float(returns.mean())
    sigma_base = float(returns.std())

    vix_now = tech.get('vix', 15.0)
    sigma   = sigma_base * (vix_now / 15.0) ** 0.5

    current_price = tech['current_price']
    target        = current_price * 1.08
    stop_loss     = current_price * 0.96
    n_sims, n_steps = 10000, 15

    np.random.seed(42)
    hits_target = hits_sl = 0
    paths_sample = []

    for i in range(n_sims):
        price = current_price
        hit, prices = None, [price]
        for _ in range(n_steps):
            price *= np.exp((mu - 0.5*sigma**2) + sigma * np.random.standard_normal())
            prices.append(price)
            if hit is None:
                if price >= target:    hit = 'target'; hits_target += 1; break
                elif price <= stop_loss: hit = 'sl';  hits_sl += 1;    break
        if hit is None:
            if prices[-1] >= target:    hits_target += 1
            elif prices[-1] <= stop_loss: hits_sl += 1
        if i < 100:
            paths_sample.append({
                'prices': [round(p, 2) for p in prices],
                'outcome': hit or ('target' if prices[-1] >= target else 'sl'),
            })

    target_prob = round(hits_target / n_sims * 100, 1)
    sl_prob     = round(100 - target_prob, 1)

    return {
        "target_prob": target_prob,
        "sl_prob":     sl_prob,
        "paths":       paths_sample[:50],
        "finding": (f"{target_prob}% probability of hitting +8% target before -4% stop loss "
                    f"over 15 trading days. VIX {vix_now:.1f} → σ_adj={sigma*100:.2f}%/bar."),
        "model": "Monte Carlo GBM (VIX-adjusted)",
    }

# ─────────────────────────────────────────────
# LAYER 3: PUMP & DUMP DETECTION (Isolation Forest)
# ─────────────────────────────────────────────

def _inline_iso(df: pd.DataFrame):
    close  = df['Close'].astype(float)
    volume = df['Volume'].astype(float)
    high   = df['High'].astype(float)
    low    = df['Low'].astype(float)
    vol_r  = volume / (volume.rolling(30).mean() + 1)
    p_chg  = close.pct_change().fillna(0) * 100
    feat   = pd.DataFrame({
        'vol_ratio':      vol_r,
        'return_1bar':    p_chg,
        'vol_price_div':  (vol_r - p_chg.abs() / 3).fillna(0),
        'delivery_proxy': (close - low) / (high - low + 1e-10),
    }).fillna(0)
    if len(feat) < 20:
        return 20.0, False
    m = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    m.fit(feat[:-5])
    today = feat.iloc[-1:].values
    score = m.decision_function(today)[0]
    return max(0.0, min(100.0, ((-score + 0.2) / 0.4) * 100)), m.predict(today)[0] == -1


def layer_pump_dump(df: pd.DataFrame, feat: pd.Series, tech: dict) -> dict:
    today = np.array([[feat[f] for f in ISO_FEATURES]])
    model_label = "Isolation Forest (5m)"

    if _iso_artifact is not None:
        try:
            iso_m = _iso_artifact['model']
            score = iso_m.decision_function(today)[0]
            is_anomaly = iso_m.predict(today)[0] == -1
            normalized = max(0.0, min(100.0, ((-score + 0.2) / 0.4) * 100))
        except Exception as e:
            print(f"IsoForest error: {e}")
            normalized, is_anomaly = _inline_iso(df)
            model_label += " (fallback)"
    else:
        normalized, is_anomaly = _inline_iso(df)
        model_label += " (inline)"

    vr = tech['vol_ratio']
    tc = tech['today_change_pct']
    if vr > 4 and tc > 5:
        normalized = max(normalized, 75)
        finding = f"ALERT: Volume {vr:.1f}x avg with {tc:.1f}% spike. High manipulation probability."
    elif vr > 2.5:
        normalized = max(normalized, 50)
        finding = f"Elevated volume {vr:.1f}x avg. Monitoring for coordinated activity."
    elif is_anomaly:
        finding = f"Anomalous pattern detected. Vol ratio: {vr:.1f}x."
    else:
        normalized = min(normalized, 35)
        finding = f"No significant anomalies. Volume {vr:.1f}x avg — organic price action."

    anomaly_label = ("MANIPULATION RISK" if normalized >= 70
                     else "UNUSUAL ACTIVITY" if normalized >= 40 else "ORGANIC ACTION")
    anomaly_color = "red" if normalized >= 70 else "yellow" if normalized >= 40 else "green"

    return {
        "score":         round(float(normalized), 1),
        "is_anomaly":    bool(is_anomaly),
        "anomaly_label": anomaly_label,
        "anomaly_color": anomaly_color,
        "finding":       finding,
        "model":         model_label,
    }

# ─────────────────────────────────────────────
# LAYER 4: SENTIMENT GAP (FinBERT)
# ─────────────────────────────────────────────

_POSITIVE_WORDS = ['surge', 'gain', 'rally', 'growth', 'profit', 'strong', 'beat', 'rise',
                   'up', 'high', 'positive', 'bullish', 'record', 'best', 'exceed', 'outperform',
                   'breakthrough', 'win', 'boost', 'upgrade', 'buy']
_NEGATIVE_WORDS = ['fall', 'drop', 'loss', 'decline', 'weak', 'miss', 'down', 'low', 'negative',
                   'bearish', 'worst', 'underperform', 'sell', 'downgrade', 'concern', 'risk',
                   'crash', 'plunge', 'cut', 'reduce', 'warning', 'probe', 'penalty']


def _lexicon_score(headlines):
    pos = sum(1 for h in headlines for w in _POSITIVE_WORDS if w.lower() in h.lower())
    neg = sum(1 for h in headlines for w in _NEGATIVE_WORDS if w.lower() in h.lower())
    return round(pos / (pos + neg + 1) * 100, 1)


def layer_sentiment_gap(symbol: str, tech: dict, signal_score: float) -> dict:
    headlines, articles_data = [], []

    if NEWS_API_KEY:
        try:
            url = (f"https://newsapi.org/v2/everything?q={symbol}+NSE+stock"
                   f"&language=en&sortBy=publishedAt&pageSize=10&apiKey={NEWS_API_KEY}")
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                for a in resp.json().get('articles', [])[:10]:
                    if a.get('title') and a['title'] != '[Removed]':
                        headlines.append(a['title'])
                        if len(articles_data) < 5:
                            articles_data.append({
                                'title': a.get('title', ''),
                                'source': a.get('source', {}).get('name', ''),
                                'url': a.get('url', ''),
                                'publishedAt': a.get('publishedAt', ''),
                            })
        except Exception:
            pass

    if not articles_data:
        try:
            t = yf.Ticker(f"{symbol}.NS")
            for item in (t.news or [])[:5]:
                content = item.get('content', {})
                title   = content.get('title') or item.get('title', '')
                if not title: continue
                provider = content.get('provider', {}).get('displayName', '') or item.get('publisher', '')
                link     = content.get('canonicalUrl', {}).get('url', '') or item.get('link', '')
                pub_time = content.get('pubDate', '') or item.get('providerPublishTime', '')
                if isinstance(pub_time, (int, float)):
                    pub_time = datetime.fromtimestamp(pub_time, tz=timezone.utc).isoformat()
                headlines.append(title)
                articles_data.append({'title': title, 'source': provider,
                                      'url': link, 'publishedAt': str(pub_time)})
        except Exception as e:
            print(f"yfinance news fallback failed: {e}")

    if headlines:
        if sentiment_pipeline:
            try:
                results = sentiment_pipeline(headlines)
                pos_s = neg_s = 0.0
                for r in results:
                    lbl = r['label'].lower()
                    if lbl == 'positive':  pos_s += r['score']
                    elif lbl == 'negative': neg_s += r['score']
                n = max(1, len(results))
                sentiment_score = max(10, min(95, round(50 + ((pos_s - neg_s) / n) * 45, 1)))
            except Exception as e:
                print(f"FinBERT inference failed: {e}")
                sentiment_score = _lexicon_score(headlines)
        else:
            sentiment_score = _lexicon_score(headlines)
    else:
        rsi  = tech['rsi']
        mom  = tech['mom20']
        sentiment_score = round(min(95, max(10, 50 + (rsi - 50) * 0.6 + mom * 0.5)), 1)

    divergence = round(abs(sentiment_score - round(signal_score, 1)), 1)

    if divergence > 40:
        if sentiment_score > signal_score:
            finding = (f"HIGH DIVERGENCE: Sentiment {sentiment_score:.0f}/100 vs technicals "
                       f"{signal_score:.0f}/100 ({divergence:.0f}pt gap). Positive narrative not "
                       f"supported by price action — possible distribution.")
        else:
            finding = (f"POSITIVE SIGNAL: Technicals {signal_score:.0f}/100 outpacing sentiment "
                       f"{sentiment_score:.0f}/100 ({divergence:.0f}pt gap). Under-appreciated setup.")
    elif divergence > 20:
        finding = (f"MINOR GAP: Sentiment {sentiment_score:.0f}/100 vs technicals "
                   f"{signal_score:.0f}/100 ({divergence:.0f}pt divergence).")
    else:
        finding = (f"ALIGNED: Sentiment {sentiment_score:.0f}/100 matches technicals "
                   f"{signal_score:.0f}/100 ({divergence:.0f}pt gap).")

    return {
        "sentiment_score": sentiment_score,
        "tech_score":      round(signal_score, 1),
        "divergence":      divergence,
        "score":           divergence,
        "finding":         finding,
        "model":           "FinBERT Sentiment Engine",
        "news":            articles_data,
    }

# ─────────────────────────────────────────────
# LAYER 5: BEHAVIOUR RISK (CatBoost)
# ─────────────────────────────────────────────

def _rule_behaviour(tech: dict) -> dict:
    """Fallback rule-based behaviour risk when CatBoost model unavailable."""
    flags = []
    risk  = 0
    tc, vr, rsi = tech['today_change_pct'], tech['vol_ratio'], tech['rsi']
    if tc > 15:        flags.append(f"LATE ENTRY: up {tc:.1f}% today"); risk += 35
    elif tc > 8:       flags.append(f"MOMENTUM CHASE: up {tc:.1f}% today"); risk += 20
    if rsi > 75:       flags.append(f"FOMO: RSI {rsi:.0f}"); risk += 30
    elif rsi > 70:     flags.append(f"OVERBOUGHT: RSI {rsi:.0f}"); risk += 15
    if vr > 4 and tc > 3: flags.append(f"CHASING: vol {vr:.1f}x on sharp move"); risk += 25
    if not flags:      flags.append(f"Normal entry conditions. RSI {rsi:.0f}, Δ {tc:.1f}%")
    return {"risk": min(95, risk), "flags": flags}


def layer_behaviour(feat: pd.Series, tech: dict, regime: dict) -> dict:
    features = [[feat[f] for f in SIGNAL_FEATURES]]
    regime_int = regime.get('regime', 2)

    if _cb_artifact is not None:
        try:
            proba_bad = float(_cb_artifact['model'].predict_proba(features)[0][1])
            risk_score = round(max(5.0, min(95.0, proba_bad * 100)), 1)
            model_label = "CatBoost Behaviour Model"
        except Exception as e:
            print(f"CatBoost inference error: {e}")
            rb = _rule_behaviour(tech)
            risk_score  = float(rb['risk'])
            model_label = "Rule-based (CatBoost error)"
    else:
        rb = _rule_behaviour(tech)
        risk_score  = float(rb['risk'])
        model_label = "Rule-based (no CatBoost model)"

    regime_name = regime.get('regime_name', 'Sideways')
    rsi = tech['rsi']
    tc  = tech['today_change_pct']
    vr  = tech['vol_ratio']
    vix = tech['vix']

    if risk_score >= 70:
        finding = (f"HIGH BEHAVIOUR RISK ({regime_name} regime, VIX {vix:.1f}): "
                   f"RSI {rsi:.0f}, Δ {tc:.1f}%, vol {vr:.1f}x — avoid chasing.")
        risk_label = "AVOID ENTRY"
        risk_color = "red"
    elif risk_score >= 40:
        finding = (f"ELEVATED RISK ({regime_name} regime, VIX {vix:.1f}): "
                   f"RSI {rsi:.0f}, Δ {tc:.1f}%, vol {vr:.1f}x — proceed cautiously.")
        risk_label = "CAUTION"
        risk_color = "yellow"
    else:
        finding = (f"ACCEPTABLE ENTRY ({regime_name} regime, VIX {vix:.1f}): "
                   f"RSI {rsi:.0f}, Δ {tc:.1f}%, vol {vr:.1f}x — no behavioural red flags.")
        risk_label = "CLEAN ENTRY"
        risk_color = "green"

    return {
        "score":       risk_score,
        "risk_label":  risk_label,
        "risk_color":  risk_color,
        "finding":     finding,
        "model":       model_label,
        "regime_used": regime_name,
    }

# ─────────────────────────────────────────────
# FINAL SCORE + VERDICT
# ─────────────────────────────────────────────

def compute_final_score(signal, mc, pump, sentiment, behaviour, regime) -> float:
    signal_risk    = 100 - signal['score']
    mc_risk        = mc['sl_prob']
    pump_risk      = pump['score']
    sentiment_risk = min(100, sentiment['divergence'] * 1.3)
    behaviour_risk = behaviour['score']

    # Bear regime adds a penalty
    regime_penalty = {0: -5, 1: +10, 2: 0}.get(regime.get('regime', 2), 0)

    raw = (signal_risk * 0.20 + mc_risk * 0.25 + pump_risk * 0.25 +
           sentiment_risk * 0.20 + behaviour_risk * 0.10 + regime_penalty)
    return round(max(0, min(100, raw)), 1)


def get_verdict(score: float) -> dict:
    if score <= 30:   return {"label": "STRONG SETUP",         "color": "#10d98a"}
    elif score <= 55: return {"label": "PROCEED WITH CAUTION", "color": "#fbbf24"}
    elif score <= 75: return {"label": "HIGH RISK ENTRY",      "color": "#ff8c42"}
    else:             return {"label": "DANGER — AVOID",       "color": "#ff4d6a"}

# ─────────────────────────────────────────────
# AI EXPLANATION (Groq)
# ─────────────────────────────────────────────

def generate_ai_explanation(symbol, score, verdict, signal, mc, pump,
                             sentiment, behaviour, regime) -> dict:
    if not GROQ_API_KEY:
        return {
            "one_liner": f"Decision Quality Score {score}/100 — {verdict}. Review layer breakdown.",
            "explanation": (f"StockX analysed {symbol} across 5 ML layers in a "
                            f"{regime['regime_name']} market regime (VIX {signal.get('model', '')}). "
                            f"Signal: {signal['score']}/100. Risk: {mc['sl_prob']}% SL prob. "
                            f"Pump: {pump['score']}/100. Sentiment gap: {sentiment['divergence']}pt. "
                            f"Behaviour risk: {behaviour['score']}/100."),
        }
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        prompt = f"""You are StockX, an AI for Indian retail traders. Analysis of {symbol} (NSE):

- Market Regime: {regime['regime_name']} (confidence {regime['confidence']:.0%})
- Decision Score: {score}/100 — {verdict}
- Signal (XGBoost): {signal['score']}/100 — {signal['finding']}
- Risk (Monte Carlo): {mc['sl_prob']}% SL prob — {mc['finding']}
- Pump Detection: {pump['score']}/100 — {pump['finding']}
- Sentiment Gap: {sentiment['divergence']}pt — {sentiment['finding']}
- Behaviour (CatBoost): {behaviour['score']}/100 — {behaviour['finding']}

Write:
ONE_LINER: One punchy sentence (≤20 words) on the key risk/opportunity.
EXPLANATION: 3-4 sentences of plain-English analysis with specific numbers for the retail trader.

Format exactly:
ONE_LINER: [text]
EXPLANATION: [text]"""

        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
        text = resp.choices[0].message.content
        one_liner = explanation = ""
        for line in text.split('\n'):
            if line.startswith('ONE_LINER:'):    one_liner   = line.replace('ONE_LINER:', '').strip()
            elif line.startswith('EXPLANATION:'): explanation = line.replace('EXPLANATION:', '').strip()
        return {
            "one_liner":   one_liner   or text[:120],
            "explanation": explanation or text,
        }
    except Exception as e:
        print(f"Groq error: {e}")
        return {"one_liner": f"Score {score}/100 — {verdict}",
                "explanation": f"{signal['finding']} {mc['finding']}"}

# ─────────────────────────────────────────────
# FII / DII DATA
# ─────────────────────────────────────────────

def fetch_fii_dii() -> list:
    try:
        session = requests.Session()
        headers = {
            'User-Agent': ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                           'AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'),
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.nseindia.com/',
        }
        session.get('https://www.nseindia.com/', headers=headers, timeout=8)
        resp = session.get('https://www.nseindia.com/api/fiidiiTradeReact',
                           headers=headers, timeout=8)
        if resp.status_code != 200: return []
        raw = resp.json()
        if not isinstance(raw, list): return []

        def to_float(val):
            try: return round(float(str(val).replace(',', '')), 2)
            except: return 0.0

        result = []
        for row in raw[:5]:
            fii = row.get('fiiBuySell', row.get('fii', {}))
            dii = row.get('diiBuySell', row.get('dii', {}))
            fii_buy  = to_float(fii.get('buyValue',  fii.get('buy',  0)))
            fii_sell = to_float(fii.get('sellValue', fii.get('sell', 0)))
            fii_net  = to_float(fii.get('netValue',  fii.get('net',  fii_buy - fii_sell)))
            dii_buy  = to_float(dii.get('buyValue',  dii.get('buy',  0)))
            dii_sell = to_float(dii.get('sellValue', dii.get('sell', 0)))
            dii_net  = to_float(dii.get('netValue',  dii.get('net',  dii_buy - dii_sell)))
            result.append({'date': str(row.get('date', '')),
                           'fii_buy': fii_buy, 'fii_sell': fii_sell, 'fii_net': fii_net,
                           'dii_buy': dii_buy, 'dii_sell': dii_sell, 'dii_net': dii_net})
        return result
    except Exception as e:
        print(f"FII/DII error: {e}")
        return []


def fetch_stock_holdings(symbol: str) -> dict:
    try:
        info = yf.Ticker(f"{symbol}.NS").info
        inst    = info.get('heldPercentInstitutions', 0) or 0
        insider = info.get('heldPercentInsiders', 0) or 0
        return {
            "institutions_pct": round(float(inst) * 100, 2),
            "promoters_pct":    round(float(insider) * 100, 2),
            "public_pct":       round(max(0, 100 - float(inst)*100 - float(insider)*100), 2),
        }
    except Exception as e:
        print(f"Holdings fetch failed: {e}")
        return {"institutions_pct": 0, "promoters_pct": 0, "public_pct": 0}

# ─────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "StockX API running", "version": "2.0.0",
            "layers": 6, "timeframe": "5m"}

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "xgboost":   _xgb_artifact is not None,
            "catboost":  _cb_artifact  is not None,
            "hmm":       _hmm_artifact is not None,
            "iso_forest":_iso_artifact is not None,
            "shap":      _shap_artifact is not None,
            "finbert":   sentiment_pipeline is not None,
        },
    }


@app.post("/analyse")
def analyse(req: AnalyseRequest):
    symbol = req.symbol.upper().strip()

    # 1. Data + features
    vix_info = fetch_vix_data()
    df       = fetch_stock_data(symbol)
    df       = _merge_vix(df, vix_info)
    feat_df  = compute_features_5m(df)
    feat     = _latest_row(feat_df)
    tech     = _build_tech_snapshot(df, feat)

    # 2. Market regime (HMM)
    regime = layer_market_regime(vix_info)
    feat   = feat.copy()
    feat['regime'] = regime['regime']

    # 3. All layers
    signal    = layer_signal_intelligence(feat, tech)
    mc        = layer_monte_carlo(df, tech)
    pump      = layer_pump_dump(df, feat, tech)
    sentiment = layer_sentiment_gap(symbol, tech, signal['score'])
    behaviour = layer_behaviour(feat, tech, regime)

    # 4. Score + verdict
    final_score = compute_final_score(signal, mc, pump, sentiment, behaviour, regime)
    verdict     = get_verdict(final_score)

    # 5. AI explanation
    ai = generate_ai_explanation(symbol, final_score, verdict['label'],
                                 signal, mc, pump, sentiment, behaviour, regime)

    # 6. Supplemental data (best-effort)
    fii_dii  = fetch_fii_dii()
    holdings = fetch_stock_holdings(symbol)

    return {
        "symbol":       symbol,
        "full_name":    get_stock_name(symbol),
        "final_score":  final_score,
        "verdict":      verdict['label'],
        "verdict_color":verdict['color'],
        "one_liner":    ai['one_liner'],
        "explanation":  ai['explanation'],
        "regime":       regime,
        "signal_intel": signal,
        "monte_carlo":  {**mc, "paths": mc['paths'][:30]},
        "pump_dump":    pump,
        "sentiment_gap":sentiment,
        "behaviour":    behaviour,
        "tech_snapshot": {
            "current_price":    round(tech['current_price'], 2),
            "prev_close":       round(tech['prev_close'], 2),
            "rsi":              round(tech['rsi'], 1),
            "macd":             round(tech['macd'], 4),
            "macd_signal":      round(tech['macd_signal'], 4),
            "macd_hist":        round(tech['macd_hist'], 4),
            "vol_ratio":        round(tech['vol_ratio'], 2),
            "vol_today":        int(tech['vol_today']),
            "vol_30d_avg":      int(tech['vol_30d_avg']),
            "today_change_pct": round(tech['today_change_pct'], 2),
            "ema20":  round(tech['ema20'], 2),
            "ema50":  round(tech['ema50'], 2),
            "ema200": round(tech['ema200'], 2),
            "bb_upper": round(tech['bb_upper'], 2),
            "bb_lower": round(tech['bb_lower'], 2),
            "bb_mid":   round(tech['bb_mid'], 2),
            "bb_pos":   round(tech['bb_pos'], 3),
            "atr":      round(tech['atr'], 2),
            "atr_pct":  round(tech['atr_pct'], 2),
            "w52_high": round(tech['w52_high'], 2),
            "w52_low":  round(tech['w52_low'], 2),
            "mom5":     round(tech['mom5'], 2),
            "mom20":    round(tech['mom20'], 2),
            "vix":      round(tech['vix'], 2),
            "vix_change": round(tech['vix_change'], 2),
            "vix_spike":  tech['vix_spike'],
        },
        "news":           sentiment.get('news', []),
        "fii_dii":        fii_dii,
        "stock_holdings": holdings,
    }


@app.get("/explain/{symbol}")
def explain(symbol: str):
    """Returns SHAP feature contributions for XGBoost and CatBoost layers."""
    if _shap_artifact is None:
        raise HTTPException(status_code=503,
                            detail="SHAP explainers not loaded. Run training pipeline first.")

    symbol = symbol.upper().strip()
    vix_info = fetch_vix_data()
    df       = fetch_stock_data(symbol)
    df       = _merge_vix(df, vix_info)
    feat_df  = compute_features_5m(df)
    feat     = _latest_row(feat_df).copy()
    regime   = layer_market_regime(vix_info)
    feat['regime'] = regime['regime']

    def _top_shap(explainer, feature_names, feat_series, top_n=6):
        x = pd.DataFrame([feat_series[feature_names].values], columns=feature_names)
        shap_vals = explainer.shap_values(x)
        vals = np.array(shap_vals).flatten()
        idxs = np.argsort(np.abs(vals))[::-1][:top_n]
        return [
            {"feature": feature_names[i],
             "shap_value": round(float(vals[i]), 4),
             "direction": "increases_risk" if vals[i] > 0 else "reduces_risk"}
            for i in idxs
        ]

    xgb_shap = _top_shap(_shap_artifact['xgb'], SIGNAL_FEATURES, feat)
    cb_shap  = _top_shap(_shap_artifact['catboost'], SIGNAL_FEATURES, feat)

    return {
        "symbol": symbol,
        "regime": regime,
        "signal_intel_shap":  xgb_shap,
        "behaviour_risk_shap": cb_shap,
        "note": ("SHAP values show each feature's contribution to the risk score. "
                 "Positive = increases risk, negative = reduces risk."),
    }


@app.get("/stocks/popular")
def popular_stocks():
    return {
        "stocks": [
            {"symbol": "RELIANCE",  "name": "Reliance Industries",  "sector": "Energy"},
            {"symbol": "HDFCBANK",  "name": "HDFC Bank",            "sector": "Banking"},
            {"symbol": "INFY",      "name": "Infosys",              "sector": "IT"},
            {"symbol": "TATASTEEL", "name": "Tata Steel",           "sector": "Metals"},
            {"symbol": "SUZLON",    "name": "Suzlon Energy",        "sector": "Renewables"},
            {"symbol": "SBIN",      "name": "State Bank of India",  "sector": "Banking"},
            {"symbol": "WIPRO",     "name": "Wipro",                "sector": "IT"},
            {"symbol": "ADANIPORTS","name": "Adani Ports",          "sector": "Infrastructure"},
        ]
    }
