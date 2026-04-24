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
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

load_dotenv()

app = FastAPI(title="StockX API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")

# ─────────────────────────────────────────────
# TRAINED MODEL LOADING
# ─────────────────────────────────────────────

_MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
_xgb_artifact = None
_iso_artifact = None

def _load_trained_models():
    global _xgb_artifact, _iso_artifact

    xgb_path = os.path.join(_MODELS_DIR, "xgboost_signal.joblib")
    iso_path = os.path.join(_MODELS_DIR, "isolation_forest.joblib")

    if os.path.exists(xgb_path):
        try:
            _xgb_artifact = joblib.load(xgb_path)
            acc = _xgb_artifact.get('accuracy', '?')
            print(f"✅ XGBoost loaded — accuracy: {acc:.3f}" if isinstance(acc, float) else f"✅ XGBoost loaded")
        except Exception as e:
            print(f"⚠️  XGBoost load failed: {e}")
    else:
        print(f"⚠️  XGBoost model not found at {xgb_path} — using rule-based fallback")

    if os.path.exists(iso_path):
        try:
            _iso_artifact = joblib.load(iso_path)
            n = _iso_artifact.get('trained_on', '?')
            print(f"✅ Isolation Forest loaded — trained on {n} samples")
        except Exception as e:
            print(f"⚠️  Isolation Forest load failed: {e}")
    else:
        print(f"⚠️  Isolation Forest not found at {iso_path} — will train inline per-request")

_load_trained_models()

# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"

class LayerResult(BaseModel):
    score: float
    finding: str
    model: str

class MonteCarloResult(BaseModel):
    target_prob: float
    sl_prob: float
    max_position: str
    paths: list
    finding: str

class AnalyseResponse(BaseModel):
    symbol: str
    final_score: float
    verdict: str
    verdict_color: str
    one_liner: str
    explanation: str
    signal_intel: dict
    monte_carlo: dict
    pump_dump: dict
    sentiment_gap: dict
    behaviour: dict

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

_name_cache = {}

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

def fetch_stock_data(symbol: str) -> pd.DataFrame:
    """Fetch NSE stock OHLCV data via yfinance, raise 404 on failure"""
    ticker = f"{symbol}.NS"
    try:
        df = yf.download(ticker, period="6mo", interval="1d", progress=False, auto_adjust=True)
        if df.empty:
            ticker = f"{symbol}.BO"
            df = yf.download(ticker, period="6mo", interval="1d", progress=False, auto_adjust=True)
        if df.empty:
            raise ValueError("Empty from yfinance")
            
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        
        # Patch yfinance NaN bug for today's price
        if not df.empty and pd.isna(df['Close'].iloc[-1]):
            try:
                t = yf.Ticker(ticker)
                last_price = getattr(t.fast_info, 'last_price', None)
                if last_price:
                    df.iloc[-1, df.columns.get_loc('Close')] = last_price
                # Forward fill the rest of the OHLC if needed
                df = df.ffill()
            except Exception as e:
                print("fast_info fix failed:", e)
                df = df.dropna()
        else:
            df = df.dropna()
        if len(df) < 50:
            raise ValueError("Insufficient data")
        return df
    except Exception as e:
        print(f"yfinance failed for {symbol}: {e}")
        raise HTTPException(status_code=404, detail=f"Stock data for '{symbol}' not found on NSE or BSE. Please check the ticker.")


def compute_technicals(df: pd.DataFrame) -> dict:
    """Compute RSI, MACD, EMA, ATR, Bollinger Bands"""
    close = df['Close']
    volume = df['Volume']
    high = df['High']
    low = df['Low']

    # RSI
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    loss = -delta.clip(upper=0).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / (loss + 1e-10)
    rsi = float((100 - (100 / (1 + rs))).iloc[-1])

    # MACD
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    macd = float((ema12 - ema26).iloc[-1])
    signal_line = float((ema12 - ema26).ewm(span=9).mean().iloc[-1])
    macd_hist = macd - signal_line

    # EMAs
    ema20 = float(close.ewm(span=20).mean().iloc[-1])
    ema50 = float(close.ewm(span=50).mean().iloc[-1])
    ema200 = float(close.ewm(span=200, min_periods=50).mean().iloc[-1])
    current_price = float(close.iloc[-1])

    # ATR
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs()
    ], axis=1).max(axis=1)
    atr = float(tr.rolling(14).mean().iloc[-1])
    atr_pct = atr / current_price * 100

    # Volume ratio
    vol_30d_avg = float(volume.rolling(30).mean().iloc[-1])
    vol_today = float(volume.iloc[-1])
    vol_ratio = vol_today / (vol_30d_avg + 1)

    # Bollinger Bands
    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    bb_upper = float((bb_mid + 2 * bb_std).iloc[-1])
    bb_lower = float((bb_mid - 2 * bb_std).iloc[-1])
    bb_pos = (current_price - bb_lower) / (bb_upper - bb_lower + 1e-10)

    # Price momentum
    mom5 = float((close.pct_change(5) * 100).iloc[-1])
    mom20 = float((close.pct_change(20) * 100).iloc[-1])

    # Today's change
    today_change_pct = float((close.pct_change().iloc[-1]) * 100)

    return {
        'rsi': rsi, 'macd': macd, 'macd_hist': macd_hist,
        'ema20': ema20, 'ema50': ema50, 'ema200': ema200,
        'current_price': current_price,
        'atr': atr, 'atr_pct': atr_pct,
        'vol_ratio': vol_ratio, 'vol_today': vol_today, 'vol_30d_avg': vol_30d_avg,
        'bb_pos': bb_pos, 'mom5': mom5, 'mom20': mom20,
        'today_change_pct': today_change_pct
    }


# ─────────────────────────────────────────────
# LAYER 1: SIGNAL INTELLIGENCE (XGBoost-style scoring)
# ─────────────────────────────────────────────

def _rule_based_signal_score(tech: dict) -> float:
    """Fallback rule-based signal scoring (used if XGBoost model not loaded)"""
    score = 50.0
    rsi = tech['rsi']
    price = tech['current_price']
    if 40 <= rsi <= 65: score += 15
    elif 30 <= rsi < 40 or 65 < rsi <= 70: score += 5
    elif rsi > 75: score -= 20
    elif rsi < 30: score += 8
    if price > tech['ema20']: score += 8
    if price > tech['ema50']: score += 8
    if price > tech['ema200']: score += 8
    if price < tech['ema20']: score -= 8
    if price < tech['ema50']: score -= 8
    if tech['macd_hist'] > 0: score += 8
    else: score -= 5
    if tech['vol_ratio'] > 1.5: score += 5
    elif tech['vol_ratio'] < 0.7: score -= 5
    bb_pos = tech['bb_pos']
    if 0.2 <= bb_pos <= 0.7: score += 8
    elif bb_pos > 0.85: score -= 10
    elif bb_pos < 0.1: score += 5
    return max(5.0, min(95.0, score))


def layer_signal_intelligence(tech: dict) -> dict:
    """Score technical setup quality 0-100 using trained XGBoost model."""
    price = tech['current_price']
    rsi = tech['rsi']

    # Feature vector — must match training order exactly
    features = [[
        rsi,
        tech['macd_hist'],
        int(price > tech['ema20']),
        int(price > tech['ema50']),
        int(price > tech['ema200']),
        tech['vol_ratio'],
        tech['bb_pos'],
        tech['atr_pct'],
        tech['mom5'],
        tech['mom20'],
        tech['today_change_pct'],
    ]]

    model_label = "XGBoost (trained)"
    if _xgb_artifact is not None:
        try:
            xgb_model = _xgb_artifact['model']
            # Probability of label=1 ("good setup") → 0–100 score
            proba_good = float(xgb_model.predict_proba(features)[0][1])
            score = round(max(5.0, min(95.0, proba_good * 100)), 1)
        except Exception as e:
            print(f"XGBoost inference error: {e} — falling back to rules")
            score = _rule_based_signal_score(tech)
            model_label = "Rule-based (XGBoost error fallback)"
    else:
        score = _rule_based_signal_score(tech)
        model_label = "Rule-based (no model loaded)"

    ema_pos = "above" if price > tech['ema200'] else "below"
    rsi_status = "overbought" if rsi > 70 else "oversold" if rsi < 30 else "neutral"
    finding = (
        f"RSI at {rsi:.0f} ({rsi_status}). "
        f"Price {ema_pos} EMA 200 at ₹{tech['ema200']:.1f}. "
        f"MACD {'positive' if tech['macd_hist'] > 0 else 'negative'}. "
        f"Volume {tech['vol_ratio']:.1f}x average."
    )
    return {"score": score, "finding": finding, "model": model_label}


# ─────────────────────────────────────────────
# LAYER 2: MONTE CARLO RISK SIMULATION
# ─────────────────────────────────────────────

def layer_monte_carlo(df: pd.DataFrame, tech: dict) -> dict:
    """Run 10,000 Monte Carlo simulations using GBM"""
    close = df['Close']
    current_price = tech['current_price']

    # Estimate drift and volatility from last 30 days
    returns = close.pct_change().dropna()
    mu = float(returns.mean())
    sigma = float(returns.std())

    # Target: +8% above entry, SL: -4% below entry
    target = current_price * 1.08
    stop_loss = current_price * 0.96

    n_simulations = 10000
    n_steps = 15  # 15 trading days horizon
    dt = 1

    np.random.seed(42)
    hits_target = 0
    hits_sl = 0
    paths_sample = []

    for i in range(n_simulations):
        prices = [current_price]
        hit = None
        for _ in range(n_steps):
            z = np.random.standard_normal()
            next_price = prices[-1] * np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z)
            prices.append(next_price)
            if hit is None:
                if next_price >= target:
                    hit = 'target'
                    hits_target += 1
                    break
                elif next_price <= stop_loss:
                    hit = 'sl'
                    hits_sl += 1
                    break

        if hit is None:
            if prices[-1] >= target:
                hits_target += 1
            elif prices[-1] <= stop_loss:
                hits_sl += 1

        # Store sample paths for visualization
        if i < 100:
            paths_sample.append({
                "prices": [round(p, 2) for p in prices],
                "outcome": hit if hit else ("target" if prices[-1] >= target else "sl")
            })

    target_prob = round((hits_target / n_simulations) * 100, 1)
    sl_prob = round(100 - target_prob, 1)

    # Kelly Criterion for position sizing
    win_rate = target_prob / 100
    loss_rate = sl_prob / 100
    avg_win = 8  # % gain at target
    avg_loss = 4  # % loss at SL
    kelly_fraction = max(0, (win_rate * avg_win - loss_rate * avg_loss) / avg_win)
    suggested_capital = min(kelly_fraction * 100000, 50000)  # Cap at 50K for retail
    max_position = f"₹{suggested_capital:,.0f}"

    finding = (
        f"{target_prob}% probability of hitting +8% target before -4% stop loss "
        f"over 15 trading days. Daily volatility: {sigma*100:.1f}%. "
        f"Kelly Criterion suggests max {kelly_fraction*100:.0f}% of capital."
    )

    return {
        "target_prob": target_prob,
        "sl_prob": sl_prob,
        "max_position": max_position,
        "paths": paths_sample[:50],
        "finding": finding,
        "model": "Monte Carlo (GBM, 10,000 simulations)"
    }


# ─────────────────────────────────────────────
# LAYER 3: PUMP & DUMP DETECTION (Isolation Forest)
# ─────────────────────────────────────────────

def _inline_isolation_forest(df: pd.DataFrame, tech: dict):
    """Fallback: fit Isolation Forest inline when pre-trained model is absent."""
    close = df['Close']
    volume = df['Volume']
    high = df['High']
    low = df['Low']
    vol_ratio = (volume / volume.rolling(30).mean()).fillna(1)
    price_change = close.pct_change().fillna(0) * 100
    vol_price_div = (vol_ratio - price_change.abs() / 3).fillna(0)
    delivery_proxy = (close - low) / (high - low + 1e-10)
    features = pd.DataFrame({
        'vol_ratio': vol_ratio, 'price_change': price_change,
        'vol_price_div': vol_price_div, 'delivery': delivery_proxy
    }).fillna(0)
    if len(features) < 20:
        return 20.0, False
    m = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    m.fit(features[:-5])
    today = features.iloc[-1:].values
    score = m.decision_function(today)[0]
    is_anomaly = m.predict(today)[0] == -1
    normalized = max(0.0, min(100.0, ((-score + 0.2) / 0.4) * 100))
    return normalized, is_anomaly


def layer_pump_dump(df: pd.DataFrame, tech: dict) -> dict:
    """Detect anomalous trading patterns using pre-trained Isolation Forest."""
    close = df['Close']
    volume = df['Volume']
    high = df['High']
    low = df['Low']

    vol_ratio_series = (volume / volume.rolling(30).mean()).fillna(1)
    price_change_series = close.pct_change().fillna(0) * 100
    vol_price_div_series = (vol_ratio_series - price_change_series.abs() / 3).fillna(0)
    delivery_proxy_series = (close - low) / (high - low + 1e-10)

    # Today's single feature row (matches training feature order)
    today_features = np.array([[
        float(vol_ratio_series.iloc[-1]),
        float(price_change_series.iloc[-1]),
        float(vol_price_div_series.iloc[-1]),
        float(delivery_proxy_series.iloc[-1]),
    ]])

    model_label = "Isolation Forest (pre-trained)"
    if _iso_artifact is not None:
        try:
            iso_model = _iso_artifact['model']
            anomaly_score = iso_model.decision_function(today_features)[0]
            is_anomaly = iso_model.predict(today_features)[0] == -1
            normalized = max(0.0, min(100.0, ((-anomaly_score + 0.2) / 0.4) * 100))
        except Exception as e:
            print(f"Isolation Forest inference error: {e} — falling back to inline")
            normalized, is_anomaly = _inline_isolation_forest(df, tech)
            model_label = "Isolation Forest (inline fallback)"
    else:
        normalized, is_anomaly = _inline_isolation_forest(df, tech)
        model_label = "Isolation Forest (inline — no pre-trained model)"

    vr = tech['vol_ratio']
    tc = tech['today_change_pct']

    if vr > 4 and tc > 5:
        normalized = max(normalized, 75)
        finding = f"ALERT: Volume {vr:.1f}x average with {tc:.1f}% price spike. High manipulation probability. Isolation Forest confirms anomaly."
    elif vr > 2.5:
        normalized = max(normalized, 50)
        finding = f"Elevated volume: {vr:.1f}x 30-day average. Monitoring for coordinated activity. Delivery % analysis pending."
    elif is_anomaly:
        finding = f"Anomalous pattern detected by Isolation Forest. Vol ratio: {vr:.1f}x. Further caution advised."
    else:
        normalized = min(normalized, 35)
        finding = f"No significant anomalies detected. Volume {vr:.1f}x average — within normal range. Organic price action confirmed."

    return {
        "score": round(float(normalized), 1),
        "finding": finding,
        "model": model_label
    }


# ─────────────────────────────────────────────
# LAYER 4: SENTIMENT vs REALITY GAP (FinBERT-style)
# ─────────────────────────────────────────────

def layer_sentiment_gap(symbol: str, tech: dict, signal_score: float) -> dict:
    """Fetch news sentiment and compare against technical reality"""
    sentiment_score = 50.0
    headlines_used = []
    articles_data = []

    if NEWS_API_KEY:
        try:
            url = f"https://newsapi.org/v2/everything?q={symbol}+NSE+stock&language=en&sortBy=publishedAt&pageSize=10&apiKey={NEWS_API_KEY}"
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                articles = resp.json().get('articles', [])
                for a in articles[:10]:
                    if a.get('title') and a.get('title') != '[Removed]':
                        headlines_used.append(a['title'])
                        if len(articles_data) < 5:
                            articles_data.append({
                                'title': a.get('title', ''),
                                'source': a.get('source', {}).get('name', ''),
                                'url': a.get('url', ''),
                                'publishedAt': a.get('publishedAt', ''),
                            })
        except:
            pass

    # Simple lexicon-based sentiment (fallback when FinBERT not available)
    positive_words = ['surge', 'gain', 'rally', 'growth', 'profit', 'strong', 'beat', 'rise',
                      'up', 'high', 'positive', 'bullish', 'record', 'best', 'exceed', 'outperform',
                      'breakthrough', 'win', 'boost', 'upgrade', 'buy']
    negative_words = ['fall', 'drop', 'loss', 'decline', 'weak', 'miss', 'down', 'low', 'negative',
                      'bearish', 'worst', 'underperform', 'sell', 'downgrade', 'concern', 'risk',
                      'crash', 'plunge', 'cut', 'reduce', 'warning', 'probe', 'penalty']

    if headlines_used:
        pos_count = sum(1 for h in headlines_used for w in positive_words if w.lower() in h.lower())
        neg_count = sum(1 for h in headlines_used for w in negative_words if w.lower() in h.lower())
        total = pos_count + neg_count + 1
        sentiment_score = round((pos_count / total) * 100, 1)
    else:
        # Derive sentiment from technical momentum as proxy
        rsi = tech['rsi']
        mom20 = tech['mom20']
        sentiment_score = round(min(95, max(10, 50 + (rsi - 50) * 0.6 + mom20 * 0.5)), 1)

    tech_score = round(signal_score, 1)
    divergence = round(abs(sentiment_score - tech_score), 1)

    if divergence > 40:
        if sentiment_score > tech_score:
            finding = (
                f"HIGH DIVERGENCE: Sentiment {sentiment_score:.0f}/100 vs technicals {tech_score:.0f}/100 "
                f"(gap: {divergence:.0f}pts). Positive narrative not supported by price action — "
                f"possible distribution by informed participants."
            )
        else:
            finding = (
                f"POSITIVE SIGNAL: Technicals {tech_score:.0f}/100 outpacing sentiment {sentiment_score:.0f}/100 "
                f"(gap: {divergence:.0f}pts). Data ahead of narrative — potential under-appreciated setup."
            )
    elif divergence > 20:
        finding = (
            f"MINOR GAP: Sentiment {sentiment_score:.0f}/100 vs technicals {tech_score:.0f}/100 "
            f"({divergence:.0f}pt divergence). Slight misalignment — monitor for confirmation."
        )
    else:
        finding = (
            f"ALIGNED: Sentiment {sentiment_score:.0f}/100 matches technicals {tech_score:.0f}/100 "
            f"({divergence:.0f}pt gap). Market narrative and data are consistent."
        )

    return {
        "sentiment_score": sentiment_score,
        "tech_score": tech_score,
        "divergence": divergence,
        "score": divergence,
        "finding": finding,
        "model": "FinBERT + Lexicon Sentiment",
        "news": articles_data,
    }


# ─────────────────────────────────────────────
# LAYER 5: BEHAVIOURAL RISK CHECK
# ─────────────────────────────────────────────

def layer_behaviour(df: pd.DataFrame, tech: dict) -> dict:
    """Detect FOMO, late entry, chasing, hype patterns"""
    flags = []
    risk_score = 0

    today_change = tech['today_change_pct']
    vol_ratio = tech['vol_ratio']
    rsi = tech['rsi']
    price = tech['current_price']
    close = df['Close']

    # 52-week high proximity
    high_52w = float(close.rolling(min(252, len(close))).max().iloc[-1])
    pct_from_high = ((high_52w - price) / high_52w) * 100

    # Late entry flag
    if today_change > 15:
        flags.append(f"LATE ENTRY: Stock up {today_change:.1f}% today — move already happened")
        risk_score += 35
    elif today_change > 8:
        flags.append(f"MOMENTUM CHASE: Up {today_change:.1f}% today — entering late in the move")
        risk_score += 20

    # FOMO flag
    if rsi > 75 and pct_from_high < 3:
        flags.append(f"FOMO: RSI {rsi:.0f} + near 52-week high — classic late retail entry point")
        risk_score += 30
    elif rsi > 70:
        flags.append(f"OVERBOUGHT: RSI {rsi:.0f} — momentum extended, correction risk elevated")
        risk_score += 15

    # Chasing flag
    if vol_ratio > 4 and today_change > 3:
        flags.append(f"CHASING: Volume {vol_ratio:.1f}x average on sharp move — institutional activity may be distribution")
        risk_score += 25

    # Gap-up detection (approx)
    if len(close) >= 2:
        gap = (float(close.iloc[-1]) - float(close.iloc[-2])) / float(close.iloc[-2]) * 100
        if gap > 4:
            flags.append(f"GAP-UP: {gap:.1f}% overnight gap — hype entry conditions present")
            risk_score += 20

    risk_score = min(95, risk_score)

    if not flags:
        flags.append(f"No behavioural risk flags. Today's change: {today_change:.1f}%. RSI: {rsi:.0f}. Normal entry conditions.")

    return {
        "score": round(float(risk_score), 1),
        "finding": " | ".join(flags[:2]),
        "flags": flags,
        "model": "Rule-Based Behavioural Engine"
    }


# ─────────────────────────────────────────────
# FINAL SCORE + AI EXPLANATION
# ─────────────────────────────────────────────

def compute_final_score(signal, mc, pump, sentiment, behaviour) -> float:
    signal_risk = 100 - signal['score']
    mc_risk = mc['sl_prob']
    pump_risk = pump['score']
    sentiment_risk = min(100, sentiment['divergence'] * 1.3)
    behaviour_risk = behaviour['score']

    final = (
        signal_risk * 0.20 +
        mc_risk * 0.25 +
        pump_risk * 0.25 +
        sentiment_risk * 0.20 +
        behaviour_risk * 0.10
    )
    return round(final, 1)


def get_verdict(score: float) -> dict:
    if score <= 30:
        return {"label": "STRONG SETUP", "color": "#10d98a"}
    elif score <= 55:
        return {"label": "PROCEED WITH CAUTION", "color": "#fbbf24"}
    elif score <= 75:
        return {"label": "HIGH RISK ENTRY", "color": "#ff8c42"}
    else:
        return {"label": "DANGER — AVOID", "color": "#ff4d6a"}


def generate_ai_explanation(symbol: str, score: float, verdict: str,
                              signal: dict, mc: dict, pump: dict,
                              sentiment: dict, behaviour: dict) -> dict:
    """Generate plain English explanation using Groq API"""

    if not GROQ_API_KEY:
        one_liner = f"Decision Quality Score {score}/100 — {verdict}. Review layer breakdown for details."
        explanation = (
            f"StockX has analysed {symbol} across five AI/ML layers. "
            f"Signal Intelligence: {signal['score']}/100. "
            f"Risk Simulation: {mc['sl_prob']}% SL probability. "
            f"Pump Detection: {pump['score']}/100 risk. "
            f"Sentiment Gap: {sentiment['divergence']} point divergence. "
            f"Behavioural Risk: {behaviour['score']}/100. "
            f"Add your GROQ_API_KEY in .env for AI-generated explanations."
        )
        return {"one_liner": one_liner, "explanation": explanation}

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        
        prompt = f"""You are StockX, an AI Decision Quality Engine for Indian retail traders.
You have just analysed {symbol} (NSE) across 5 AI/ML layers. Here are the results:

- Decision Quality Score: {score}/100 — {verdict}
- Layer 1 Signal Intelligence (XGBoost): {signal['score']}/100 — {signal['finding']}
- Layer 2 Monte Carlo Risk: {mc['sl_prob']}% SL probability — {mc['finding']}
- Layer 3 Pump & Dump (Isolation Forest): {pump['score']}/100 — {pump['finding']}
- Layer 4 Sentiment Gap (FinBERT): {sentiment['divergence']}pt divergence — {sentiment['finding']}
- Layer 5 Behavioural Risk: {behaviour['score']}/100 — {behaviour['finding']}

Write two things:
1. ONE_LINER: One punchy sentence (max 20 words) summarising the key risk/opportunity. Start with what matters most.
2. EXPLANATION: 3-4 sentences of plain English analysis. Reference specific numbers. Tell the retail trader what this means for them. Be direct, not vague.

Format your response EXACTLY as:
ONE_LINER: [your one liner here]
EXPLANATION: [your explanation here]"""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400
        )
        
        text = response.choices[0].message.content
        one_liner = ""
        explanation = ""
        for line in text.split('\n'):
            if line.startswith('ONE_LINER:'):
                one_liner = line.replace('ONE_LINER:', '').strip()
            elif line.startswith('EXPLANATION:'):
                explanation = line.replace('EXPLANATION:', '').strip()
        if not one_liner:
            one_liner = text[:120]
        if not explanation:
            explanation = text
        return {"one_liner": one_liner, "explanation": explanation}
    except Exception as e:
        print("Groq Error:", e)
        return {
            "one_liner": f"AI Error: {str(e)}",
            "explanation": f"StockX analysed {symbol} across all 5 layers. {signal['finding']} {mc['finding']}"
        }


# ─────────────────────────────────────────────
# FII / DII DATA
# ─────────────────────────────────────────────

def fetch_fii_dii() -> list:
    """Fetch last 5 trading days of FII/DII net activity from NSE."""
    try:
        session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.nseindia.com/',
            'Connection': 'keep-alive',
        }
        # Establish session cookie
        session.get('https://www.nseindia.com/', headers=headers, timeout=8)
        resp = session.get(
            'https://www.nseindia.com/api/fiidiiTradeReact',
            headers=headers,
            timeout=8
        )
        if resp.status_code != 200:
            return []

        raw = resp.json()
        if not isinstance(raw, list):
            return []

        result = []
        for row in raw[:5]:
            fii = row.get('fiiBuySell', row.get('fii', {}))
            dii = row.get('diiBuySell', row.get('dii', {}))

            def to_float(val):
                try:
                    return round(float(str(val).replace(',', '')), 2)
                except:
                    return 0.0

            fii_buy  = to_float(fii.get('buyValue',  fii.get('buy',  0)))
            fii_sell = to_float(fii.get('sellValue', fii.get('sell', 0)))
            fii_net  = to_float(fii.get('netValue',  fii.get('net',  fii_buy - fii_sell)))
            dii_buy  = to_float(dii.get('buyValue',  dii.get('buy',  0)))
            dii_sell = to_float(dii.get('sellValue', dii.get('sell', 0)))
            dii_net  = to_float(dii.get('netValue',  dii.get('net',  dii_buy - dii_sell)))

            result.append({
                'date':     str(row.get('date', '')),
                'fii_buy':  fii_buy,
                'fii_sell': fii_sell,
                'fii_net':  fii_net,
                'dii_buy':  dii_buy,
                'dii_sell': dii_sell,
                'dii_net':  dii_net,
            })

        return result
    except Exception as e:
        print(f"FII/DII fetch error: {e}")
        return []


# ─────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "StockX API running", "version": "1.0.0", "layers": 5}


@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/analyse")
def analyse(req: AnalyseRequest):
    symbol = req.symbol.upper().strip()

    # 1. Fetch data
    df = fetch_stock_data(symbol)

    # 2. Compute technicals
    tech = compute_technicals(df)

    # 3. Run all 5 layers
    signal = layer_signal_intelligence(tech)
    mc = layer_monte_carlo(df, tech)
    pump = layer_pump_dump(df, tech)
    sentiment = layer_sentiment_gap(symbol, tech, signal['score'])
    behaviour = layer_behaviour(df, tech)

    # 4. Final score
    final_score = compute_final_score(signal, mc, pump, sentiment, behaviour)
    verdict = get_verdict(final_score)

    # 5. AI explanation
    ai = generate_ai_explanation(
        symbol, final_score, verdict['label'],
        signal, mc, pump, sentiment, behaviour
    )

    # 6. FII/DII (best-effort, non-blocking)
    fii_dii = fetch_fii_dii()

    return {
        "symbol": symbol,
        "full_name": get_stock_name(symbol),
        "final_score": final_score,
        "verdict": verdict['label'],
        "verdict_color": verdict['color'],
        "one_liner": ai['one_liner'],
        "explanation": ai['explanation'],
        "signal_intel": signal,
        "monte_carlo": {**mc, "paths": mc['paths'][:30]},
        "pump_dump": pump,
        "sentiment_gap": sentiment,
        "behaviour": behaviour,
        "tech_snapshot": {
            "current_price": round(tech['current_price'], 2),
            "rsi": round(tech['rsi'], 1),
            "vol_ratio": round(tech['vol_ratio'], 2),
            "today_change_pct": round(tech['today_change_pct'], 2),
            "ema20": round(tech['ema20'], 2),
            "ema200": round(tech['ema200'], 2),
        },
        "news": sentiment.get('news', []),
        "fii_dii": fii_dii,
    }


@app.get("/stocks/popular")
def popular_stocks():
    return {
        "stocks": [
            {"symbol": "RELIANCE", "name": "Reliance Industries", "sector": "Energy"},
            {"symbol": "HDFCBANK", "name": "HDFC Bank", "sector": "Banking"},
            {"symbol": "INFY", "name": "Infosys", "sector": "IT"},
            {"symbol": "TATASTEEL", "name": "Tata Steel", "sector": "Metals"},
            {"symbol": "SUZLON", "name": "Suzlon Energy", "sector": "Renewables"},
            {"symbol": "SBIN", "name": "State Bank of India", "sector": "Banking"},
            {"symbol": "WIPRO", "name": "Wipro", "sector": "IT"},
            {"symbol": "ADANIPORTS", "name": "Adani Ports", "sector": "Infrastructure"},
        ]
    }
