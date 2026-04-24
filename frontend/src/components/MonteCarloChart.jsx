import { useEffect, useRef } from 'react'

export default function MonteCarloChart({ paths, targetProb, slProb, maxPosition }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !paths?.length) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width / 2
    const H = canvas.height / 2
    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.01)'
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (H / 4) * i)
      ctx.lineTo(W, (H / 4) * i)
      ctx.stroke()
    }

    const midY = H * 0.45
    const spread = H * 0.35

    // Find price range for normalization
    const allPrices = paths.flatMap(p => p.prices)
    const minP = Math.min(...allPrices)
    const maxP = Math.max(...allPrices)
    const priceRange = maxP - minP + 1

    // Draw paths
    paths.slice(0, 60).forEach(path => {
      const isGreen = path.outcome === 'target'
      ctx.beginPath()
      ctx.strokeStyle = isGreen ? `rgba(16,217,138,0.25)` : `rgba(255,77,106,0.2)`
      ctx.lineWidth = 1.2

      path.prices.forEach((p, i) => {
        const x = (i / (path.prices.length - 1)) * W
        const y = H - ((p - minP) / priceRange) * H * 0.85 - H * 0.05
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })

    // Entry line (first price)
    const entryY = H - ((paths[0]?.prices[0] - minP) / priceRange) * H * 0.85 - H * 0.05
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.moveTo(0, entryY)
    ctx.lineTo(28, entryY)
    ctx.stroke()
    ctx.setLineDash([])

    // Labels
    ctx.font = `${9 * 2}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('Entry', 2 * 2, (entryY - 3) * 2)

    ctx.fillStyle = 'rgba(16,217,138,0.9)'
    ctx.fillText(`↑ Target ${targetProb}%`, (W - 70) * 2, 12 * 2)

    ctx.fillStyle = 'rgba(255,77,106,0.9)'
    ctx.fillText(`↓ SL ${slProb}%`, (W - 55) * 2, (H - 4) * 2)

  }, [paths, targetProb, slProb])

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">📊</div>
        <div>
          <div className="font-serif text-2xl text-textMain tracking-tight">Monte Carlo Simulation</div>
          <div className="text-[11px] text-textMuted uppercase tracking-widest font-medium mt-0.5">10,000 simulated price paths · GBM model</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={320}
        className="w-full rounded-xl mix-blend-screen"
        style={{ height: '160px' }}
      />

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white/5 rounded-2xl p-4 text-center">
          <div className="font-serif text-3xl text-green mb-1">{targetProb}%</div>
          <div className="text-[10px] text-textMuted uppercase tracking-widest font-medium">Hit Target</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 text-center">
          <div className="font-serif text-3xl text-red mb-1">{slProb}%</div>
          <div className="text-[10px] text-textMuted uppercase tracking-widest font-medium">Hit Stop Loss</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 text-center">
          <div className="font-serif text-2xl text-textMain mb-1 leading-[1.3]">{maxPosition}</div>
          <div className="text-[10px] text-textMuted uppercase tracking-widest font-medium">Kelly Position</div>
        </div>
      </div>
    </div>
  )
}
