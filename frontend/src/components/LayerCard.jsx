import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function LayerCard({ num, name, model, score, riskScore, finding, color, displayLabel }) {
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(Math.min(100, riskScore)), 100)
    return () => clearTimeout(t)
  }, [riskScore])

  const riskColor = riskScore <= 30 ? '#10d98a' : riskScore <= 55 ? '#ffffff' : riskScore <= 75 ? '#ff8c42' : '#ff4d6a'

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white/5 backdrop-blur-xl rounded-[1.5rem] p-5 relative overflow-hidden group flex flex-col transition-all duration-300 hover:bg-white/10"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-sans font-medium text-textMuted/50 tracking-wider">{num}</span>
        <span className="text-[11px] font-sans font-semibold tracking-wide text-textMain">{name}</span>
      </div>

      <div className="font-serif text-4xl mb-1 text-textMain">
        {Math.round(score)}
      </div>
      <div className="text-[10px] text-textMuted uppercase tracking-widest font-medium mb-4">
        {displayLabel} <span className="opacity-40 ml-1">· {model}</span>
      </div>

      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: riskColor }}
        />
      </div>

      <div className="text-[11px] text-textMuted leading-[1.6] font-light">
        {finding}
      </div>
    </motion.div>
  )
}
