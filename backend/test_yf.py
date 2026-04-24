import yfinance as yf
ticker = "RELIANCE.NS"
df = yf.download(ticker, period="6mo", interval="1d", progress=False, auto_adjust=True)
print(df.head())
print(df.empty)
