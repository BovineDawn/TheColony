import { motion } from 'framer-motion'
import { useState } from 'react'
import { useColonyStore } from '../../stores/colonyStore'
import type { Agent } from '../../types/agent'
import type { Colony } from '../../types/colony'

interface FoundingWizardProps {
  onComplete: () => void
}

export function FoundingWizard({ onComplete }: FoundingWizardProps) {
  const [colonyName, setColonyName] = useState('The Colony')
  const [founderName, setFounderName] = useState('')
  const { setColony, addAgent } = useColonyStore()

  const handleFound = () => {
    if (!founderName.trim()) return

    const colony: Colony = {
      id: crypto.randomUUID(),
      name: colonyName || 'The Colony',
      foundedAt: new Date().toISOString(),
      phase: 'onboarding',
      nextEmployeeId: 2,
    }

    const founder: Agent = {
      id: 'founder-0001',
      employeeId: 1,
      name: founderName.trim(),
      role: 'Founder & CEO',
      tier: 'founder',
      department: 'executive',
      model: 'gpt-4o',
      personalityNote: 'The visionary and architect of The Colony.',
      skills: [
        { name: 'Leadership', level: 'expert' },
        { name: 'Strategy', level: 'expert' },
        { name: 'Vision', level: 'expert' },
      ],
      status: 'idle',
      hiredAt: new Date().toISOString(),
      strikes: [],
      rewards: [],
      managerId: null,
      directReports: [],
      memoryContext: '',
      isFounder: true,
      tilePosition: { x: 6, y: 0 },
    }

    setColony(colony)
    addAgent(founder)
    onComplete()
  }

  const canSubmit = founderName.trim().length > 0
  const amber = 'var(--color-amber)'
  const amberFaint = 'hsl(42 65% 52% / 0.15)'
  const amberBorder = 'hsl(42 65% 52% / 0.25)'

  return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)' }}>

      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
        zIndex: 50,
      }} />

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(hsl(42 65% 52% / 0.04) 1px, transparent 1px),
          linear-gradient(90deg, hsl(42 65% 52% / 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full"
        style={{ maxWidth: 460 }}
      >
        {/* Outer frame */}
        <div style={{
          border: `1px solid ${amberBorder}`,
          backgroundColor: 'var(--color-surface)',
          position: 'relative',
        }}>

          {/* Corner brackets */}
          {([
            { top: -1, left: -1 },
            { top: -1, right: -1 },
            { bottom: -1, left: -1 },
            { bottom: -1, right: -1 },
          ] as const).map((pos, i) => {
            const isTop = i < 2
            const isLeft = i % 2 === 0
            return (
              <div key={i} style={{
                position: 'absolute',
                ...pos,
                width: 14, height: 14,
                borderTop: isTop ? `2px solid ${amber}` : 'none',
                borderBottom: !isTop ? `2px solid ${amber}` : 'none',
                borderLeft: isLeft ? `2px solid ${amber}` : 'none',
                borderRight: !isLeft ? `2px solid ${amber}` : 'none',
                zIndex: 2,
              }} />
            )
          })}

          {/* Header band */}
          <div style={{
            backgroundColor: amberFaint,
            borderBottom: `1px solid ${amberBorder}`,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 16, height: 16,
                border: `2px solid ${amber}`,
                transform: 'rotate(45deg)',
                boxShadow: '0 0 8px hsl(42 65% 52% / 0.5)',
              }} />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                letterSpacing: '0.35em',
                color: amber,
                fontWeight: 700,
              }}>
                FOUNDING DAY
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'hsl(42 65% 52% / 0.4)',
              padding: '3px 8px',
              border: `1px solid ${amberBorder}`,
            }}>
              CLASSIFIED
            </span>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 24px 24px' }}>

            {/* Title */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                color: 'var(--color-text-primary)',
                lineHeight: 1.1,
                textTransform: 'uppercase',
              }}>
                Establish Your Colony
              </h1>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'hsl(42 65% 52% / 0.5)',
                marginTop: 8,
                letterSpacing: '0.08em',
              }}>
                EMPLOYEE <span style={{ color: amber }}>#0001</span> REGISTRATION // AUTHORIZATION REQUIRED
              </p>
            </div>

            {/* Colony name field */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <label style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.25em',
                  color: 'hsl(42 65% 52% / 0.5)',
                  textTransform: 'uppercase',
                }}>
                  Colony Designation
                </label>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  color: 'hsl(42 65% 52% / 0.3)',
                  letterSpacing: '0.1em',
                }}>FIELD-01</span>
              </div>
              <input
                value={colonyName}
                onChange={(e) => setColonyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleFound()}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: `1px solid ${amberBorder}`,
                  color: amber,
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  outline: 'none',
                  textTransform: 'uppercase',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = amber}
                onBlur={(e) => e.currentTarget.style.borderColor = amberBorder}
              />
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}>
              <div style={{ flex: 1, height: 1, backgroundColor: amberBorder }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.2em',
                color: 'hsl(42 65% 52% / 0.3)',
              }}>FOUNDER ID</span>
              <div style={{ flex: 1, height: 1, backgroundColor: amberBorder }} />
            </div>

            {/* Founder name field */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <label style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.25em',
                  color: 'hsl(42 65% 52% / 0.5)',
                  textTransform: 'uppercase',
                }}>
                  Your Name
                </label>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  color: 'hsl(42 65% 52% / 0.3)',
                  letterSpacing: '0.1em',
                }}>FIELD-02 // REQUIRED</span>
              </div>
              <input
                value={founderName}
                onChange={(e) => setFounderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleFound()}
                placeholder="Enter your name"
                autoFocus
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: `1px solid ${amberBorder}`,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = amber}
                onBlur={(e) => e.currentTarget.style.borderColor = amberBorder}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleFound}
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: canSubmit ? amber : 'transparent',
                border: `1px solid ${canSubmit ? amber : amberBorder}`,
                color: canSubmit ? 'var(--color-background)' : 'hsl(42 65% 52% / 0.3)',
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 0 30px hsl(42 65% 52% / 0.35)' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!canSubmit) return
                e.currentTarget.style.backgroundColor = 'hsl(42 65% 60%)'
                e.currentTarget.style.boxShadow = '0 0 50px hsl(42 65% 52% / 0.55)'
              }}
              onMouseLeave={(e) => {
                if (!canSubmit) return
                e.currentTarget.style.backgroundColor = amber
                e.currentTarget.style.boxShadow = '0 0 30px hsl(42 65% 52% / 0.35)'
              }}
            >
              Establish Colony
            </button>

            {/* Barcode decoration */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 20,
              justifyContent: 'center',
            }}>
              <div style={{ display: 'flex', gap: 1.5 }}>
                {Array.from({ length: 28 }, (_, i) => (
                  <div key={i} style={{
                    width: i % 3 === 0 ? 2 : 1,
                    height: i % 5 === 0 ? 14 : 10,
                    backgroundColor: 'hsl(42 65% 52% / 0.2)',
                  }} />
                ))}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                color: 'hsl(42 65% 52% / 0.2)',
                letterSpacing: '0.1em',
              }}>EMP-0001</span>
            </div>
          </div>
        </div>

        {/* Footer label */}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.2em',
          color: 'hsl(42 65% 52% / 0.25)',
          textAlign: 'center',
          marginTop: 12,
        }}>
          SURVIVAL IS OUR ONLY LAW. — THE COLONY, EST. 5500
        </p>
      </motion.div>
    </div>
  )
}
