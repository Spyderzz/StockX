import yfinance as yf
import pandas as pd

df = yf.Ticker('HUDCO.NS').history(period='6mo', interval='1d')
close = df['Close']

# Current bad RSI
delta = close.diff()
gain = delta.clip(lower=0).rolling(14).mean()
loss = -delta.clip(upper=0).rolling(14).mean()
rs = gain / (loss + 1e-10)
rsi_bad = float((100 - (100 / (1 + rs))).iloc[-2])

# Standard RSI (Wilder's)
gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
loss = -delta.clip(upper=0).ewm(alpha=1/14, adjust=False).mean()
rs = gain / (loss + 1e-10)
rsi_good = float((100 - (100 / (1 + rs))).iloc[-2])

print(f"RSI Bad: {rsi_bad}")
print(f"RSI Good: {rsi_good}")
