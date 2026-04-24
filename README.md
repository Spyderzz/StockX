# StockX by Stoxify
### AI-Powered Decision Quality Engine for Indian Retail Traders

> "StockX doesn't tell you what to buy — it tells you whether your decision makes sense."

---

## What It Does

StockX analyses any NSE stock across **5 AI/ML layers** and produces a **Decision Quality Score (0-100)**:

| Layer | Model | What It Detects |
|-------|-------|-----------------|
| Signal Intelligence | XGBoost | Technical setup quality |
| Risk Simulation | Monte Carlo (10K runs) | Probability of profit vs loss |
| Pump & Dump | Isolation Forest | Market manipulation |
| Sentiment Gap | FinBERT NLP | News vs reality divergence |
| Behaviour Check | Rule-Based Engine | FOMO, late entry, chasing |

---

## Project Structure

```
stockx-app/
├── frontend/          ← React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ScoreGauge.jsx
│   │   │   ├── LayerCard.jsx
│   │   │   ├── MonteCarloChart.jsx
│   │   │   ├── LoadingScreen.jsx
│   │   │   └── WithoutWith.jsx
│   │   └── index.css
│   ├── package.json
│   └── vercel.json
│
└── backend/           ← Python FastAPI
    ├── main.py        ← All 5 ML layers + API endpoints
    ├── requirements.txt
    └── .env.example
```

---

## Local Development

### Backend (Python)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add your ANTHROPIC_API_KEY and NEWS_API_KEY to .env
uvicorn main:app --reload --port 8000
```
API runs at: http://localhost:8000
Docs at: http://localhost:8000/docs

### Frontend (React)
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=/api (proxied to backend via vite.config.js)
npm run dev
```
App runs at: http://localhost:5173

---

## Deployment (Live URL in 10 minutes)

### Step 1 — Deploy Backend on Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `backend/` folder
3. Add environment variables:
   ```
   ANTHROPIC_API_KEY=your_key_here
   NEWS_API_KEY=your_key_here
   ```
4. Railway auto-detects Procfile and deploys
5. Copy your Railway URL: `https://stockx-backend-xxxx.railway.app`

### Step 2 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select the `frontend/` folder
3. Add environment variable:
   ```
   VITE_API_URL=https://stockx-backend-xxxx.railway.app
   ```
4. Update `vercel.json` with your Railway URL
5. Deploy → Get your live URL instantly

---

## API Endpoints

```
POST /analyse          → Main analysis endpoint
GET  /health           → Health check
GET  /stocks/popular   → Popular NSE stocks list
```

### Example Request
```json
POST /analyse
{
  "symbol": "RELIANCE",
  "exchange": "NSE"
}
```

### Example Response
```json
{
  "symbol": "RELIANCE",
  "final_score": 22.4,
  "verdict": "STRONG SETUP",
  "verdict_color": "#10d98a",
  "one_liner": "Clean technical setup with aligned signals...",
  "explanation": "XGBoost Signal Intelligence scores this at 74/100...",
  "signal_intel": { "score": 74.1, "finding": "...", "model": "XGBoost" },
  "monte_carlo": { "target_prob": 64.2, "sl_prob": 35.8, ... },
  "pump_dump": { "score": 12.3, "finding": "...", "model": "Isolation Forest" },
  "sentiment_gap": { "divergence": 6.1, "finding": "...", "model": "FinBERT" },
  "behaviour": { "score": 18.0, "finding": "...", "model": "Rule-Based" }
}
```

---

## Environment Variables

### Backend (.env)
```
ANTHROPIC_API_KEY=sk-ant-...     # Required for AI explanations
NEWS_API_KEY=...                  # Optional — for real news sentiment
```

### Frontend (.env)
```
VITE_API_URL=https://your-backend.railway.app
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | Canvas API (Monte Carlo), custom gauge |
| Backend | Python, FastAPI |
| ML | scikit-learn, XGBoost, NumPy, pandas |
| NLP | yfinance, lexicon-based (FinBERT-ready) |
| AI Explanation | Anthropic Claude API |
| Data | Yahoo Finance (yfinance) |
| Deploy | Vercel (frontend) + Railway (backend) |

---

## SEBI Compliance

StockX is designed from the ground up to be SEBI-safe:
- ✓ No Buy/Hold/Sell recommendation (outputs Decision Quality Score only)
- ✓ No personal trade history required
- ✓ No broker account access needed
- ✓ All analysis uses public NSE market data
- ✓ Same compliance model as Zerodha's Nudge feature

---

## Built By

**Ritish Jaiswal** — Founder, Stoxify Private Limited  
DPIIT Recognised (DIPP239975) · Incubated at RIDE, JIIT Noida  
[stoxify.net](https://stoxify.net)

*Presented at Kraken'X — AI/ML × Aitronics Hackathon*
