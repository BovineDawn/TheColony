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
  const [cursorOn, setCursorOn] = useState(true)

  useEffect(() => {
    if (lineIndex < lines.length - 1) {
      const t = setTimeout(() => setLineIndex((i) => i + 1), 2400)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setShowButton(true), 1600)
      return () => clearTimeout(t)
    }
  }, [lineIndex])

  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  const bracketColor = 'hsl(42 65% 52% / 0.35)'

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)', overflow: 'hidden' }}>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)',
        zIndex: 50,
      }} />

      {/* Amber grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(hsl(42 65% 52% / 0.05) 1px, transparent 1px),
          linear-gradient(90deg, hsl(42 65% 52% / 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4"
        style={{ borderBottom: '1px solid hsl(42 65% 52% / 0.12)' }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 20, height: 20,
            border: '2px solid var(--color-amber)',
            transform: 'rotate(45deg)',
            boxShadow: '0 0 12px hsl(42 65% 52% / 0.5)',
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            letterSpacing: '0.35em',
            color: 'var(--color-amber)',
            fontWeight: 700,
          }}>
            THE COLONY
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.2em',
          color: 'hsl(42 65% 52% / 0.3)',
        }}>
          SYS-BOOT v5.5.00 // EST. 5500
        </span>
      </div>

      {/* Corner brackets */}
      {([
        { top: 72, left: 32 },
        { top: 72, right: 32 },
        { bottom: 48, left: 32 },
        { bottom: 48, right: 32 },
      ] as const).map((pos, i) => {
        const isTop = i < 2
        const isLeft = i % 2 === 0
        return (
          <div key={i} style={{
            position: 'absolute',
            ...pos,
            width: 24, height: 24,
            borderTop: isTop ? `2px solid ${bracketColor}` : 'none',
            borderBottom: !isTop ? `2px solid ${bracketColor}` : 'none',
            borderLeft: isLeft ? `2px solid ${bracketColor}` : 'none',
            borderRight: !isLeft ? `2px solid ${bracketColor}` : 'none',
          }} />
        )
      })}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-10">

        {/* THE COLONY wordmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.5rem, 10vw, 7.5rem)',
            fontWeight: 900,
            letterSpacing: '0.22em',
            color: 'var(--color-amber)',
            textShadow: '0 0 80px hsl(42 65% 52% / 0.35)',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}>
            THE COLONY
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.45em',
            color: 'hsl(42 65% 52% / 0.35)',
            marginTop: 10,
          }}>
            ──────────────────────────────────
          </div>
        </motion.div>

        {/* Animated tagline */}
        <div style={{ minHeight: '2rem', textAlign: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={lineIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                letterSpacing: '0.08em',
                color: 'hsl(42 65% 52% / 0.65)',
              }}
            >
              {lines[lineIndex]}
              <span style={{ opacity: cursorOn ? 1 : 0, marginLeft: 1 }}>_</span>
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Begin button */}
        <AnimatePresence>
          {showButton && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              onClick={onComplete}
              style={{
                padding: '13px 52px',
                fontFamily: 'var(--font-display)',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
                color: 'var(--color-background)',
                backgroundColor: 'var(--color-amber)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 40px hsl(42 65% 52% / 0.45), 0 0 80px hsl(42 65% 52% / 0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 60px hsl(42 65% 52% / 0.7), 0 0 100px hsl(42 65% 52% / 0.25)'
                e.currentTarget.style.backgroundColor = 'hsl(42 65% 60%)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 40px hsl(42 65% 52% / 0.45), 0 0 80px hsl(42 65% 52% / 0.15)'
                e.currentTarget.style.backgroundColor = 'var(--color-amber)'
              }}
            >
              Begin
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-3"
        style={{ borderTop: '1px solid hsl(42 65% 52% / 0.12)' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.25em',
          color: 'hsl(42 65% 52% / 0.25)',
        }}>
          SURVIVAL IS OUR ONLY LAW.
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.2em',
          color: 'hsl(42 65% 52% / 0.25)',
        }}>
          SECURE // CLASSIFIED // AUTHORIZED
        </span>
      </div>
    </div>
  )
}
