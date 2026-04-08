import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const lines = [
  'Every great company starts with one decision.',
  'Build your Colony.',
]

interface IntroScreenProps {
  onComplete: () => void
}

export function IntroScreen({ onComplete }: IntroScreenProps) {
  const [lineIndex, setLineIndex] = useState(0)
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    if (lineIndex < lines.length - 1) {
      const t = setTimeout(() => setLineIndex((i) => i + 1), 2400)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setShowButton(true), 1600)
      return () => clearTimeout(t)
    }
  }, [lineIndex])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-10"
      style={{ backgroundColor: 'var(--color-background)' }}>

      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          opacity: 0.06,
        }}
      />

      {/* Colony logo mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="absolute top-12 flex items-center gap-3"
      >
        <div className="w-8 h-8 border-2 rotate-45"
          style={{ borderColor: 'var(--color-primary)', boxShadow: 'var(--shadow-glow-primary)' }} />
        <span className="font-heading text-sm tracking-[0.3em] uppercase"
          style={{ color: 'var(--color-primary)', opacity: 0.8 }}>
          The Colony
        </span>
      </motion.div>

      {/* Animated text */}
      <div className="relative z-10 text-center px-8">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -24, filter: 'blur(8px)' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="font-heading text-4xl max-w-xl leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {lines[lineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Begin button */}
      <AnimatePresence>
        {showButton && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            onClick={onComplete}
            className="relative z-10 px-10 py-3.5 font-heading text-base tracking-widest uppercase transition-all duration-200"
            style={{
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-glow-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              e.currentTarget.style.color = 'var(--color-background)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--color-primary)'
            }}
          >
            Begin
          </motion.button>
        )}
      </AnimatePresence>

      {/* Corner decorations */}
      {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos) => (
        <div key={pos} className={`absolute ${pos} w-6 h-6 opacity-30`}
          style={{ border: '1px solid var(--color-primary)' }} />
      ))}
    </div>
  )
}
