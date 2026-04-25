import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

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
    { name: 'Signal Int.', score: Math.round(data.signal_intel.score), color: getColorForQualityScore(data.signal_intel.score), reason: data.signal_intel?.finding ?? '' },
    { name: 'Risk Sim.', score: Math.round(data.monte_carlo?.target_prob ?? 50), color: getColorForQualityScore(data.monte_carlo?.target_prob ?? 50), reason: data.monte_carlo?.finding ?? '' },
    { name: 'Manipulation', score: Math.round(100 - (data.pump_dump?.score ?? 50)), color: getColorForQualityScore(100 - (data.pump_dump?.score ?? 50)), reason: data.pump_dump?.finding ?? '' },
    { name: 'Sentiment', score: Math.round(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), color: getColorForQualityScore(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), reason: data.sentiment_gap?.finding ?? '' },
    { name: 'Behavioural', score: Math.round(100 - (data.behaviour?.score ?? 20)), color: getColorForQualityScore(100 - (data.behaviour?.score ?? 20)), reason: data.behaviour?.finding ?? '' },
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
    price: data.tech_snapshot?.current_price ?? null,
    changePercent: data.tech_snapshot?.today_change_pct ?? null,
    news: data.news ?? [],
    fiiDii: data.fii_dii ?? [],
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

// ─── Dimension mini card ───
function DimCard({ dim }) {
  const c = COLOR_MAP[dim.color]
  return (
    <div className="p-3 rounded-xl border border-line bg-white/[0.02] flex flex-col gap-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{dim.name}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-[20px] font-semibold tracking-[-0.03em] ${c.text}`}>{dim.score}</span>
        <span className="font-mono text-[10px] text-muted">/100</span>
      </div>
      <div className="h-1 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${dim.score}%`, background: c.hex }} />
      </div>
      {dim.reason && (
        <p className="text-[11px] text-muted leading-relaxed mt-0.5">{dim.reason}</p>
      )}
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
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h6"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">Recent News</span>
        </div>
        <span className="font-mono text-[10px] text-muted">{news.length} articles</span>
      </div>
      <div className="divide-y divide-line/50">
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
                <span className="font-mono text-[10px] text-emerald">{article.source}</span>
                <span className="font-mono text-[10px] text-muted">{timeAgo(article.publishedAt)}</span>
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
    <div className="glass rounded-2xl overflow-hidden">
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

            {/* Dimensions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {result.dims.map(d => <DimCard key={d.name} dim={d} />)}
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
export default function LandingPage() {
  const { user, userProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [inputVal, setInputVal] = useState('')
  const [result, setResult] = useState(MOCK_DATA.SUZLON)
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
    
    // If not logged in, force them to login before viewing results
    if (!user) {
      navigate('/login')
      return
    }

    // If logged in, send them straight to the Analysis engine with their ticker
    navigate(`/analyse?ticker=${sym}`)
  }, [navigate, user])

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

  const scrollToSearch = (e) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => searchInputRef.current?.focus(), 400)
  }

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-x-hidden" style={{ background: '#050608', color: '#E5E7EB', fontFamily: "'Inter Tight', sans-serif" }}>
      <div className="noise-overlay" />

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5" style={{ background: 'rgba(5,6,8,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-tight text-white">StockX</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
            </div>
          </a>
          <ul className="hidden md:flex items-center gap-8">
            <li><a href="#features" className="text-[13px] text-soft hover:text-white transition">Features</a></li>
            <li><a href="#methodology" className="text-[13px] text-soft hover:text-white transition">Methodology</a></li>
            <li><a href="#try-free" className="text-[13px] text-soft hover:text-white transition">Try Free</a></li>
          </ul>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={handleAnalyseClick}
                  className="hidden sm:inline-flex items-center gap-2 text-[13px] font-semibold text-ink bg-emerald px-4 py-1.5 rounded-lg hover:bg-emerald/90 transition"
                >
                  Analyse Now →
                </button>
                <div className="flex items-center gap-2 pl-3 border-l border-white/10">
                  {photoURL
                    ? <img src={photoURL} alt={displayName} className="w-7 h-7 rounded-full ring-1 ring-white/20" referrerPolicy="no-referrer" />
                    : <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-semibold text-white">{displayName?.[0]?.toUpperCase() ?? '?'}</div>
                  }
                  <span className="hidden md:block text-[13px] text-soft max-w-[100px] truncate">{displayName}</span>
                </div>
                <button onClick={handleSignOut} className="text-[12px] text-soft hover:text-white transition px-2 py-1 rounded hover:bg-white/5">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="hidden sm:inline text-[13px] text-soft hover:text-white transition">Log in →</a>
                <a
                  href="/login"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/25 hover:bg-emerald/20 transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald pulse-dot" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-emerald">Get Full Access</span>
                </a>
              </>
            )}
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
            The analyst that<br />
            <span className="text-white">never </span><span className="italic font-light text-emerald">sleeps.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-[17px] md:text-[18px] text-soft leading-relaxed mb-12 fade-up">
            Ask about any NSE stock. Get institutional-grade risk analysis, technical validation, and a Decision Quality Score in seconds. No Bloomberg terminal required.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto fade-up mb-12">
            <div className="relative flex items-center glass rounded-2xl glow-emerald transition-all focus-within:ring-2 focus-within:ring-emerald/40">
              <svg className="w-5 h-5 text-muted ml-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value.toUpperCase())}
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



          {/* Trust badges */}
          <div className="flex items-center justify-center flex-wrap gap-3 md:gap-4 mt-12 fade-up">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-line">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">Indian Market · Live Data</span>
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-line">
              <svg className="w-3 h-3 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">NSE APIs</span>
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-line">
              <svg className="w-3 h-3 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">DPIIT Recognised</span>
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-line">
              <svg className="w-3 h-3 text-soft" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">SEBI-Compliant Architecture</span>
            </span>
          </div>
          {/* Analyse Now CTA */}
          <div className="mt-10 fade-up">
            <button
              onClick={handleAnalyseClick}
              className="inline-flex items-center gap-3 px-7 py-3.5 rounded-2xl bg-emerald text-ink font-semibold text-[15px] hover:bg-emerald/90 hover:scale-[1.02] active:scale-[0.99] transition-all shadow-[0_0_32px_-8px_rgba(16,185,129,0.5)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {user ? 'Open Full Analysis Engine →' : 'Get Full Access — Sign In Free →'}
            </button>
            {!user && (
              <p className="text-[12px] text-muted mt-3">No card required · Google sign-in · Takes 30 seconds</p>
            )}
          </div>
        </div>
      </header>



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

      {/* ENGINE GRID */}
      <section id="features" className="px-6 lg:px-10 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 fade-up">
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald mb-4">The Engine</div>
            <h2 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.03em] leading-[1.05] text-white mb-5">
              Five analytical dimensions.<br />
              <span className="text-muted">One simple score.</span>
            </h2>
            <p className="text-[16px] text-soft leading-relaxed">
              Each dimension runs independently against your query. Together they produce a single Decision Quality Score — with a plain-English explanation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
                num: '01', title: 'Signal Intelligence',
                desc: 'Aggregates momentum, trend, and volatility indicators into a single setup quality score.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />,
                num: '02', title: 'Risk Simulation',
                desc: 'Runs thousands of probabilistic price paths to give the mathematical odds of hitting your target vs. stop loss.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19.07A10 10 0 1119.07 4.93 10 10 0 014.93 19.07z" />,
                num: '03', title: 'Manipulation Detector',
                desc: 'Scans for abnormal volume spikes and delivery patterns to flag coordinated pump-and-dump traps before you enter.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.5M12 18h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
                num: '04', title: 'Sentiment Reality Check',
                desc: 'Cross-references financial media sentiment against actual price action to catch distribution traps.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 11a4 4 0 11-8 0 4 4 0 018 0z" />,
                num: '05', title: 'Behavioural Risk Guard',
                desc: 'Flags self-sabotaging setups like late entries, chasing breakouts, or severe FOMO buying.',
              },
            ].map(({ icon, num, title, desc }) => (
              <div key={num} className="group relative p-6 rounded-2xl border border-line bg-card/40 hover:bg-card/80 hover:border-line2 transition fade-up">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald/10 border border-emerald/25 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{icon}</svg>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Dimension {num}</span>
                </div>
                <h3 className="text-[18px] font-semibold text-white mb-2">{title}</h3>
                <p className="text-[14px] text-soft leading-relaxed">{desc}</p>
              </div>
            ))}

            {/* Output card */}
            <div className="group relative p-6 rounded-2xl border border-emerald/20 bg-gradient-to-br from-emerald/10 via-emerald/5 to-transparent fade-up">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald text-ink flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald">The Output</span>
              </div>
              <h3 className="text-[18px] font-semibold text-white mb-2">Decision Quality Score</h3>
              <p className="text-[14px] text-soft leading-relaxed mb-4">A single 0–100 number with plain-English reasoning. You keep the decision. We audit the logic.</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">Output latency</span>
                <span className="font-mono text-[11px] text-emerald">&lt; 5 seconds</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DATA & TRUST */}
      <section id="methodology" className="px-6 lg:px-10 py-24 border-y border-line" style={{ background: 'linear-gradient(to bottom, rgba(11,13,16,0.6), transparent)' }}>
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="fade-up">
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald mb-4">Data & Trust</div>
            <h2 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.03em] leading-[1.05] text-white mb-5">
              Data that moves<br />as fast as markets.
            </h2>
            <p className="text-[16px] text-soft leading-relaxed mb-8 max-w-lg">
              StockX runs on institutional-grade data infrastructure — without ever touching your personal trading account or demat.
            </p>
            <div className="flex items-center gap-6 flex-wrap">
              {['No broker integration', 'No portfolio tracking', 'Zero data retention'].map(item => (
                <div key={item} className="flex items-center gap-2 text-soft text-[13px]">
                  <CheckIcon className="w-4 h-4 text-emerald" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              {
                icon: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" /><path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" /></>,
                label: 'Historical Depth', title: '5 Years NSE Historical Data',
                desc: 'Every tick, every session, every stock. Indexed for millisecond lookups.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
                label: 'Latency', title: 'Live Market Tick Data',
                desc: 'Sub-second NSE feed. What the engine sees is what\'s happening right now.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
                label: 'Privacy', title: 'No Personal Trade Data Required',
                desc: 'You never connect a broker. Your positions, PAN, and demat stay yours alone.',
              },
            ].map(({ icon, label, title, desc }) => (
              <div key={label} className="flex items-center gap-6 p-6 rounded-2xl border border-line bg-card/40 fade-up">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{icon}</svg>
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">{label}</div>
                  <div className="text-[22px] font-semibold text-white tracking-tight mb-1">{title}</div>
                  <div className="text-[13px] text-soft">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WITHOUT vs WITH */}
      <section className="px-6 lg:px-10 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 fade-up">
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald mb-4">Real Scenario</div>
            <h2 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.03em] leading-[1.05] text-white mb-5">
              One manipulated trade.<br />
              <span className="text-emerald">₹18,000 saved.</span>
            </h2>
            <p className="text-[16px] text-soft leading-relaxed">A real scenario using SUZLON during a coordinated pump cycle. See how StockX changes the outcome — before a single rupee is risked.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Without */}
            <div className="rounded-2xl border border-danger/20 overflow-hidden fade-up" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.04), transparent)' }}>
              <div className="px-5 py-3 border-b border-danger/15 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.06)' }}>
                <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-danger font-semibold">Without StockX</span>
              </div>
              <div className="divide-y divide-line/60">
                {[
                  ['Trigger', 'Telegram group sends "SUZLON breakout confirmed! Enter NOW at ₹45" with 12,000 forwards.'],
                  ['Action', 'Trader buys 5,000 shares at ₹45. Entry based on sentiment, no technical check.'],
                  ['Outcome (7 days later)', 'Stock retraces to ₹41.40 after pump collapses. Stop-loss triggered.'],
                ].map(([label, text]) => (
                  <div key={label} className="p-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-2">{label}</div>
                    <div className="text-[13.5px] text-soft leading-relaxed">{text}</div>
                  </div>
                ))}
                <div className="p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-2">Loss</div>
                  <div className="text-[28px] font-semibold tracking-[-0.03em] text-danger">−₹18,000</div>
                  <div className="text-[12px] text-muted mt-1">On a single trade.</div>
                </div>
              </div>
            </div>

            {/* With */}
            <div className="rounded-2xl border border-emerald/25 overflow-hidden glow-emerald fade-up" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.05), transparent)' }}>
              <div className="px-5 py-3 border-b border-emerald/20 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)' }}>
                <CheckIcon className="w-4 h-4 text-emerald" />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-emerald font-semibold">With StockX</span>
              </div>
              <div className="divide-y divide-line/60">
                {[
                  ['Trigger', 'Same Telegram tip received. Trader runs SUZLON through StockX before placing order.'],
                  ['StockX flags', 'Score: 24/100. Manipulation risk 78%. FOMO flag active. Sentiment/Reality gap: hype vs. neutral. Risk Simulation: 67% drawdown probability.'],
                  ['Action', 'Trader skips the trade. Waits for confirmation. Stock drops 8% over next 5 sessions.'],
                ].map(([label, text]) => (
                  <div key={label} className="p-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-2">{label}</div>
                    <div className="text-[13.5px] text-soft leading-relaxed">{text}</div>
                  </div>
                ))}
                <div className="p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-2">Outcome</div>
                  <div className="text-[28px] font-semibold tracking-[-0.03em] text-emerald">+₹18,000 saved</div>
                  <div className="text-[12px] text-muted mt-1">Capital protected. Decision validated.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEBI SAFE */}
      <section className="px-6 lg:px-10 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 fade-up">
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald mb-4">Trust & Compliance</div>
            <h2 className="text-[36px] md:text-[48px] font-semibold tracking-[-0.03em] leading-[1.05] text-white mb-5">
              SEBI-Safe <span className="text-muted">by design.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                badge: 'No Investment Advice', title: 'Audit, not advice',
                desc: "StockX never tells you what to buy or sell. It evaluates the quality of your own decision — a fundamentally different (and SEBI-safe) service.",
              },
              {
                badge: 'Zero Personal Data', title: 'Ephemeral by default',
                desc: "No portfolio, PAN, or account data is ever collected. Your trades are never tracked or stored. Every analysis is ephemeral.",
              },
              {
                badge: 'Fully Disconnected', title: 'No broker access',
                desc: "StockX operates entirely independently of your brokerage. No API keys, no demat access, no order placement — ever.",
              },
            ].map(({ badge, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-line bg-card/40 fade-up">
                <div className="inline-flex items-center gap-2 mb-4 px-2.5 py-1 rounded-md border border-emerald/25 bg-emerald/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-emerald">{badge}</span>
                </div>
                <h4 className="text-[16px] font-semibold text-white mb-2">{title}</h4>
                <p className="text-[13.5px] text-soft leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-10 py-24 border-t border-line">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 fade-up">
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald mb-4">FAQ</div>
            <h2 className="text-[36px] md:text-[44px] font-semibold tracking-[-0.03em] leading-[1.05] text-white">Common questions.</h2>
          </div>
          <div className="border-b border-line">
            {FAQS.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="try-free" className="relative px-6 lg:px-10 py-28 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-80 blur-3xl" style={{ background: 'linear-gradient(to right, transparent, rgba(16,185,129,0.08), transparent)' }} />
        <div className="relative max-w-4xl mx-auto text-center fade-up">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-emerald mb-6">Try It Free</div>
          <h2 className="text-[40px] md:text-[56px] font-semibold tracking-[-0.035em] leading-[1.05] text-white mb-6">
            Stop guessing.<br />
            <span className="text-emerald italic font-light">Start deciding.</span>
          </h2>
          <p className="text-[17px] text-soft leading-relaxed max-w-xl mx-auto mb-10">
            Ask your first market question — the engine is live, the data is real, and your first 5 queries are on us.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a
              href="#"
              onClick={scrollToSearch}
              className="group inline-flex items-center gap-3 px-7 py-4 rounded-xl bg-emerald text-ink font-semibold text-[15px] hover:bg-emerald/90 transition"
            >
              Start free — 5 queries on us
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a href="#features" className="inline-flex items-center gap-2 text-soft hover:text-white text-[14px] transition">
              See how the engine works →
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {['No card required', 'No broker access', '5 full queries, free'].map(item => (
              <div key={item} className="flex items-center gap-2 text-muted text-[12px] font-mono uppercase tracking-[0.08em]">
                <CheckIcon className="w-3.5 h-3.5 text-emerald" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 lg:px-10 pt-20 pb-10 border-t border-line" style={{ background: '#050608' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 pb-10 border-b border-line">
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[20px] font-semibold tracking-tight text-white">StockX</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted px-1.5 py-0.5 border border-line rounded">by Stoxify</span>
              </div>
              <p className="text-[13px] text-soft leading-relaxed max-w-xs">India's first AI-powered Decision Quality Engine for retail traders. Built to audit decisions, not make them.</p>
            </div>
            <div>
              <h5 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-4">Product</h5>
              <ul className="space-y-2.5 text-[13.5px]">
                <li><a href="#features" className="text-soft hover:text-white transition">Features</a></li>
                <li><a href="#methodology" className="text-soft hover:text-white transition">Methodology</a></li>
                <li><a href="#try-free" className="text-soft hover:text-white transition">Try Free</a></li>
              </ul>
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
