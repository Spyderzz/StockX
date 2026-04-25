import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import NSE_STOCKS from '../config/nse_stocks.json'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// ─── Mock preloaded data (quality score: lower risk = higher display score) ───
const MOCK_FII_DII = [
  { date: '25-Apr-2026', fii_net:  2341.8, dii_net:  1204.5 },
  { date: '24-Apr-2026', fii_net: -1876.3, dii_net:  2987.1 },
  { date: '23-Apr-2026', fii_net:  3102.4, dii_net: -543.2  },
  { date: '22-Apr-2026', fii_net: -892.7,  dii_net:  1765.8 },
  { date: '17-Apr-2026', fii_net:  1543.2, dii_net:  876.3  },
]

const MOCK_DATA = {
  SUZLON: {
    score: 24, verdict: 'High Risk Entry', emoji: '🔴', color: 'danger',
    queryLabel: 'SUZLON', full_name: 'Suzlon Energy Limited', price: 45.2, changePercent: -3.42,
    explain: "Volume anomaly detected. Price diverging from institutional sentiment. High probability of a distribution trap. Proceed with extreme caution.",
    dims: [
      { name: 'Signal Int.', score: 42, color: 'warn', reason: 'RSI extended above 70, price below EMA 200. MACD histogram turning negative — momentum fading.' },
      { name: 'Risk Sim.', score: 33, color: 'danger', reason: '67% of 10,000 simulations hit stop-loss before target. Daily volatility at 3.2% makes position sizing critical.' },
      { name: 'Manipulation', score: 22, color: 'danger', reason: 'Volume 4.1× 30-day average with anomalous delivery ratio. Isolation Forest flags coordinated accumulation pattern.' },
      { name: 'Sentiment', score: 55, color: 'warn', reason: 'Social media sentiment bullish at 71/100 but technicals score 42/100 — a 29-point divergence suggesting hype outpacing reality.' },
      { name: 'Behavioural', score: 30, color: 'danger', reason: 'Stock up 14% today — late entry flag triggered. RSI at 74 near 52-week high — classic FOMO entry zone.' },
    ],
    news: [
      { title: 'Suzlon Energy hits 52-week high amid renewable sector frenzy — analysts warn of overvaluation', source: 'Economic Times', publishedAt: '2026-04-25T08:30:00Z', url: '#' },
      { title: 'Heavy retail inflows in Suzlon raising manipulation concerns, says market analyst', source: 'Mint', publishedAt: '2026-04-24T14:20:00Z', url: '#' },
      { title: 'Suzlon Energy Q4 results disappoint; volume-price divergence flagged by institutions', source: 'Business Standard', publishedAt: '2026-04-23T11:00:00Z', url: '#' },
    ],
    fiiDii: MOCK_FII_DII,
  },
  RELIANCE: {
    score: 71, verdict: 'Quality Setup', emoji: '🟢', color: 'emerald',
    queryLabel: 'RELIANCE', full_name: 'Reliance Industries Limited', price: 2847.5, changePercent: 1.24,
    explain: "Strong institutional-grade setup. 73% probability of positive outcome over 10 sessions. No manipulation flags. Sentiment aligns with fundamentals.",
    dims: [
      { name: 'Signal Int.', score: 74, color: 'emerald', reason: 'Price above EMA 20, 50 and 200. RSI at 58 — healthy momentum without overbought conditions.' },
      { name: 'Risk Sim.', score: 68, color: 'warn', reason: '73% target probability over 15 sessions. Kelly Criterion suggests up to 35% capital allocation at current volatility.' },
      { name: 'Manipulation', score: 88, color: 'emerald', reason: 'Volume 1.2× average — organic activity confirmed. No anomalous delivery or price-volume divergence detected.' },
      { name: 'Sentiment', score: 72, color: 'emerald', reason: 'Sentiment at 68/100 closely matches technicals at 74/100. Narrative and data are aligned — low divergence risk.' },
      { name: 'Behavioural', score: 65, color: 'warn', reason: 'No FOMO flags. Price change +1.2% today within normal range. Entry is not chasing an extended move.' },
    ],
    news: [
      { title: 'Reliance Industries secures ₹42,000 Cr green energy deal — stock surges 1.2%', source: 'Economic Times', publishedAt: '2026-04-25T09:15:00Z', url: '#' },
      { title: 'Mukesh Ambani signals JioCinema global expansion; analysts revise target to ₹3,200', source: 'Mint', publishedAt: '2026-04-24T16:30:00Z', url: '#' },
      { title: 'FIIs increase stake in Reliance for 4th consecutive quarter — strong institutional confidence', source: 'Moneycontrol', publishedAt: '2026-04-23T12:00:00Z', url: '#' },
    ],
    fiiDii: MOCK_FII_DII,
  },
  TATASTEEL: {
    score: 58, verdict: 'Neutral · Wait for Confirmation', emoji: '🟡', color: 'warn',
    queryLabel: 'TATASTEEL', full_name: 'Tata Steel Limited', price: 136.8, changePercent: 0.87,
    explain: "Mixed signals. Technical setup forming but not confirmed. Risk simulation is balanced at current levels. Wait for breakout above resistance.",
    dims: [
      { name: 'Signal Int.', score: 62, color: 'warn', reason: 'Price above EMA 50 but below EMA 200. MACD positive but weak. Setup forming — not yet confirmed.' },
      { name: 'Risk Sim.', score: 51, color: 'warn', reason: '51% target probability — effectively a coin flip at current levels. Asymmetry not yet in favour of entry.' },
      { name: 'Manipulation', score: 79, color: 'emerald', reason: 'Volume 1.5× average — slightly elevated but within bounds. No anomaly detected by Isolation Forest.' },
      { name: 'Sentiment', score: 48, color: 'warn', reason: '28-point divergence between sentiment and technical scores. Market narrative slightly ahead of price action.' },
      { name: 'Behavioural', score: 55, color: 'warn', reason: 'RSI at 61 — neutral territory. No late-entry or FOMO flags, but no strong conviction signal either.' },
    ],
    news: [
      { title: 'Tata Steel Europe restructuring weighs on near-term outlook, Q4 margins under pressure', source: 'Business Standard', publishedAt: '2026-04-25T07:45:00Z', url: '#' },
      { title: 'Global steel prices stabilising — Tata Steel positioned for H2 recovery, say analysts', source: 'Reuters India', publishedAt: '2026-04-24T13:00:00Z', url: '#' },
    ],
    fiiDii: MOCK_FII_DII,
  },
  HDFCBANK: {
    score: 82, verdict: 'Strong Setup', emoji: '🟢', color: 'emerald',
    queryLabel: 'HDFCBANK', full_name: 'HDFC Bank Limited', price: 1623.4, changePercent: -0.34,
    explain: "High-quality decision setup. Strong trend structure with volume backing. 81% probability of positive outcome. No manipulation, no FOMO — clean entry signal.",
    dims: [
      { name: 'Signal Int.', score: 85, color: 'emerald', reason: 'Price above all three EMAs (20/50/200). RSI at 55, MACD bullish crossover. Volume confirms the move.' },
      { name: 'Risk Sim.', score: 81, color: 'emerald', reason: '81% target probability in 10,000 simulations. Low daily volatility (1.4%) enables tight stop placement.' },
      { name: 'Manipulation', score: 93, color: 'emerald', reason: 'Volume perfectly in line with 30-day average. Delivery ratio healthy. Zero anomaly score from Isolation Forest.' },
      { name: 'Sentiment', score: 79, color: 'emerald', reason: 'Sentiment 76/100 vs technicals 85/100 — well aligned. Institutional and retail narratives consistent.' },
      { name: 'Behavioural', score: 76, color: 'emerald', reason: 'RSI below overbought zone. Price -0.3% today — consolidation, not a chase. Clean measured entry.' },
    ],
    news: [
      { title: 'HDFC Bank reports 18.5% YoY PAT growth in Q4FY26 — asset quality improves significantly', source: 'Economic Times', publishedAt: '2026-04-25T10:00:00Z', url: '#' },
      { title: 'Foreign investors add ₹8,200 Cr to HDFC Bank — highest single-quarter inflow in 3 years', source: 'Mint', publishedAt: '2026-04-24T15:45:00Z', url: '#' },
      { title: 'HDFC Bank digital lending growth at 34% QoQ — analysts set new target at ₹1,900', source: 'Moneycontrol', publishedAt: '2026-04-23T09:30:00Z', url: '#' },
    ],
    fiiDii: MOCK_FII_DII,
  },
  INFY: {
    score: 67, verdict: 'Acceptable · Mild Caution', emoji: '🟡', color: 'warn',
    queryLabel: 'INFY', full_name: 'Infosys Limited', price: 1481.3, changePercent: 2.11,
    explain: "Decent setup with mild caution. Technical structure positive but momentum is fading. Slight overhype in recent tech news cycle. Acceptable entry with defined stop.",
    dims: [
      { name: 'Signal Int.', score: 70, color: 'emerald', reason: 'Price above EMA 50 and 200. RSI at 63 — positive but nearing overbought. MACD histogram shrinking.' },
      { name: 'Risk Sim.', score: 64, color: 'warn', reason: '64% target probability with moderate volatility. Position sizing should be conservative at this risk level.' },
      { name: 'Manipulation', score: 85, color: 'emerald', reason: 'Normal volume and delivery pattern. No coordinated activity detected. Organic price action confirmed.' },
      { name: 'Sentiment', score: 58, color: 'warn', reason: 'Tech sector media coverage bullish (sentiment 72/100) slightly ahead of price action (70/100). Minor gap.' },
      { name: 'Behavioural', score: 62, color: 'warn', reason: 'No FOMO entry. RSI not overbought. However, momentum is decelerating — set a defined stop before entering.' },
    ],
    news: [
      { title: 'Infosys bags $2.1B AI transformation deal from Fortune 500 client — shares jump 2%', source: 'Economic Times', publishedAt: '2026-04-25T08:00:00Z', url: '#' },
      { title: 'Infosys Q4 revenue guidance raised to 6-8% for FY27; generative AI deals accelerate', source: 'Mint', publishedAt: '2026-04-24T17:00:00Z', url: '#' },
      { title: 'IT sector outlook mixed — INFY fundamentally strong but near-term demand headwinds persist', source: 'NDTV Profit', publishedAt: '2026-04-23T10:30:00Z', url: '#' },
    ],
    fiiDii: MOCK_FII_DII,
  },
}

// ─── Color config ───
const COLOR_MAP = {
  emerald: { text: 'text-emerald', bgStyle: 'rgba(16,185,129,0.1)', borderStyle: 'rgba(16,185,129,0.25)', hex: '#10B981', barGrad: 'linear-gradient(90deg, #F59E0B, #10B981)' },
  warn: { text: 'text-warn', bgStyle: 'rgba(245,158,11,0.1)', borderStyle: 'rgba(245,158,11,0.25)', hex: '#F59E0B', barGrad: 'linear-gradient(90deg, #EF4444, #F59E0B)' },
  danger: { text: 'text-danger', bgStyle: 'rgba(239,68,68,0.1)', borderStyle: 'rgba(239,68,68,0.25)', hex: '#EF4444', barGrad: 'linear-gradient(90deg, #EF4444, #F59E0B)' },
}

function getColorForQualityScore(score) {
  if (score >= 70) return 'emerald'
  if (score >= 45) return 'warn'
  return 'danger'
}

// Transform API response (risk score) into landing page display format (quality score)
function transformApiResult(data) {
  const riskScore = data.final_score
  const qualityScore = Math.round(100 - riskScore)

  let color = 'danger'
  let emoji = '🔴'
  if (riskScore <= 30) { color = 'emerald'; emoji = '🟢' }
  else if (riskScore <= 55) { color = 'warn'; emoji = '🟡' }
  else if (riskScore <= 75) { color = 'warn'; emoji = '🟡' }

  const dims = [
    { name: 'Signal Intel', score: Math.round(data.signal_intel.score), color: getColorForQualityScore(data.signal_intel.score), reason: data.signal_intel?.finding ?? '', setup_label: data.signal_intel?.setup_label, setup_color: data.signal_intel?.setup_color, model: data.signal_intel?.model, type: 'xgb' },
    { name: 'Risk Simulation', score: Math.round(data.monte_carlo?.target_prob ?? 50), color: getColorForQualityScore(data.monte_carlo?.target_prob ?? 50), reason: data.monte_carlo?.finding ?? '', target_prob: data.monte_carlo?.target_prob, sl_prob: data.monte_carlo?.sl_prob, model: data.monte_carlo?.model, type: 'mc' },
    { name: 'Pump & Dump', score: Math.round(100 - (data.pump_dump?.score ?? 50)), color: getColorForQualityScore(100 - (data.pump_dump?.score ?? 50)), reason: data.pump_dump?.finding ?? '', anomaly_label: data.pump_dump?.anomaly_label, anomaly_color: data.pump_dump?.anomaly_color, is_anomaly: data.pump_dump?.is_anomaly, model: data.pump_dump?.model, type: 'iso' },
    { name: 'Market Sentiment', score: Math.round(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), color: getColorForQualityScore(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), reason: data.sentiment_gap?.finding ?? '', sentiment_score: data.sentiment_gap?.sentiment_score, divergence: data.sentiment_gap?.divergence, model: data.sentiment_gap?.model, type: 'sentiment' },
    { name: 'Behavioural', score: Math.round(100 - (data.behaviour?.score ?? 20)), color: getColorForQualityScore(100 - (data.behaviour?.score ?? 20)), reason: data.behaviour?.finding ?? '', risk_label: data.behaviour?.risk_label, risk_color: data.behaviour?.risk_color, model: data.behaviour?.model, type: 'behaviour' },
  ]

  return {
    score: qualityScore,
    verdict: data.verdict,
    emoji,
    color,
    queryLabel: data.symbol,
    fullName: data.full_name,
    explain: [data.one_liner, data.explanation].filter(Boolean).join(' — '),
    dims,
    regime: data.regime ?? null,
    price: data.tech_snapshot?.current_price ?? null,
    changePercent: data.tech_snapshot?.today_change_pct ?? null,
    tech: data.tech_snapshot ?? {},
    stockHoldings: data.stock_holdings ?? { institutions_pct: 0, promoters_pct: 0, public_pct: 0 },
    news: data.news ?? [],
    fiiDii: (data.fii_dii && data.fii_dii.length > 0) ? data.fii_dii : MOCK_FII_DII,
    isLive: true,
  }
}

// ─── Verdict Icon SVGs ───
const AlertIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
  </svg>
)
const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

// ─── FAQ data ───
const FAQS = [
  { q: "Is StockX giving me investment advice?", a: "No. StockX is a Decision Quality Engine — it evaluates the quality of a trade decision you've already formed, not whether you should trade a specific stock. This is a legally and operationally distinct service from SEBI-regulated investment advice. We never recommend a buy or sell action." },
  { q: "Do I need to connect my broker or demat account?", a: "Absolutely not. StockX runs entirely on publicly available market data. No broker API, no demat account access, no personal financial information is ever required or collected. You just enter a stock ticker." },
  { q: "How accurate is the Decision Quality Score?", a: "The score reflects the statistical quality of a trade setup across five independent dimensions — signal, risk, manipulation, sentiment, and behavioural. It is not a price prediction. A low score does not guarantee a loss, and a high score does not guarantee a gain. It tells you whether your entry decision is based on sound signal quality, not market manipulation or FOMO." },
  { q: "Which stocks are supported?", a: "StockX currently supports NSE-listed equities. The demo includes SUZLON, RELIANCE, TATASTEEL, HDFCBANK, and INFY as preloaded examples. The full product will support search across all NSE-listed securities." },
  { q: "What does the free trial include?", a: "Your first 5 research queries are completely free — no card required, no signup hurdle. This gives you enough runway to validate five real trade ideas with the full StockX engine before deciding whether to continue." },
]

// ─── FadeUp hook ───
function useFadeUp(ref) {
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    ref.current.querySelectorAll('.fade-up').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [ref])
}

// ─── Score counter animation ───
function useCountUp(target, trigger) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let start = 0
    const step = target / 20
    const iv = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(iv) }
      else setVal(Math.round(start))
    }, 25)
    return () => clearInterval(iv)
  }, [target, trigger])
  return val
}

// ─── ML Layer Card ───
const LABEL_COLORS = {
  green:  { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: 'text-emerald' },
  yellow: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: 'text-warn'   },
  red:    { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: 'text-danger'  },
}

const TYPE_TO_MODEL = {
  'xgb': 'MACHINE LEARNING',
  'mc': 'STATISTICAL',
  'iso': 'ANOMALY ENGINE',
  'sentiment': 'NLP MODEL',
  'behaviour': 'CATBOOST MODEL'
}

function MLCard({ dim }) {
  const c = COLOR_MAP[dim.color]
  const type = dim.type
  const engineLabel = TYPE_TO_MODEL[type] || 'ENGINE'

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] overflow-hidden flex flex-col h-full hover:bg-white/[0.03] transition-colors duration-300">
      <div className="px-3 py-2.5 border-b border-line/40 flex flex-col gap-0.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-soft/80 truncate">{dim.name}</span>
        <span className="font-mono text-[7px] text-muted/40 uppercase tracking-widest truncate">{engineLabel}</span>
      </div>
      
      <div className="p-3 flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1">
            <span className={`text-[28px] font-bold tracking-tight leading-none ${c.text}`}>{dim.score}</span>
            <span className="font-mono text-[9px] text-muted">/100</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${dim.score}%`, background: c.hex }} />
          </div>
        </div>
        
        <div className="mt-1">
          {type === 'xgb' && dim.setup_label && (() => {
            const lc = LABEL_COLORS[dim.setup_color] || LABEL_COLORS.yellow
            return (
              <div className="rounded-lg px-2.5 py-2 flex items-center justify-center border" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_6px_rgba(currentColor,0.5)]" style={{ background: lc.border }} />
                  <span className={`font-mono text-[9.5px] font-bold tracking-wider uppercase text-center ${lc.text}`}>{dim.setup_label}</span>
                </div>
              </div>
            )
          })()}

          {type === 'mc' && dim.target_prob != null && (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg py-2 bg-emerald/10 border border-emerald/20 flex flex-col items-center justify-center text-center">
                  <span className="font-semibold text-emerald text-[16px] leading-none">{dim.target_prob?.toFixed(0)}%</span>
                  <span className="font-mono text-[7px] text-emerald/70 mt-1 uppercase tracking-wider">Target</span>
                </div>
                <div className="rounded-lg py-2 bg-danger/10 border border-danger/20 flex flex-col items-center justify-center text-center">
                  <span className="font-semibold text-danger text-[16px] leading-none">{dim.sl_prob?.toFixed(0)}%</span>
                  <span className="font-mono text-[7px] text-danger/70 mt-1 uppercase tracking-wider">Stop Loss</span>
                </div>
              </div>
            </div>
          )}

          {type === 'iso' && dim.anomaly_label && (() => {
            const lc = LABEL_COLORS[dim.anomaly_color] || LABEL_COLORS.yellow
            return (
              <div className="rounded-lg px-2.5 py-2 flex items-center justify-center border" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-1.5">
                  <svg className={`w-3.5 h-3.5 ${lc.text}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  <span className={`font-mono text-[9.5px] font-bold tracking-wider uppercase ${lc.text}`}>{dim.anomaly_label}</span>
                </div>
              </div>
            )
          })()}

          {type === 'sentiment' && dim.sentiment_score != null && (
            <div className="rounded-lg p-2.5 bg-white/[0.03] border border-white/5 flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted mb-0.5">Sentiment</span>
                  <span className="font-semibold text-[16px] text-white leading-none">{dim.sentiment_score?.toFixed(0)}</span>
                </div>
                {dim.divergence != null && (
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-muted mb-0.5">Gap</span>
                    <span className="font-mono text-[10px] text-warn font-medium">{dim.divergence?.toFixed(0)}</span>
                  </div>
                )}
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden w-full">
                <div className="h-full rounded-full bg-gradient-to-r from-danger via-warn to-emerald" style={{ width: `${dim.sentiment_score}%` }} />
              </div>
            </div>
          )}

          {type === 'behaviour' && dim.risk_label && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase tracking-widest border ${
                dim.risk_color === 'red' ? 'bg-danger/15 border-danger/30 text-danger' :
                dim.risk_color === 'yellow' ? 'bg-warn/15 border-warn/30 text-warn' :
                'bg-emerald/15 border-emerald/30 text-emerald'
              }`}>{dim.risk_label}</span>
            </div>
          )}
        </div>

        {dim.reason && (
          <div className="mt-auto pt-3 border-t border-line/40">
            <p className="text-[9.5px] text-muted/70 leading-relaxed font-sans line-clamp-4">{dim.reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TechStatsStrip({ tech }) {
  if (!tech || !tech.rsi) return null

  const rsiColor = tech.rsi > 70 ? 'text-danger' : tech.rsi < 30 ? 'text-emerald' : 'text-warn'
  const rsiLabel = tech.rsi > 70 ? 'Overbought' : tech.rsi < 30 ? 'Oversold' : 'Neutral'
  const macdColor = tech.macd_hist > 0 ? 'text-emerald' : 'text-danger'
  const macdLabel = tech.macd_hist > 0 ? 'Bullish' : 'Bearish'
  const priceVsEma200 = tech.current_price > tech.ema200 ? 'text-emerald' : 'text-danger'
  const priceVsEma50  = tech.current_price > tech.ema50  ? 'text-emerald' : 'text-danger'
  const priceVsEma20  = tech.current_price > tech.ema20  ? 'text-emerald' : 'text-danger'
  const w52Pct = tech.w52_high && tech.w52_low ? Math.round(((tech.current_price - tech.w52_low) / (tech.w52_high - tech.w52_low + 0.01)) * 100) : 50

  const StatBox = ({ label, value, sub, valueClass = 'text-soft' }) => (
    <div className="flex flex-col gap-1 px-4 py-3 border-r border-line/40 last:border-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className={`font-semibold text-[15px] tracking-tight ${valueClass}`}>{value}</span>
      {sub && <span className="font-mono text-[10px] text-muted/70">{sub}</span>}
    </div>
  )

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">Technical Indicators · Live Data</span>
        </div>
        <span className="font-mono text-[10px] text-muted">1D · NSE</span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-line/40">
        <StatBox label="RSI (14)" value={tech.rsi?.toFixed(1)} sub={rsiLabel} valueClass={rsiColor} />
        <StatBox label="MACD" value={tech.macd?.toFixed(2)} sub={`Signal ${tech.macd_signal?.toFixed(2)}`} valueClass={macdColor} />
        <StatBox label="MACD Hist" value={tech.macd_hist?.toFixed(2)} sub={macdLabel} valueClass={macdColor} />
        <StatBox label="Volume Ratio" value={`${tech.vol_ratio?.toFixed(2)}x`} sub={`Avg ${tech.vol_30d_avg ? (tech.vol_30d_avg/1e5).toFixed(1)+'L' : '—'}`} valueClass={tech.vol_ratio > 2 ? 'text-warn' : 'text-soft'} />
        <StatBox label="ATR (14)" value={`₹${tech.atr?.toFixed(1)}`} sub={`${tech.atr_pct?.toFixed(2)}% daily`} />
        <StatBox label="India VIX" value={tech.vix?.toFixed(2) ?? '—'} sub={tech.vix_spike ? '⚡ Spike' : tech.vix_change != null ? `${tech.vix_change >= 0 ? '+' : ''}${tech.vix_change?.toFixed(2)} chg` : ''} valueClass={tech.vix > 20 ? 'text-danger' : tech.vix > 15 ? 'text-warn' : 'text-emerald'} />
      </div>

      <div className="border-t border-line/40">
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-line/40">
          <StatBox label="EMA 20" value={`₹${tech.ema20?.toFixed(1)}`} sub={tech.current_price > tech.ema20 ? '↑ Price above' : '↓ Price below'} valueClass={priceVsEma20} />
          <StatBox label="EMA 50" value={`₹${tech.ema50?.toFixed(1)}`} sub={tech.current_price > tech.ema50 ? '↑ Price above' : '↓ Price below'} valueClass={priceVsEma50} />
          <StatBox label="EMA 200" value={`₹${tech.ema200?.toFixed(1)}`} sub={tech.current_price > tech.ema200 ? '↑ Price above' : '↓ Price below'} valueClass={priceVsEma200} />
          <StatBox label="BB Upper" value={`₹${tech.bb_upper?.toFixed(1)}`} sub="Resistance" />
          <StatBox label="BB Lower" value={`₹${tech.bb_lower?.toFixed(1)}`} sub="Support" />
          <StatBox label="Momentum" value={`${tech.mom5 >= 0 ? '+' : ''}${tech.mom5?.toFixed(1)}%`} sub={`20d: ${tech.mom20 >= 0 ? '+' : ''}${tech.mom20?.toFixed(1)}%`} valueClass={tech.mom5 >= 0 ? 'text-emerald' : 'text-danger'} />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-line/40">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted whitespace-nowrap">52-Week Range</span>
          <span className="font-mono text-[11px] text-danger">₹{tech.w52_low?.toFixed(1)}</span>
          <div className="flex-1 relative h-1.5 bg-line rounded-full overflow-hidden">
            <div className="absolute h-full bg-gradient-to-r from-danger via-warn to-emerald rounded-full w-full opacity-30" />
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-emerald shadow" style={{ left: `calc(${w52Pct}% - 6px)` }} />
          </div>
          <span className="font-mono text-[11px] text-emerald">₹{tech.w52_high?.toFixed(1)}</span>
          <span className="font-mono text-[10px] text-muted">{w52Pct}% of range</span>
        </div>
      </div>
    </div>
  )
}


// ─── Helpers ───
function formatPrice(p) {
  if (p == null) return '—'
  return '₹' + Number(p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function timeAgo(iso) {
  if (!iso) return ''
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return `${Math.round(diff / 86400)}d ago`
  } catch { return '' }
}

// ─── News Card ───
function NewsCard({ news }) {
  if (!news || news.length === 0) return null
  return (
    <div className="glass rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h6"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">Recent News</span>
        </div>
        <span className="font-mono text-[10px] text-muted">{news.length} articles</span>
      </div>
      <div className="divide-y divide-line/50 flex-1 overflow-y-auto">
        {news.map((article, i) => (
          <a
            key={i}
            href={article.url !== '#' ? article.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.03] transition group"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-md bg-white/5 border border-line flex items-center justify-center mt-0.5">
              <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] leading-snug mb-1.5 group-hover:text-soft transition line-clamp-2">{article.title}</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-emerald truncate">{article.source}</span>
                <span className="font-mono text-[10px] text-muted flex-shrink-0">{timeAgo(article.publishedAt)}</span>
              </div>
            </div>
            {article.url && article.url !== '#' && (
              <svg className="w-3.5 h-3.5 text-muted flex-shrink-0 mt-1 group-hover:text-soft transition" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── FII/DII Card ───
function FiiDiiCard({ fiiDii }) {
  if (!fiiDii || fiiDii.length === 0) return null

  const fiiTotal = fiiDii.reduce((s, r) => s + (r.fii_net ?? 0), 0)
  const diiTotal = fiiDii.reduce((s, r) => s + (r.dii_net ?? 0), 0)

  const fmt = (n) => {
    const abs = Math.abs(n)
    const str = abs >= 1000 ? `₹${(abs / 1000).toFixed(1)}K Cr` : `₹${abs.toFixed(0)} Cr`
    return n >= 0 ? `+${str}` : `−${str}`
  }

  const barMax = Math.max(...fiiDii.flatMap(r => [Math.abs(r.fii_net ?? 0), Math.abs(r.dii_net ?? 0)]), 1)

  return (
    <div className="glass rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">FII / DII Activity · Market Context</span>
        </div>
        <span className="font-mono text-[10px] text-muted">Last {fiiDii.length} sessions</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 divide-x divide-line/50 border-b border-line/50">
        {[
          { label: 'FII Net (5d)', val: fiiTotal, tag: 'Foreign Institutional' },
          { label: 'DII Net (5d)', val: diiTotal, tag: 'Domestic Institutional' },
        ].map(({ label, val, tag }) => (
          <div key={label} className="px-5 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1">{label}</div>
            <div className={`text-[22px] font-semibold tracking-tight mb-0.5 ${val >= 0 ? 'text-emerald' : 'text-danger'}`}>
              {fmt(val)}
            </div>
            <div className="font-mono text-[10px] text-muted">{tag}</div>
          </div>
        ))}
      </div>

      {/* Per-day bars */}
      <div className="px-5 py-4 space-y-3">
        {fiiDii.map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted w-24 flex-shrink-0">{row.date}</span>
            <div className="flex-1 grid grid-cols-2 gap-2">
              {[
                { val: row.fii_net ?? 0, label: 'FII' },
                { val: row.dii_net ?? 0, label: 'DII' },
              ].map(({ val, label }) => {
                const pct = Math.round((Math.abs(val) / barMax) * 100)
                const isPos = val >= 0
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-muted w-6">{label}</span>
                    <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: isPos ? '#10B981' : '#EF4444' }}
                      />
                    </div>
                    <span className={`font-mono text-[10px] w-16 text-right ${isPos ? 'text-emerald' : 'text-danger'}`}>
                      {fmt(val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-3">
        <p className="font-mono text-[10px] text-muted/60">
          Market-wide institutional flows · Source: NSE India · Not stock-specific
        </p>
      </div>
    </div>
  )
}

// ─── Result Card ───
function ResultCard({ result, loading }) {
  const c = COLOR_MAP[result.color]
  const displayedScore = useCountUp(result.score, !loading)
  const isGood = result.color === 'emerald'
  const icon = isGood
    ? <CheckIcon className={`w-6 h-6 ${c.text}`} />
    : <AlertIcon className={`w-6 h-6 ${c.text}`} />

  return (
    <div id="result-card" className="glass rounded-2xl overflow-hidden">
      {/* Terminal bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald/70" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted ml-3">stockx.engine › terminal</span>
        </div>
        <div className="flex items-center gap-2">
          {loading
            ? <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Analysing…</span>
            : <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">{result.isLive ? 'Live · API' : 'Demo'}</span>
            </>
          }
        </div>
      </div>

      <div className="p-6 md:p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent spinner" />
            <p className="font-mono text-[12px] uppercase tracking-widest text-muted">Analysing stock…</p>
          </div>
        ) : (
          <>
            {/* Query */}
            <div className="flex items-start gap-3 mb-5">
              <span className="font-mono text-[11px] mt-1 text-muted select-none">Query ›</span>
              <p className="text-soft text-[15px] leading-relaxed">
                What's the risk profile for <span className="text-white font-medium">{result.queryLabel}</span> right now?
              </p>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-line to-transparent mb-6" />

            {/* Verdict row */}
            <div className="flex items-start md:items-center justify-between gap-6 flex-col md:flex-row mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: c.bgStyle, border: `1px solid ${c.borderStyle}` }}>
                  {icon}
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">StockX Verdict</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{result.emoji}</span>
                    <span className="text-[18px] md:text-[20px] font-semibold text-white">{result.verdict}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-medium text-white/90 mb-1.5 uppercase tracking-wide">{result.fullName || result.queryLabel}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">Quality Score</div>
                <div className="flex items-baseline gap-1 justify-end">
                  <span className={`text-[44px] font-semibold tracking-[-0.04em] leading-none ${c.text}`}>{displayedScore}</span>
                  <span className="text-muted font-mono text-sm">/100</span>
                </div>
              </div>
            </div>

            {/* Price + change chip */}
            {result.price != null && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-baseline gap-1.5 px-4 py-2 rounded-xl border border-line bg-white/[0.03]">
                  <span className="text-white font-semibold text-[20px] tracking-tight">{formatPrice(result.price)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">NSE</span>
                </div>
                {result.changePercent != null && (
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-semibold font-mono ${result.changePercent >= 0 ? 'border-emerald/30 bg-emerald/10 text-emerald' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={result.changePercent >= 0 ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                    {result.changePercent >= 0 ? '+' : ''}{result.changePercent.toFixed(2)}% today
                  </div>
                )}
                {result.regime != null && (
                  <div className={`px-3 py-2 rounded-xl border font-mono text-[11px] font-bold uppercase tracking-widest ${
                    result.regime === 0 ? 'border-emerald/30 bg-emerald/10 text-emerald' :
                    result.regime === 1 ? 'border-danger/30 bg-danger/10 text-danger' :
                    'border-warn/30 bg-warn/10 text-warn'
                  }`}>
                    {result.regime === 0 ? '↑ Bull Market' : result.regime === 1 ? '↓ Bear Market' : '→ Sideways'}
                  </div>
                )}
                <span className="font-mono text-[10px] text-muted/50 uppercase tracking-widest">Market price</span>
              </div>
            )}

            {/* Score bar */}
            <div className="relative h-1 rounded-full bg-line mb-6 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.score}%`, background: c.barGrad }} />
            </div>

            {/* Explanation */}
            <div className="rounded-xl border border-line bg-white/[0.015] p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-emerald/10 border border-emerald/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 11a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald mb-2">StockX Analysis</div>
                  <p className="text-soft text-[14px] leading-relaxed">{result.explain}</p>
                </div>
              </div>
            </div>

            {/* Dimensions — ML Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {result.dims.map(d => <MLCard key={d.name} dim={d} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── FAQ item ───
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="faq-item border-t border-line">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-6 py-5 text-left"
      >
        <span className="text-[15px] text-white font-medium">{q}</span>
        <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-lg transition-all flex-shrink-0 ${open ? 'bg-emerald text-ink border-emerald' : 'border-line text-muted'}`}>
          {open ? '−' : '+'}
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <p className="text-[14px] text-soft leading-relaxed pb-5">{a}</p>
      </div>
    </div>
  )
}

// ─── Main Component ───
export default function AnalysePage() {
  const { user, userProfile, authLoading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [user, authLoading, navigate])

  
  const [inputVal, setInputVal] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchInputRef = useRef(null)
  const resultCardRef = useRef(null)
  const pageRef = useRef(null)
  useFadeUp(pageRef)

  const handleAnalyseClick = () => {
    if (user) navigate('/analyse')
    else navigate('/login')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const displayName = userProfile?.name || user?.displayName || null
  const photoURL = user?.photoURL || null

  const scrollToResult = useCallback(() => {
    setTimeout(() => {
      resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [])

  const runAnalysis = useCallback(async (ticker) => {
    const sym = ticker.trim().toUpperCase()
    if (!sym) return

    // Show mock immediately if available for instant feedback
    if (MOCK_DATA[sym]) {
      setResult(MOCK_DATA[sym])
      setError('')
    } else {
      setResult(null)
    }
    scrollToResult()

    // Then call the real API
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/analyse`, { symbol: sym }, { timeout: 30000 })
      setResult(transformApiResult(res.data))
      scrollToResult()
    } catch (err) {
      if (MOCK_DATA[sym]) {
        // Keep mock result, just show soft note
      } else {
        const apiError = err.response?.data?.detail;
        setError(apiError || `Could not analyse "${sym}". Make sure you entered a valid NSE ticker.`);
        setResult(null);
      }
    } finally {
      setLoading(false)
    }
  }, [scrollToResult])

  const handleSearch = useCallback(async (e) => {
    e.preventDefault()
    const sym = inputVal.trim().toUpperCase()
    if (!sym) return
    await runAnalysis(sym)
  }, [inputVal, runAnalysis])

  const handleTicker = useCallback((t) => {
    setInputVal(t)
    runAnalysis(t)
  }, [runAnalysis])

  
  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200)
  }

  const scrollToSearch = (e) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => searchInputRef.current?.focus(), 400)
  }

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-x-hidden" style={{ background: '#050608', color: '#E5E7EB', fontFamily: "'Inter Tight', sans-serif" }}>
      <div className="noise-overlay" />

      {/* NAV */}
      
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5" style={{ background: 'rgba(5,6,8,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-tight text-white">StockX</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-soft">
              {userProfile?.display_name || user?.email}
            </span>
            <button 
              onClick={async () => { await signOut(); navigate('/login') }}
              className="text-[13px] text-soft hover:text-white transition px-3 py-1.5 rounded-full border border-line bg-white/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>


      {/* HERO */}
      <header className="relative pt-36 pb-28 px-6 lg:px-10">
        <div className="absolute inset-0 grid-bg" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-line bg-card/50 fade-up">
            <svg className="w-3 h-3 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-soft">AI Intelligence Layer · India's First Decision Quality Engine</span>
          </div>

          <h1 className="text-[44px] md:text-[68px] lg:text-[76px] font-semibold tracking-[-0.035em] leading-[1.02] text-white mb-6 fade-up">
            Decision Quality Engine<br />
            <span className="text-white">Active</span>
          </h1>

          <p className="max-w-2xl mx-auto text-[17px] md:text-[18px] text-soft leading-relaxed mb-12 fade-up">
            Enter any NSE stock ticker below to run a complete 5-layer ML analysis.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto fade-up">
            <div className="relative flex items-center glass rounded-2xl glow-emerald transition-all focus-within:ring-2 focus-within:ring-emerald/40">
              <svg className="w-5 h-5 text-muted ml-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={inputVal}
                onChange={e => { setInputVal(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={handleBlur}
                placeholder="Ask about any stock (e.g., RELIANCE, HDFC)..."
                autoComplete="off"
                maxLength={20}
                className="flex-1 bg-transparent text-white text-[16px] md:text-[17px] py-5 px-4 placeholder:text-muted font-mono"
              />
              <button
                type="submit"
                disabled={loading || !inputVal.trim()}
                className="mr-2 w-11 h-11 rounded-xl bg-emerald text-ink flex items-center justify-center hover:bg-emerald/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <div className="w-4 h-4 rounded-full border-2 border-ink border-t-transparent spinner" />
                  : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" /></svg>
                }
              </button>
            </div>
            {showSuggestions && inputVal && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1117] border border-line rounded-xl overflow-hidden z-50 shadow-2xl">
                {NSE_STOCKS.filter(s => s.startsWith(inputVal) && s !== inputVal).slice(0, 5).map(s => (
                  <div
                    key={s}
                    onClick={() => { setInputVal(s); setShowSuggestions(false); handleTicker(s); }}
                    className="px-5 py-3 hover:bg-white/[0.03] cursor-pointer font-mono text-[14px] text-white border-b border-line/50 last:border-0 flex items-center gap-3"
                  >
                    <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {s}
                  </div>
                ))}
              </div>
            )}
    

            {/* Preloaded suggestions */}
            <div className="flex items-center justify-center flex-wrap gap-2 mt-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mr-2">Try:</span>
              {['SUZLON', 'RELIANCE', 'TATASTEEL', 'HDFCBANK', 'INFY'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTicker(t)}
                  className="px-3 py-1 rounded-md border border-line bg-card/60 hover:bg-card hover:border-line2 font-mono text-[11px] text-soft transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </form>

          {error && (
            <div className="mt-5 max-w-xl mx-auto p-3 rounded-xl bg-danger/10 border border-danger/25 text-danger font-mono text-[12px]">
              {error}
            </div>
          )}

          </div>
      </header>

      {/* RESULT CARD */}
      <section className="relative px-6 lg:px-10 -mt-8 mb-28">
        <div ref={resultCardRef} className="max-w-4xl mx-auto space-y-4">
          {result && <ResultCard result={result} loading={loading} />}
          {result && !loading && (
            <>
              <TechStatsStrip tech={result.tech} />
              
              <div className="grid md:grid-cols-2 gap-4">
                <FiiDiiCard fiiDii={result.fiiDii} />
                <NewsCard news={result.news} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* NSE TICKER */}
      <div className="relative border-y border-line overflow-hidden py-3 mb-28" style={{ background: 'rgba(5,6,8,0.6)' }}>
        <div className="ticker-track font-mono text-[11px] uppercase tracking-[0.08em]">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-8 pr-8">
              <span className="text-muted">NSE TICK</span>
              {[
                ['RELIANCE', '+1.24%', true], ['TATASTEEL', '+0.87%', true], ['HDFCBANK', '−0.34%', false],
                ['INFY', '+2.11%', true], ['SUZLON', '−3.42%', false], ['ITC', '+0.56%', true],
                ['TCS', '+1.05%', true], ['WIPRO', '−0.78%', false], ['ADANIENT', '+4.12%', true],
                ['SBIN', '+0.44%', true], ['BAJFINANCE', '−1.22%', false], ['HINDUNILVR', '+0.31%', true],
              ].map(([sym, chg, up]) => (
                <span key={sym} className="text-soft">{sym} <span className={up ? 'text-emerald' : 'text-danger'}>{chg}</span></span>
              ))}
              <span className="text-muted">STOCKX ENGINE · LIVE</span>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="px-6 lg:px-10 pt-20 pb-10 border-t border-line" style={{ background: '#050608' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10 pb-10 border-b border-line">
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[20px] font-semibold tracking-tight text-white">StockX</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
              </div>
              <p className="text-[13px] text-soft leading-relaxed max-w-xs">India's first AI-powered Decision Quality Engine for retail traders. Built to audit decisions, not make them.</p>
            </div>
            <div>
              <h5 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-4">Company</h5>
              <ul className="space-y-2.5 text-[13.5px]">
                <li><a href="#" className="text-soft hover:text-white transition">About Stoxify</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">SEBI RA Network</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">RIDE, JIIT Noida</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-4">Legal</h5>
              <ul className="space-y-2.5 text-[13.5px]">
                <li><a href="#" className="text-soft hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="text-soft hover:text-white transition">Disclaimer</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-8">
            <div>
              <p className="font-mono text-[11px] text-soft mb-1.5">Stoxify Private Limited (DIPP239975). Incubated at RIDE, JIIT Noida.</p>
              <p className="font-mono text-[10px] text-muted">© 2026 Stoxify Technologies Pvt. Ltd. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted px-2.5 py-1 border border-line rounded">DPIIT · DIPP239975</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted px-2.5 py-1 border border-line rounded">RIDE · JIIT Noida</span>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-line/60">
            <p className="text-[11px] text-muted leading-relaxed max-w-4xl">
              <span className="font-mono uppercase tracking-[0.1em] text-soft">Disclaimer:</span>{' '}
              StockX is a decision-support and risk-analysis tool, not an investment advisor. The Decision Quality Score does not constitute financial advice. Trading in securities markets is subject to market risks. Read all scheme related documents carefully before investing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
