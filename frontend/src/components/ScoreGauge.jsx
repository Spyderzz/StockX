import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function ScoreGauge({ score, color }) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    let frame
    let current = 0
    const step = () => {
      current = Math.min(current + 1.5, score)
      setAnimated(Math.round(current))
      if (current < score) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [score])

  // Arc math: semicircle, 220px total length
  const totalLength = 220
  const offset = totalLength - (animated / 100) * totalLength

  // Zone color
  const gaugeColor = animated <= 30 ? '#10d98a' : animated <= 55 ? '#ffffff' : animated <= 75 ? '#ff8c42' : '#ff4d6a'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-48 h-24">
        {/* Track */}
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round"/>

        {/* Animated fill */}
        <motion.path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={totalLength}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.05s, stroke 0.3s' }}
        />
      </svg>

      <div className="font-serif text-6xl leading-none mt-4 text-textMain">
        {animated}
      </div>
      <div className="text-[10px] text-textMuted uppercase tracking-widest font-medium mt-2">
        Decision Quality Score
      </div>
    </div>
  )
}
