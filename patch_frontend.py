import re

with open('frontend/src/pages/AnalysePage.jsx', 'r') as f:
    content = f.read()

# 1. Update dims array names
dims_old = """  const dims = [
    { name: 'Signal Int.', score: Math.round(data.signal_intel.score), color: getColorForQualityScore(data.signal_intel.score), reason: data.signal_intel?.finding ?? '', setup_label: data.signal_intel?.setup_label, setup_color: data.signal_intel?.setup_color, model: data.signal_intel?.model, type: 'xgb' },
    { name: 'Risk Sim.', score: Math.round(data.monte_carlo?.target_prob ?? 50), color: getColorForQualityScore(data.monte_carlo?.target_prob ?? 50), reason: data.monte_carlo?.finding ?? '', target_prob: data.monte_carlo?.target_prob, sl_prob: data.monte_carlo?.sl_prob, max_position: data.monte_carlo?.max_position, model: data.monte_carlo?.model, type: 'mc' },
    { name: 'Pump & Dump', score: Math.round(100 - (data.pump_dump?.score ?? 50)), color: getColorForQualityScore(100 - (data.pump_dump?.score ?? 50)), reason: data.pump_dump?.finding ?? '', anomaly_label: data.pump_dump?.anomaly_label, anomaly_color: data.pump_dump?.anomaly_color, is_anomaly: data.pump_dump?.is_anomaly, model: data.pump_dump?.model, type: 'iso' },
    { name: 'Sentiment', score: Math.round(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), color: getColorForQualityScore(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), reason: data.sentiment_gap?.finding ?? '', sentiment_score: data.sentiment_gap?.sentiment_score, divergence: data.sentiment_gap?.divergence, model: data.sentiment_gap?.model, type: 'sentiment' },
    { name: 'Behavioural', score: Math.round(100 - (data.behaviour?.score ?? 20)), color: getColorForQualityScore(100 - (data.behaviour?.score ?? 20)), reason: data.behaviour?.finding ?? '', flags: data.behaviour?.flags, model: data.behaviour?.model, type: 'behaviour' },
  ]"""

dims_new = """  const dims = [
    { name: 'Signal Intel', score: Math.round(data.signal_intel.score), color: getColorForQualityScore(data.signal_intel.score), reason: data.signal_intel?.finding ?? '', setup_label: data.signal_intel?.setup_label, setup_color: data.signal_intel?.setup_color, model: data.signal_intel?.model, type: 'xgb' },
    { name: 'Risk Simulation', score: Math.round(data.monte_carlo?.target_prob ?? 50), color: getColorForQualityScore(data.monte_carlo?.target_prob ?? 50), reason: data.monte_carlo?.finding ?? '', target_prob: data.monte_carlo?.target_prob, sl_prob: data.monte_carlo?.sl_prob, max_position: data.monte_carlo?.max_position, model: data.monte_carlo?.model, type: 'mc' },
    { name: 'Pump & Dump', score: Math.round(100 - (data.pump_dump?.score ?? 50)), color: getColorForQualityScore(100 - (data.pump_dump?.score ?? 50)), reason: data.pump_dump?.finding ?? '', anomaly_label: data.pump_dump?.anomaly_label, anomaly_color: data.pump_dump?.anomaly_color, is_anomaly: data.pump_dump?.is_anomaly, model: data.pump_dump?.model, type: 'iso' },
    { name: 'Market Sentiment', score: Math.round(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), color: getColorForQualityScore(100 - Math.min(100, (data.sentiment_gap?.divergence ?? 30) * 1.3)), reason: data.sentiment_gap?.finding ?? '', sentiment_score: data.sentiment_gap?.sentiment_score, divergence: data.sentiment_gap?.divergence, model: data.sentiment_gap?.model, type: 'sentiment' },
    { name: 'Behavioural', score: Math.round(100 - (data.behaviour?.score ?? 20)), color: getColorForQualityScore(100 - (data.behaviour?.score ?? 20)), reason: data.behaviour?.finding ?? '', flags: data.behaviour?.flags, model: data.behaviour?.model, type: 'behaviour' },
  ]"""

content = content.replace(dims_old, dims_new)

# 2. Update MLCard entirely
mlcard_old = """// ─── ML Layer Card ───
const LABEL_COLORS = {
  green:  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: 'text-emerald' },
  yellow: { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  text: 'text-warn'   },
  red:    { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   text: 'text-danger'  },
}

function MLCard({ dim }) {
  const c = COLOR_MAP[dim.color]
  const type = dim.type

  return (
    <div className="rounded-2xl border border-line bg-white/[0.025] overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-line/60 flex items-center justify-between bg-white/[0.02]">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{dim.name}</span>
        {dim.model && <span className="font-mono text-[8px] text-muted/50 hidden md:block">{dim.model.split(' ')[0]}</span>}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[32px] font-semibold tracking-[-0.03em] leading-none ${c.text}`}>{dim.score}</span>
          <span className="font-mono text-[11px] text-muted">/100</span>
        </div>
        <div className="h-1 rounded-full bg-line overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${dim.score}%`, background: c.hex }} />
        </div>
        
        {type === 'xgb' && dim.setup_label && (() => {
          const lc = LABEL_COLORS[dim.setup_color] || LABEL_COLORS.yellow
          return (
            <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: lc.bg, border: `1px solid ${lc.border}` }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lc.border }} />
              <span className={`font-mono text-[11px] font-bold ${lc.text}`}>{dim.setup_label}</span>
              <span className="font-mono text-[9px] text-muted ml-auto">Signal Intel</span>
            </div>
          )
        })()}

        {type === 'mc' && dim.target_prob != null && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-3 py-2 bg-emerald/10 border border-emerald/25 text-center">
              <div className="font-semibold text-emerald text-[18px]">{dim.target_prob?.toFixed(1)}%</div>
              <div className="font-mono text-[9px] text-muted mt-0.5">Hit +8% Target</div>
            </div>
            <div className="rounded-lg px-3 py-2 bg-danger/10 border border-danger/25 text-center">
              <div className="font-semibold text-danger text-[18px]">{dim.sl_prob?.toFixed(1)}%</div>
              <div className="font-mono text-[9px] text-muted mt-0.5">Hit -4% SL</div>
            </div>
            {dim.max_position && (
              <div className="col-span-2 rounded-lg px-3 py-1.5 bg-white/[0.03] border border-line text-center">
                <span className="font-mono text-[9px] text-muted">Kelly Max: </span>
                <span className="font-mono text-[11px] text-soft">{dim.max_position}</span>
              </div>
            )}
          </div>
        )}

        {type === 'iso' && dim.anomaly_label && (() => {
          const lc = LABEL_COLORS[dim.anomaly_color] || LABEL_COLORS.yellow
          return (
            <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: lc.bg, border: `1px solid ${lc.border}` }}>
              <svg className={`w-3.5 h-3.5 ${lc.text} flex-shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
              <span className={`font-mono text-[11px] font-bold ${lc.text}`}>{dim.anomaly_label}</span>
              <span className="font-mono text-[9px] text-muted ml-auto">Anomaly Engine</span>
            </div>
          )
        })()}

        {type === 'sentiment' && dim.sentiment_score != null && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[9px] text-muted">Sentiment Score</span>
                <span className="font-mono text-[9px] text-soft">{dim.sentiment_score?.toFixed(0)}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-line overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-danger via-warn to-emerald" style={{ width: `${dim.sentiment_score}%` }} />
              </div>
            </div>
            {dim.divergence != null && (
              <div className="rounded-lg px-2 py-1 bg-white/[0.04] border border-line text-center">
                <div className="font-mono text-[11px] text-soft">{dim.divergence?.toFixed(0)}pt</div>
                <div className="font-mono text-[8px] text-muted">gap</div>
              </div>
            )}
          </div>
        )}

        {type === 'behaviour' && dim.flags && dim.flags.length > 0 && (
          <div className="space-y-1">
            {dim.flags.slice(0, 2).map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-warn mt-1.5 flex-shrink-0" />
                <span className="font-mono text-[10px] text-muted leading-relaxed">{f}</span>
              </div>
            ))}
          </div>
        )}

        {dim.reason && (
          <p className="text-[11px] text-muted/80 leading-relaxed border-t border-line/40 pt-2 mt-auto">{dim.reason}</p>
        )}
      </div>
    </div>
  )
}"""

mlcard_new = """// ─── ML Layer Card ───
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
  'behaviour': 'RULE-BASED'
}

function MLCard({ dim }) {
  const c = COLOR_MAP[dim.color]
  const type = dim.type
  const engineLabel = TYPE_TO_MODEL[type] || 'ENGINE'

  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] overflow-hidden flex flex-col h-full hover:bg-white/[0.03] transition-colors duration-300">
      <div className="px-5 py-3 border-b border-line/40 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-soft/80">{dim.name}</span>
        <span className="font-mono text-[8px] text-muted/40 uppercase tracking-widest">{engineLabel}</span>
      </div>
      
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[36px] font-bold tracking-tight leading-none ${c.text}`}>{dim.score}</span>
            <span className="font-mono text-[11px] text-muted">/100</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${dim.score}%`, background: c.hex }} />
          </div>
        </div>
        
        <div className="mt-1">
          {type === 'xgb' && dim.setup_label && (() => {
            const lc = LABEL_COLORS[dim.setup_color] || LABEL_COLORS.yellow
            return (
              <div className="rounded-xl px-4 py-3 flex items-center justify-center border" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(currentColor,0.5)]" style={{ background: lc.border }} />
                  <span className={`font-mono text-[12px] font-bold tracking-wide ${lc.text}`}>{dim.setup_label}</span>
                </div>
              </div>
            )
          })()}

          {type === 'mc' && dim.target_prob != null && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2.5 bg-emerald/10 border border-emerald/20 flex flex-col items-center justify-center text-center">
                  <span className="font-semibold text-emerald text-[20px] leading-tight">{dim.target_prob?.toFixed(1)}%</span>
                  <span className="font-mono text-[9px] text-emerald/70 mt-1 uppercase tracking-wider">Hit +8% Target</span>
                </div>
                <div className="rounded-xl px-3 py-2.5 bg-danger/10 border border-danger/20 flex flex-col items-center justify-center text-center">
                  <span className="font-semibold text-danger text-[20px] leading-tight">{dim.sl_prob?.toFixed(1)}%</span>
                  <span className="font-mono text-[9px] text-danger/70 mt-1 uppercase tracking-wider">Hit -4% SL</span>
                </div>
              </div>
              {dim.max_position && (
                <div className="rounded-xl px-4 py-2.5 bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Kelly Max Pos</span>
                  <span className="font-mono text-[12px] text-white font-medium">{dim.max_position}</span>
                </div>
              )}
            </div>
          )}

          {type === 'iso' && dim.anomaly_label && (() => {
            const lc = LABEL_COLORS[dim.anomaly_color] || LABEL_COLORS.yellow
            return (
              <div className="rounded-xl px-4 py-3 flex items-center justify-center border" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex items-center gap-2.5">
                  <svg className={`w-4 h-4 ${lc.text}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  <span className={`font-mono text-[12px] font-bold tracking-wide ${lc.text}`}>{dim.anomaly_label}</span>
                </div>
              </div>
            )
          })()}

          {type === 'sentiment' && dim.sentiment_score != null && (
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted mb-1">Sentiment Score</span>
                  <span className="font-semibold text-[22px] text-white leading-none">{dim.sentiment_score?.toFixed(0)}</span>
                </div>
                {dim.divergence != null && (
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted mb-1">Divergence</span>
                    <span className="font-mono text-[13px] text-warn font-medium">{dim.divergence?.toFixed(0)} pts</span>
                  </div>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden w-full mt-1">
                <div className="h-full rounded-full bg-gradient-to-r from-danger via-warn to-emerald" style={{ width: `${dim.sentiment_score}%` }} />
              </div>
            </div>
          )}

          {type === 'behaviour' && dim.flags && dim.flags.length > 0 && (
            <div className="rounded-xl p-3.5 bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              {dim.flags.slice(0, 2).map((f, i) => {
                const parts = f.split(':')
                const title = parts[0]
                const desc = parts.slice(1).join(':')
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-warn shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
                      <span className="font-mono text-[10px] font-bold text-warn tracking-widest uppercase">{title}</span>
                    </div>
                    {desc && <span className="font-mono text-[10px] text-muted/90 leading-relaxed pl-3.5">{desc.trim()}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {dim.reason && (
          <div className="mt-auto pt-4 border-t border-line/40">
            <p className="text-[12px] text-muted/70 leading-relaxed font-sans">{dim.reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}"""

content = content.replace(mlcard_old, mlcard_new)

with open('frontend/src/pages/AnalysePage.jsx', 'w') as f:
    f.write(content)
