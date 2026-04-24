import re

with open('backend/main.py', 'r') as f:
    content = f.read()

replacement = """        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        
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
            df = df.dropna()"""

content = content.replace("        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]\n        df = df.dropna()", replacement)

with open('backend/main.py', 'w') as f:
    f.write(content)
