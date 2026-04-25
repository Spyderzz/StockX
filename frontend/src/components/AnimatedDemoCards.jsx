import { useState, useEffect } from 'react'

const COLOR_MAP = {
  emerald: { text: 'text-emerald', bgStyle: 'rgba(16,185,129,0.1)', borderStyle: 'rgba(16,185,129,0.25)', hex: '#10B981', barGrad: 'linear-gradient(90deg, #F59E0B, #10B981)' },
  warn: { text: 'text-warn', bgStyle: 'rgba(245,158,11,0.1)', borderStyle: 'rgba(245,158,11,0.25)', hex: '#F59E0B', barGrad: 'linear-gradient(90deg, #EF4444, #F59E0B)' },
  danger: { text: 'text-danger', bgStyle: 'rgba(239,68,68,0.1)', borderStyle: 'rgba(239,68,68,0.25)', hex: '#EF4444', barGrad: 'linear-gradient(90deg, #EF4444, #F59E0B)' },
}

const LABEL_COLORS = {
  green:  { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: 'text-emerald' },
  yellow: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: 'text-warn'   },
  red:    { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: 'text-danger'  },
}

function getColor(score) {
  if (score >= 70) return 'emerald'
  if (score >= 45) return 'warn'
  return 'danger'
}

function DemoMLCard({ name, engine, type, score, targetProb, slProb, setupLabel, setupColor, anomalyLabel, anomalyColor, sentiment, sentimentGap }) {
  const c = COLOR_MAP[getColor(score)]
  
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] overflow-hidden flex flex-col h-full hover:bg-white/[0.03] transition-colors duration-300">
      <div className="px-3 py-2.5 border-b border-line/40 flex flex-col gap-0.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-soft/80 truncate">{name}</span>
        <span className="font-mono text-[7px] text-muted/40 uppercase tracking-widest truncate">{engine}</span>
      </div>
      
      <div className="p-3 flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1">
            <span className={`text-[28px] font-bold tracking-tight leading-none transition-colors duration-500 ${c.text}`}>
              {Math.round(score)}
            </span>
            <span className="font-mono text-[9px] text-muted">/100</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-[800ms] ease-in-out" 
              style={{ width: `${score}%`, background: c.hex }} 
            />
          </div>
        </div>
        
        <div className="mt-1">
          {type === 'xgb' && setupLabel && (() => {
            const lc = LABEL_COLORS[setupColor] || LABEL_COLORS.yellow
            return (
              <div className="rounded-lg px-2.5 py-2 flex items-center justify-center border transition-colors duration-500" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_6px_rgba(currentColor,0.5)]" style={{ background: lc.border }} />
                  <span className={`font-mono text-[9.5px] font-bold tracking-wider uppercase text-center ${lc.text}`}>{setupLabel}</span>
                </div>
              </div>
            )
          })()}

          {type === 'mc' && targetProb != null && (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg py-2 bg-emerald/10 border border-emerald/20 flex flex-col items-center justify-center text-center">
                  <span className="font-semibold text-emerald text-[16px] leading-none transition-all duration-500">{Math.round(targetProb)}%</span>
                  <span className="font-mono text-[7px] text-emerald/70 mt-1 uppercase tracking-wider">Target</span>
                </div>
                <div className="rounded-lg py-2 bg-danger/10 border border-danger/20 flex flex-col items-center justify-center text-center">
                  <span className="font-semibold text-danger text-[16px] leading-none transition-all duration-500">{Math.round(slProb)}%</span>
                  <span className="font-mono text-[7px] text-danger/70 mt-1 uppercase tracking-wider">Stop Loss</span>
                </div>
              </div>
            </div>
          )}

          {type === 'iso' && anomalyLabel && (() => {
            const lc = LABEL_COLORS[anomalyColor] || LABEL_COLORS.yellow
            return (
              <div className="rounded-lg px-2.5 py-2 flex items-center justify-center border transition-colors duration-500" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-1.5">
                  <svg className={`w-3.5 h-3.5 ${lc.text}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  <span className={`font-mono text-[9.5px] font-bold tracking-wider uppercase ${lc.text}`}>{anomalyLabel}</span>
                </div>
              </div>
            )
          })()}

          {type === 'sentiment' && sentiment != null && (
            <div className="rounded-lg p-2.5 bg-white/[0.03] border border-white/5 flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted mb-0.5">Sentiment</span>
                  <span className="font-semibold text-[16px] text-white leading-none transition-all duration-500">{Math.round(sentiment)}</span>
                </div>
                {sentimentGap != null && (
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-muted mb-0.5">Gap</span>
                    <span className="font-semibold text-[13px] text-warn leading-none transition-all duration-500">{Math.round(sentimentGap)}</span>
                  </div>
                )}
              </div>
              {sentimentGap != null && (
                <div className="h-1 rounded-full bg-white/5 overflow-hidden flex">
                  <div className="h-full bg-emerald transition-all duration-[800ms] ease-in-out" style={{ width: `${sentiment}%` }} />
                  <div className="h-full bg-warn transition-all duration-[800ms] ease-in-out" style={{ width: `${Math.min(100 - sentiment, sentimentGap)}%` }} />
                </div>
              )}
            </div>
          )}

          {type === 'behaviour' && setupLabel && (() => {
            const lc = LABEL_COLORS[setupColor] || LABEL_COLORS.yellow
            return (
              <div className="rounded-lg px-2.5 py-2 flex items-center justify-center border transition-colors duration-500" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono text-[9.5px] font-bold tracking-wider uppercase text-center ${lc.text}`}>{setupLabel}</span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

const BASE_DIMS = [
  { name: 'SIGNAL INTEL', engine: 'MACHINE LEARNING', type: 'xgb', score: 84, setupLabel: 'STRONG SETUP', setupColor: 'green' },
  { name: 'RISK SIMULATION', engine: 'STATISTICAL', type: 'mc', score: 0, targetProb: 0, slProb: 100 },
  { name: 'PUMP & DUMP', engine: 'ANOMALY ENGINE', type: 'iso', score: 95, anomalyLabel: 'ORGANIC ACTION', anomalyColor: 'green' },
  { name: 'MARKET SENTIMENT', engine: 'NLP MODEL', type: 'sentiment', score: 46, sentiment: 43, sentimentGap: 41 },
  { name: 'BEHAVIOURAL', engine: 'CATBOOST MODEL', type: 'behaviour', score: 100, setupLabel: 'CLEAN ENTRY', setupColor: 'green' },
]

const DEMO_TARGETS = [
  {
    ticker: 'ADANIENT',
    basePrice: 2281.60,
    basePct: -0.17,
    verdict: 'PROCEED WITH CAUTION',
    regime: 'SIDEWAYS',
    baseScore: 60,
    explain: "ADANIENT shows a bullish bias despite sideways market regime due to strong technicals and sentiment gap. — ADANIENT is trading above its EMA200, and the signal from XGBoost is dynamically outperforming. Given the positive sentiment gap, this can be seen as an under-appreciated opportunity."
  },
  {
    ticker: 'HDFCBANK',
    basePrice: 1623.40,
    basePct: 1.24,
    verdict: 'STRONG SETUP',
    regime: 'BULL MARKET',
    baseScore: 82,
    explain: "High-quality decision setup. Strong trend structure with volume backing. 81% probability of positive outcome over 10 sessions. No manipulation, no FOMO — clean entry signal. Sentiment closely matches technicals."
  },
  {
    ticker: 'SUZLON',
    basePrice: 45.20,
    basePct: -3.42,
    verdict: 'HIGH RISK ENTRY',
    regime: 'BEAR MARKET',
    baseScore: 24,
    explain: "Volume anomaly detected. Price diverging from institutional sentiment. High probability of a distribution trap. 67% of simulations hit stop-loss before target. Proceed with extreme caution."
  },
  {
    ticker: 'RELIANCE',
    basePrice: 2847.50,
    basePct: 0.85,
    verdict: 'QUALITY SETUP',
    regime: 'BULL MARKET',
    baseScore: 71,
    explain: "Strong institutional-grade setup. 73% probability of positive outcome over 10 sessions. No manipulation flags. Volume organically outperforming. Sentiment aligns perfectly with fundamentals."
  }
]

export default function AnimatedDemoCards() {
  const [targetIdx, setTargetIdx] = useState(0)
  const currentTarget = DEMO_TARGETS[targetIdx]

  const [dims, setDims] = useState(BASE_DIMS)
  const [verdictScore, setVerdictScore] = useState(currentTarget.baseScore)
  const [livePrice, setLivePrice] = useState(currentTarget.basePrice)
  const [livePct, setLivePct] = useState(currentTarget.basePct)

  // Rotate stock every 6 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      setTargetIdx(prev => {
        const next = (prev + 1) % DEMO_TARGETS.length
        setVerdictScore(DEMO_TARGETS[next].baseScore)
        setLivePrice(DEMO_TARGETS[next].basePrice)
        setLivePct(DEMO_TARGETS[next].basePct)
        return next
      })
    }, 6000)
    return () => clearInterval(iv)
  }, [])

  // Randomize numbers every 1.2 seconds to simulate live processing
  useEffect(() => {
    const interval = setInterval(() => {
      setDims(prev => prev.map((d, i) => {
        const base = BASE_DIMS[i]
        
        let diff = (Math.random() - 0.5) * 12
        if (d.score > base.score + 10) diff -= 4
        if (d.score < base.score - 10) diff += 4
        
        let newScore = Math.max(0, Math.min(100, d.score + diff))
        const newD = { ...d, score: newScore }
        
        if (d.type === 'mc') {
          let pDiff = (Math.random() - 0.5) * 6
          if (d.targetProb > base.targetProb + 8) pDiff -= 3
          if (d.targetProb < base.targetProb - 8) pDiff += 3
          newD.targetProb = Math.max(0, Math.min(100, d.targetProb + pDiff))
          newD.slProb = 100 - newD.targetProb
        } else if (d.type === 'sentiment') {
          let sDiff = (Math.random() - 0.5) * 8
          if (d.sentiment > base.sentiment + 8) sDiff -= 3
          if (d.sentiment < base.sentiment - 8) sDiff += 3
          newD.sentiment = Math.max(0, Math.min(100, d.sentiment + sDiff))
          
          let gDiff = (Math.random() - 0.5) * 4
          newD.sentimentGap = Math.max(0, Math.min(50, d.sentimentGap + gDiff))
        }
        
        return newD
      }))
      
      setVerdictScore(prev => {
        const base = DEMO_TARGETS[targetIdx].baseScore
        let vDiff = (Math.random() - 0.5) * 8
        if (prev > base + 8) vDiff -= 3
        if (prev < base - 8) vDiff += 3
        return Math.max(0, Math.min(100, prev + vDiff))
      })

      setLivePrice(prev => {
        const diff = (Math.random() - 0.5) * (DEMO_TARGETS[targetIdx].basePrice * 0.001) // 0.1% volatility
        return Math.max(0, prev + diff)
      })

      setLivePct(prev => {
        const diff = (Math.random() - 0.5) * 0.1
        return prev + diff
      })
    }, 1200)
    
    return () => clearInterval(interval)
  }, [targetIdx])

  const c = COLOR_MAP[getColor(verdictScore)]

  return (
    <div className="w-full max-w-5xl mx-auto my-16 select-none pointer-events-none">
      <div className="glass rounded-2xl overflow-hidden shadow-2xl relative">
        {/* Animated scanning line overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald/5 to-transparent h-[20%] w-full animate-scan pointer-events-none opacity-30 z-10" />

        {/* Terminal bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald/70" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted ml-3">stockx.engine › demo_terminal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">Live Simulation</span>
          </div>
        </div>

        <div className="p-6 md:p-8 relative z-0">
          {/* Query */}
          <div className="flex items-start gap-3 mb-5">
            <span className="font-mono text-[11px] mt-1 text-muted">Query ›</span>
            <p className="text-soft text-[15px] leading-relaxed transition-all duration-300">
              What's the risk profile for <span className="text-white font-medium">{currentTarget.ticker}</span> right now?
            </p>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-line to-transparent mb-6" />

          {/* Verdict row */}
          <div className="flex items-start md:items-center justify-between gap-6 flex-col md:flex-row mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-500" style={{ background: c.bgStyle, border: `1px solid ${c.borderStyle}` }}>
                <svg className={`w-6 h-6 transition-colors duration-500 ${c.text}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-1">StockX Verdict</div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full transition-colors duration-500`} style={{ background: c.hex, boxShadow: `0 0 10px ${c.hex}` }} />
                  <h2 className="text-[20px] md:text-[24px] font-semibold text-white tracking-tight leading-none uppercase transition-all duration-300">
                    {currentTarget.verdict}
                  </h2>
                </div>
              </div>
            </div>

            <div className="text-left md:text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-1">Quality Score</div>
              <div className="flex items-baseline justify-start md:justify-end gap-1">
                <span className={`text-[40px] font-bold tracking-tight leading-none transition-colors duration-500 ${c.text}`}>
                  {Math.round(verdictScore)}
                </span>
                <span className="font-mono text-[12px] text-muted">/100</span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3 mb-6">
            <div className="px-3 py-2 rounded-xl border border-line bg-white/[0.02] flex items-center gap-2">
              <span className="text-white font-semibold text-[14px] transition-all duration-300">₹{livePrice.toFixed(2)}</span>
              <span className="font-mono text-[10px] text-muted/50">NSE</span>
            </div>
            <div className={`px-3 py-2 rounded-xl border font-mono text-[11px] font-bold tracking-wider transition-colors duration-500 ${livePct >= 0 ? 'border-emerald/30 bg-emerald/10 text-emerald' : 'border-danger/30 bg-danger/10 text-danger'}`}>
              {livePct > 0 ? '+' : ''}{livePct.toFixed(2)}% today
            </div>
            <div className={`px-3 py-2 rounded-xl border font-mono text-[11px] font-bold uppercase tracking-widest transition-colors duration-500 ${currentTarget.regime === 'BULL MARKET' ? 'border-emerald/30 bg-emerald/10 text-emerald' : currentTarget.regime === 'BEAR MARKET' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-warn/30 bg-warn/10 text-warn'}`}>
              {currentTarget.regime === 'BULL MARKET' ? '↑ BULL MARKET' : currentTarget.regime === 'BEAR MARKET' ? '↓ BEAR MARKET' : '→ SIDEWAYS'}
            </div>
            <span className="font-mono text-[10px] text-muted/50 uppercase tracking-widest">Market price</span>
          </div>

          {/* Score bar */}
          <div className="relative h-1 rounded-full bg-line mb-6 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-[800ms] ease-in-out" style={{ width: `${verdictScore}%`, background: c.barGrad }} />
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
                <p className="text-soft text-[14px] leading-relaxed transition-all duration-500 min-h-[4rem]">
                  {currentTarget.explain}
                </p>
              </div>
            </div>
          </div>

          {/* Dimensions — ML Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {dims.map((d, i) => <DemoMLCard key={i} {...d} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
