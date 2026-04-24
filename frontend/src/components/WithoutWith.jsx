export default function WithoutWith({ symbol, score, result }) {
  const isRisky = score > 60

  const withoutItems = isRisky ? [
    `Sees ${symbol} trending on social media`,
    'Cannot verify manipulation signals',
    'Enters without checking risk-reward',
    'Walks into a potential trap',
    'Loses capital — no data backing decision',
  ] : [
    'Manual chart reading takes 30-45 mins',
    'No quantitative risk framework',
    'Cannot verify signal quality objectively',
    'Uncertain about position sizing',
    'Decision made on incomplete information',
  ]

  const withItems = isRisky ? [
    `StockX analyses ${symbol} in under 5 seconds`,
    `Score: ${Math.round(score)}/100 — risk flagged instantly`,
    `Pump detection: ${result.pump_dump.score > 50 ? 'Anomaly confirmed' : 'No anomaly'} by Isolation Forest`,
    `Monte Carlo: ${result.monte_carlo.sl_prob}% SL probability shown`,
    'Trade avoided — capital protected by AI',
  ] : [
    `StockX confirms clean setup in 4 seconds`,
    `Score: ${Math.round(score)}/100 — conditions sound`,
    `Monte Carlo: ${result.monte_carlo.target_prob}% target probability`,
    `Position size: ${result.monte_carlo.max_position} (Kelly Criterion)`,
    'Data-backed entry — confident decision',
  ]

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">⚖️</div>
        <div>
          <div className="font-serif text-2xl text-textMain tracking-tight">Without vs With StockX</div>
          <div className="text-[11px] text-textMuted uppercase tracking-widest font-medium mt-0.5">Real-world scenario comparison</div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-6">
        {/* Without */}
        <div>
          <div className="text-[11px] font-sans font-bold tracking-widest uppercase text-red mb-4 pb-3 border-b border-white/5">
            Without StockX
          </div>
          <div className="space-y-3">
            {withoutItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-red text-[11px] mt-0.5 shrink-0 opacity-70">✗</span>
                <span className="text-[12px] text-textMuted leading-relaxed font-light">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* VS */}
        <div className="flex items-center justify-center pt-8">
          <span className="font-serif italic text-2xl text-textMuted/30">VS</span>
        </div>

        {/* With */}
        <div>
          <div className="text-[11px] font-sans font-bold tracking-widest uppercase text-green mb-4 pb-3 border-b border-white/5">
            With StockX
          </div>
          <div className="space-y-3">
            {withItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-green text-[11px] mt-0.5 shrink-0 opacity-70">✓</span>
                <span className="text-[12px] text-textMain leading-relaxed font-light">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
