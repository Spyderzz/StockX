import { useState, useRef } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import ScoreGauge from './components/ScoreGauge'
import LayerCard from './components/LayerCard'
import MonteCarloChart from './components/MonteCarloChart'
import LoadingScreen from './components/LoadingScreen'
import WithoutWith from './components/WithoutWith'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const DEMO_STOCKS = ['SUZLON', 'RELIANCE', 'HDFCBANK', 'TATASTEEL', 'INFY', 'SBIN']

function App() {
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  const analyse = async (sym) => {
    const s = (sym || symbol).trim().toUpperCase()
    if (!s) return
    setSymbol(s)
    setResult(null)
    setError('')
    setLoading(true)
    setLoadingStage(0)

    // Simulate layer-by-layer progress
    const stages = [0, 1, 2, 3, 4, 5]
    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, 700))
      setLoadingStage(i + 1)
    }

    try {
      const res = await axios.post(`${API_URL}/analyse`, { symbol: s })
      setResult(res.data)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Analysis failed. Check the stock symbol and try again.'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStage(0)
    }
  }

  const reset = () => {
    setResult(null)
    setError('')
    setSymbol('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const verdictClass = (score) => {
    if (score <= 30) return 'text-green bg-green/10'
    if (score <= 55) return 'text-textMain bg-white/10'
    if (score <= 75) return 'text-orange bg-orange/10'
    return 'text-red bg-red/10'
  }

  return (
    <div className="relative z-1 min-h-screen bg-bg text-textMain font-sans overflow-x-hidden selection:bg-white/20">

      {/* ── AMBIENT BLUR ── */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-[120px] pointer-events-none" />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-5 bg-bg/60 backdrop-blur-2xl border-b border-white/5">
        <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-textMain flex items-center justify-center font-serif text-lg text-bg italic pr-0.5 pt-0.5">S</div>
          <div>
            <div className="font-serif text-2xl tracking-tight leading-none">StockX</div>
            <div className="text-[9px] text-textMuted tracking-widest uppercase mt-0.5">by Stoxify</div>
          </div>
        </a>
        <div className="flex items-center gap-6">
          <a href="/" className="text-sm font-medium tracking-wide text-textMuted hover:text-white transition-colors">
            Back
          </a>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] px-3 py-1 rounded-full bg-white/5 text-textMuted font-medium tracking-wide">SEBI-SAFE</span>
            <span className="text-[10px] px-3 py-1 rounded-full bg-textMain text-bg font-semibold tracking-wide">AI ENGINE</span>
          </div>
        </div>
      </header>

      {/* ── STATS BAR ── */}
      <div className="flex justify-center gap-16 py-6 px-8 border-b border-white/5 bg-white/[0.02]">
        {[
          ['91%', 'Retail traders lose money'],
          ['₹1.06L Cr', 'Lost in F&O — FY25'],
          ['5 Layers', 'AI/ML engines'],
          ['0', 'Personal data required'],
        ].map(([num, label]) => (
          <div key={label} className="text-center">
            <div className="font-serif text-3xl text-textMain">{num}</div>
            <div className="text-[11px] text-textMuted mt-1 tracking-wide font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* ── SEARCH ── */}
      <AnimatePresence>
        {!result && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto pt-24 px-6 text-center relative z-10"
          >
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              <span className="text-[10px] text-textMain tracking-widest uppercase font-medium">Decision Quality Engine Live</span>
            </div>
            
            <h1 className="font-serif text-6xl md:text-8xl tracking-tight leading-[1.05] mb-6">
              Don't trade blind.<br />
              <span className="text-textMuted italic">Know before you risk.</span>
            </h1>
            
            <p className="text-textMuted text-lg md:text-xl max-w-xl mx-auto mb-12 font-light leading-relaxed">
              StockX doesn't tell you what to buy — it tells you whether your decision makes sense.
            </p>

            {/* Search */}
            <div className="max-w-xl mx-auto">
              <div className="flex items-center p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl focus-within:border-white/30 focus-within:bg-white/10 transition-all duration-300">
                <input
                  ref={inputRef}
                  value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && analyse()}
                  placeholder="Enter Stock Symbol (e.g. RELIANCE)"
                  className="flex-1 bg-transparent border-none outline-none text-textMain font-sans font-medium text-lg px-5 py-3 placeholder:text-textMuted/50 placeholder:font-light"
                  maxLength={20}
                  autoComplete="off"
                />
                <button
                  onClick={() => analyse()}
                  disabled={loading || !symbol.trim()}
                  className="bg-textMain text-bg font-sans font-medium text-sm px-8 py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyse
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                <span className="text-[11px] text-textMuted/50 uppercase tracking-widest">Try:</span>
                {DEMO_STOCKS.map(s => (
                  <button
                    key={s}
                    onClick={() => analyse(s)}
                    className="text-[12px] font-sans text-textMuted px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-textMain transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-8 max-w-xl mx-auto p-4 rounded-xl bg-red/10 text-red text-sm font-medium">
                {error}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOADING ── */}
      {loading && <LoadingScreen symbol={symbol} stage={loadingStage} />}

      {/* ── RESULTS ── */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            ref={resultsRef} 
            className="max-w-[1000px] mx-auto px-6 py-16 relative z-10"
          >
            {/* Score + AI Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 mb-6">
              
              {/* Gauge */}
              <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <ScoreGauge score={result.final_score} color={result.verdict_color} />
                <div className={`mt-6 px-6 py-2.5 rounded-full font-sans font-semibold tracking-wide text-[11px] uppercase ${verdictClass(result.final_score)}`}>
                  {result.verdict}
                </div>
              </div>

              {/* AI Explanation */}
              <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-1 h-full bg-textMain/20 rounded-l-[2rem] transition-all duration-500 group-hover:bg-textMain/40" />
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">✦</div>
                  <span className="text-[11px] text-textMuted tracking-widest uppercase font-semibold">AI Synthesis</span>
                </div>
                <div className="font-serif text-3xl md:text-4xl tracking-tight mb-4 text-textMain">
                  {result.symbol} <span className="text-textMuted/40 font-sans font-light text-xl italic ml-2">NSE</span>
                </div>
                <div className="text-lg text-textMain leading-relaxed mb-6 font-serif italic">
                  "{result.one_liner}"
                </div>
                <div className="text-[15px] text-textMuted leading-[1.8] font-light">
                  {result.explanation}
                </div>

                {/* Tech snapshot */}
                {result.tech_snapshot && (
                  <div className="flex gap-6 mt-8 pt-6 border-t border-white/5 flex-wrap">
                    {[
                      ['Price', `₹${result.tech_snapshot.current_price}`],
                      ['RSI', result.tech_snapshot.rsi],
                      ['Volume', `${result.tech_snapshot.vol_ratio}x avg`],
                      ['Today', `${result.tech_snapshot.today_change_pct > 0 ? '+' : ''}${result.tech_snapshot.today_change_pct}%`],
                    ].map(([label, val]) => (
                      <div key={label} className="min-w-[60px]">
                        <div className="font-sans font-semibold text-lg text-textMain mb-0.5">{val}</div>
                        <div className="text-[11px] text-textMuted uppercase tracking-widest font-medium">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 5 Layer Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <LayerCard
                num="01" name="Signal Intel" model="XGBoost"
                score={result.signal_intel.score} riskScore={100 - result.signal_intel.score}
                finding={result.signal_intel.finding} color="#ffffff"
                displayLabel="Setup Score"
              />
              <LayerCard
                num="02" name="Risk Sim" model="Monte Carlo"
                score={result.monte_carlo.sl_prob} riskScore={result.monte_carlo.sl_prob}
                finding={result.monte_carlo.finding} color="#4db8ff"
                displayLabel="SL Prob %"
              />
              <LayerCard
                num="03" name="Pump & Dump" model="Isolation Forest"
                score={result.pump_dump.score} riskScore={result.pump_dump.score}
                finding={result.pump_dump.finding} color="#ff4d6a"
                displayLabel="Risk Score"
              />
              <LayerCard
                num="04" name="Sentiment Gap" model="FinBERT"
                score={result.sentiment_gap.divergence} riskScore={result.sentiment_gap.divergence}
                finding={result.sentiment_gap.finding} color="#ff8c42"
                displayLabel="Divergence"
              />
              <LayerCard
                num="05" name="Behaviour" model="Rule-Based"
                score={result.behaviour.score} riskScore={result.behaviour.score}
                finding={result.behaviour.finding} color="#a78bfa"
                displayLabel="Risk Score"
              />
            </div>

            {/* Monte Carlo + Without/With */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <MonteCarloChart
                paths={result.monte_carlo.paths}
                targetProb={result.monte_carlo.target_prob}
                slProb={result.monte_carlo.sl_prob}
                maxPosition={result.monte_carlo.max_position}
              />
              <WithoutWith symbol={result.symbol} score={result.final_score} result={result} />
            </div>

            {/* Score breakdown bar */}
            <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 mb-10">
              <div className="text-[11px] text-textMuted tracking-widest uppercase font-semibold mb-6">Decision Quality Score Breakdown</div>
              <div className="space-y-4">
                {[
                  { label: 'Signal Intelligence', risk: 100 - result.signal_intel.score, weight: '20%', color: '#ffffff' },
                  { label: 'Risk Simulation', risk: result.monte_carlo.sl_prob, weight: '25%', color: '#4db8ff' },
                  { label: 'Pump & Dump Detection', risk: result.pump_dump.score, weight: '25%', color: '#ff4d6a' },
                  { label: 'Sentiment Gap', risk: Math.min(100, result.sentiment_gap.divergence * 1.3), weight: '20%', color: '#ff8c42' },
                  { label: 'Behavioural Risk', risk: result.behaviour.score, weight: '10%', color: '#a78bfa' },
                ].map(({ label, risk, weight, color }) => (
                  <div key={label} className="flex items-center gap-6">
                    <div className="text-[13px] text-textMuted font-medium w-48 shrink-0">{label}</div>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${risk}%` }}
                        transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                    <div className="text-[13px] font-sans font-medium text-textMain w-8 text-right">{Math.round(risk)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset */}
            <div className="text-center">
              <button
                onClick={reset}
                className="bg-transparent text-textMuted font-sans font-medium text-sm px-8 py-3 rounded-full hover:bg-white/5 hover:text-textMain transition-all"
              >
                Analyse Another Stock
              </button>
              <p className="text-[11px] text-textMuted/40 mt-6 tracking-wide uppercase">
                StockX by Stoxify · Academic Demo
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
