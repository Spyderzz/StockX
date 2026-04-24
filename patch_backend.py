import re

with open('backend/main.py', 'r') as f:
    content = f.read()

# 1. Update compute_technicals
tech_old = """def compute_technicals(df: pd.DataFrame) -> dict:
    \"\"\"Compute RSI, MACD, EMA, ATR, Bollinger Bands\"\"\"
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
    }"""

tech_new = """def compute_technicals(df: pd.DataFrame) -> dict:
    \"\"\"Compute RSI, MACD, EMA, ATR, Bollinger Bands\"\"\"
    close = df['Close']
    volume = df['Volume']
    high = df['High']
    low = df['Low']

    # RSI (Wilder's smoothing)
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    loss = -delta.clip(upper=0).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / (loss + 1e-10)
    rsi = float((100 - (100 / (1 + rs))).iloc[-1])

    # MACD
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd = float(macd_line.iloc[-1])
    signal_line = float(macd_line.ewm(span=9, adjust=False).mean().iloc[-1])
    macd_hist = macd - signal_line

    # EMAs
    ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])
    ema200 = float(close.ewm(span=200, min_periods=50, adjust=False).mean().iloc[-1])
    current_price = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else current_price

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
    bb_mid_series = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    bb_upper = float((bb_mid_series + 2 * bb_std).iloc[-1])
    bb_lower = float((bb_mid_series - 2 * bb_std).iloc[-1])
    bb_mid = float(bb_mid_series.iloc[-1])
    bb_pos = (current_price - bb_lower) / (bb_upper - bb_lower + 1e-10)

    # Price momentum
    mom5 = float((close.pct_change(5) * 100).iloc[-1])
    mom20 = float((close.pct_change(20) * 100).iloc[-1])

    # Today's change
    today_change_pct = float((close.pct_change().iloc[-1]) * 100)

    # 52-week high/low
    w52_high = float(close.rolling(min(252, len(close))).max().iloc[-1])
    w52_low  = float(close.rolling(min(252, len(close))).min().iloc[-1])

    return {
        'rsi': rsi,
        'macd': macd, 'macd_hist': macd_hist, 'macd_signal': signal_line,
        'ema20': ema20, 'ema50': ema50, 'ema200': ema200,
        'current_price': current_price, 'prev_close': prev_close,
        'atr': atr, 'atr_pct': atr_pct,
        'vol_ratio': vol_ratio, 'vol_today': vol_today, 'vol_30d_avg': vol_30d_avg,
        'bb_upper': bb_upper, 'bb_lower': bb_lower, 'bb_mid': bb_mid, 'bb_pos': bb_pos,
        'mom5': mom5, 'mom20': mom20,
        'today_change_pct': today_change_pct,
        'w52_high': w52_high, 'w52_low': w52_low,
    }"""

content = content.replace(tech_old, tech_new)

# 2. Update layer_signal_intelligence labels
content = re.sub(r'model_label = "XGBoost \(trained\)"', 'model_label = "Machine Learning (Setup Quality)"', content)
content = re.sub(r'model_label = "Rule-based \(XGBoost error fallback\)"', 'model_label = "Rule-based (ML error fallback)"', content)
signal_return_old = """    return {"score": score, "finding": finding, "model": model_label}"""
signal_return_new = """    # Setup label for the card
    if score >= 65:
        setup_label = "GOOD SETUP"
        setup_color = "green"
    elif score >= 40:
        setup_label = "AVERAGE"
        setup_color = "yellow"
    else:
        setup_label = "POOR SETUP"
        setup_color = "red"

    return {
        "score": score,
        "setup_label": setup_label,
        "setup_color": setup_color,
        "finding": finding,
        "model": model_label
    }"""
content = content.replace(signal_return_old, signal_return_new)

# 3. Update layer_monte_carlo model label
content = re.sub(r'"model": "Monte Carlo \(GBM, 10,000 simulations\)"', '"model": "Statistical Simulation"', content)

# 4. Update layer_pump_dump labels
content = re.sub(r'model_label = "Isolation Forest \(pre-trained\)"', 'model_label = "Anomaly Detection Engine"', content)
content = re.sub(r'model_label = "Isolation Forest \(inline fallback\)"', 'model_label = "Anomaly Detection Engine (inline fallback)"', content)
content = re.sub(r'model_label = "Isolation Forest \(inline — no pre-trained model\)"', 'model_label = "Anomaly Detection Engine (inline — no pre-trained model)"', content)
pump_return_old = """    return {
        "score": round(float(normalized), 1),
        "finding": finding,
        "model": model_label
    }"""
pump_return_new = """    # Anomaly label for the card
    if normalized >= 70:
        anomaly_label = "HIGH RISK"
        anomaly_color = "red"
    elif normalized >= 40:
        anomaly_label = "SUSPICIOUS"
        anomaly_color = "yellow"
    else:
        anomaly_label = "CLEAN"
        anomaly_color = "green"

    return {
        "score": round(float(normalized), 1),
        "is_anomaly": bool(is_anomaly),
        "anomaly_label": anomaly_label,
        "anomaly_color": anomaly_color,
        "finding": finding,
        "model": model_label
    }"""
content = content.replace(pump_return_old, pump_return_new)

# 5. Update layer_sentiment_gap news fallback and model label
content = re.sub(r'"model": "FinBERT \+ Lexicon Sentiment"', '"model": "NLP Sentiment Engine"', content)
sentiment_fallback = """    if NEWS_API_KEY:
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
            pass"""
sentiment_fallback_new = """    if NEWS_API_KEY:
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

    # Fallback: yfinance news if NewsAPI returned nothing
    if not articles_data:
        try:
            t = yf.Ticker(f"{symbol}.NS")
            yf_news = t.news or []
            for item in yf_news[:5]:
                content_ = item.get('content', {})
                title = content_.get('title') or item.get('title', '')
                if not title:
                    continue
                provider = content_.get('provider', {}).get('displayName', '') or item.get('publisher', '')
                link = content_.get('canonicalUrl', {}).get('url', '') or item.get('link', '')
                pub_time = content_.get('pubDate', '') or item.get('providerPublishTime', '')
                if isinstance(pub_time, (int, float)):
                    from datetime import datetime, timezone
                    pub_time = datetime.fromtimestamp(pub_time, tz=timezone.utc).isoformat()
                headlines_used.append(title)
                articles_data.append({
                    'title': title,
                    'source': provider,
                    'url': link,
                    'publishedAt': str(pub_time),
                })
        except Exception as e:
            print(f"yfinance news fallback failed: {e}")"""
content = content.replace(sentiment_fallback, sentiment_fallback_new)

# 6. Update fetch_fii_dii to include stock specific data
# actually let's just make a new function
stock_holdings_func = """
def fetch_stock_holdings(symbol: str) -> dict:
    try:
        t = yf.Ticker(f"{symbol}.NS")
        info = t.info
        institutions = info.get('heldPercentInstitutions', 0)
        insiders = info.get('heldPercentInsiders', 0)
        
        return {
            "institutions_pct": float(institutions) * 100 if institutions else 0,
            "promoters_pct": float(insiders) * 100 if insiders else 0,
            "public_pct": max(0, 100 - (float(institutions) * 100 if institutions else 0) - (float(insiders) * 100 if insiders else 0))
        }
    except Exception as e:
        print(f"Holding fetch failed: {e}")
        return {"institutions_pct": 0, "promoters_pct": 0, "public_pct": 0}

"""
content = content.replace("@app.get(\"/\")", stock_holdings_func + "@app.get(\"/\")")

# 7. Update tech snapshot in return dict
tech_snap_old = """        "tech_snapshot": {
            "current_price": round(tech['current_price'], 2),
            "rsi": round(tech['rsi'], 1),
            "vol_ratio": round(tech['vol_ratio'], 2),
            "today_change_pct": round(tech['today_change_pct'], 2),
            "ema20": round(tech['ema20'], 2),
            "ema200": round(tech['ema200'], 2),
        },"""
tech_snap_new = """        "tech_snapshot": {
            "current_price": round(tech['current_price'], 2),
            "prev_close": round(tech['prev_close'], 2),
            "rsi": round(tech['rsi'], 1),
            "macd": round(tech['macd'], 4),
            "macd_signal": round(tech['macd_signal'], 4),
            "macd_hist": round(tech['macd_hist'], 4),
            "vol_ratio": round(tech['vol_ratio'], 2),
            "vol_today": int(tech['vol_today']),
            "vol_30d_avg": int(tech['vol_30d_avg']),
            "today_change_pct": round(tech['today_change_pct'], 2),
            "ema20": round(tech['ema20'], 2),
            "ema50": round(tech['ema50'], 2),
            "ema200": round(tech['ema200'], 2),
            "bb_upper": round(tech['bb_upper'], 2),
            "bb_lower": round(tech['bb_lower'], 2),
            "bb_mid": round(tech['bb_mid'], 2),
            "bb_pos": round(tech['bb_pos'], 3),
            "atr": round(tech['atr'], 2),
            "atr_pct": round(tech['atr_pct'], 2),
            "w52_high": round(tech['w52_high'], 2),
            "w52_low": round(tech['w52_low'], 2),
            "mom5": round(tech['mom5'], 2),
            "mom20": round(tech['mom20'], 2),
        },"""
content = content.replace(tech_snap_old, tech_snap_new)

# 8. Add stock_holdings to response
content = content.replace('"fii_dii": fii_dii,', '"fii_dii": fii_dii,\n        "stock_holdings": fetch_stock_holdings(symbol),')

with open('backend/main.py', 'w') as f:
    f.write(content)
