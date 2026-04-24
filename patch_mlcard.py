import re

with open('frontend/src/pages/AnalysePage.jsx', 'r') as f:
    content = f.read()

mlcard_old_pattern = r"// ─── ML Layer Card ───.*?function TechStatsStrip"
mlcard_match = re.search(mlcard_old_pattern, content, re.DOTALL)

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
              {dim.max_position && (
                <div className="rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted">Kelly Max</span>
                  <span className="font-mono text-[9px] text-white font-medium">{dim.max_position}</span>
                </div>
              )}
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

          {type === 'behaviour' && dim.flags && dim.flags.length > 0 && (
            <div className="rounded-lg p-2.5 bg-white/[0.03] border border-white/5 flex flex-col gap-1.5">
              {dim.flags.slice(0, 2).map((f, i) => {
                const parts = f.split(':')
                const title = parts[0]
                const desc = parts.slice(1).join(':')
                return (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-warn shadow-[0_0_4px_rgba(251,191,36,0.5)] flex-shrink-0" />
                      <span className="font-mono text-[8.5px] font-bold text-warn tracking-widest uppercase truncate">{title}</span>
                    </div>
                    {desc && <span className="font-mono text-[8px] text-muted/90 leading-tight pl-2.5 line-clamp-2">{desc.trim()}</span>}
                  </div>
                )
              })}
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

function TechStatsStrip"""

if mlcard_match:
    content = content.replace(mlcard_match.group(0), mlcard_new)
    with open('frontend/src/pages/AnalysePage.jsx', 'w') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Could not find MLCard block")
