import { motion } from 'framer-motion'

const LAYERS = [
  { icon: '✦', name: 'Layer 1: XGBoost Signal Intelligence', desc: 'Computing RSI, MACD, EMA, ATR...' },
  { icon: '✦', name: 'Layer 2: Monte Carlo Risk Simulation', desc: 'Running 10,000 price path simulations...' },
  { icon: '✦', name: 'Layer 3: Isolation Forest — Pump Detection', desc: 'Scanning volume anomalies...' },
  { icon: '✦', name: 'Layer 4: FinBERT Sentiment Analysis', desc: 'Processing news sentiment data...' },
  { icon: '✦', name: 'Layer 5: Behavioural Risk Engine', desc: 'Checking FOMO and entry conditions...' },
  { icon: '✦', name: 'Groq API: Generating explanation', desc: 'Synthesising AI analysis...' },
]

export default function LoadingScreen({ symbol, stage }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-6 py-12 relative z-10"
    >
      <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 text-textMain font-serif text-2xl tracking-tight">
            <div className="w-2 h-2 rounded-full bg-textMain animate-pulse" />
            Analysing <span className="italic ml-1">{symbol}</span>
          </div>
          <p className="text-textMuted text-xs mt-3 uppercase tracking-widest font-medium">Running 5 AI/ML layers in sequence...</p>
        </div>

        <div className="space-y-1">
          {LAYERS.map((layer, i) => {
            const done = i < stage - 1
            const active = i === stage - 1
            const waiting = i >= stage

            return (
              <div
                key={i}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${
                  active ? 'bg-white/5' :
                  done ? 'opacity-60' : 'opacity-30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 transition-colors ${
                  active ? 'bg-textMain text-bg' : done ? 'bg-green/20 text-green' : 'bg-white/5 text-textMuted'
                }`}>
                  {done ? '✓' : layer.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-sans font-medium truncate ${
                    active ? 'text-textMain' : done ? 'text-textMuted' : 'text-textMuted/50'
                  }`}>
                    {layer.name}
                  </div>
                  {active && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-[11px] text-textMuted mt-0.5 font-light">
                      {layer.desc}
                    </motion.div>
                  )}
                </div>

                <div className="text-[11px] flex-shrink-0 font-sans font-medium uppercase tracking-widest">
                  {done && <span className="text-green">Done</span>}
                  {active && (
                    <div className="w-4 h-4 border-2 border-white/10 border-t-textMain rounded-full animate-spin" />
                  )}
                  {waiting && <span className="text-textMuted/30">—</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-textMain rounded-full"
            animate={{ width: `${(stage / LAYERS.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="text-center text-[10px] text-textMuted mt-3 font-sans font-medium uppercase tracking-widest">
          {Math.round((stage / LAYERS.length) * 100)}% complete
        </div>
      </div>
    </motion.div>
  )
}
