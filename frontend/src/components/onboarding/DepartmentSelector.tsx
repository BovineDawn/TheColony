import { motion } from 'framer-motion'
import { useState } from 'react'
import type { Department } from '../../types/agent'

interface DeptConfig {
  department: Department
  label: string
  role: string
  candidate: string
  color: string
  description: string
}

const OPTIONAL_DEPTS: DeptConfig[] = [
  {
    department: 'engineering',
    label: 'ENGINEERING',
    role: 'Head of Engineering',
    candidate: 'FORGE',
    color: 'hsl(199 89% 48%)',
    description: 'Builds systems, reviews code, owns architecture',
  },
  {
    department: 'research',
    label: 'RESEARCH',
    role: 'Head of Research',
    candidate: 'LYRA',
    color: 'hsl(262 52% 47%)',
    description: 'Deep research, synthesis, competitive intelligence',
  },
  {
    department: 'writing',
    label: 'WRITING',
    role: 'Head of Writing',
    candidate: 'VERSE',
    color: 'hsl(145 63% 42%)',
    description: 'Content strategy, long-form copy, editorial review',
  },
  {
    department: 'legal',
    label: 'LEGAL',
    role: 'Head of Legal',
    candidate: 'LEXIS',
    color: 'hsl(24 100% 50%)',
    description: 'Risk assessment, compliance, contract analysis',
  },
  {
    department: 'ld',
    label: 'L&D',
    role: 'Head of Learning & Development',
    candidate: 'NOVA',
    color: 'hsl(330 65% 52%)',
    description: 'Autonomous performance review, skill development',
  },
]

interface DepartmentSelectorProps {
  onComplete: (selectedDepts: Department[]) => void
}

export function DepartmentSelector({ onComplete }: DepartmentSelectorProps) {
  const [selected, setSelected] = useState<Set<Department>>(
    new Set(OPTIONAL_DEPTS.map(d => d.department))
  )

  const toggle = (dept: Department) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  const handleContinue = () => {
    // Executive is always included
    onComplete(['executive', ...OPTIONAL_DEPTS.filter(d => selected.has(d.department)).map(d => d.department)])
  }

  const amber = 'var(--color-amber)'
  const amberBorder = 'hsl(42 65% 52% / 0.25)'

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)', overflow: 'hidden' }}>

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
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full"
        style={{ maxWidth: 560, padding: '0 16px' }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 14, height: 14,
              border: `2px solid ${amber}`,
              transform: 'rotate(45deg)',
              boxShadow: '0 0 10px hsl(42 65% 52% / 0.5)',
            }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              letterSpacing: '0.35em',
              color: amber,
              fontWeight: 700,
            }}>
              DEPARTMENT AUTHORIZATION
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            color: 'var(--color-text-primary)',
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}>
            Build Your Command Structure
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'hsl(42 65% 52% / 0.45)',
            marginTop: 8,
            letterSpacing: '0.1em',
          }}>
            Select which departments to activate. Each will field one founding head.
          </p>
        </div>

        {/* Executive — always included */}
        <div style={{
          padding: '12px 16px',
          marginBottom: 8,
          border: `1px solid hsl(42 65% 52% / 0.35)`,
          backgroundColor: 'hsl(42 65% 52% / 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 8, height: 8,
              backgroundColor: amber,
              boxShadow: `0 0 8px ${amber}`,
            }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: amber,
                }}>EXECUTIVE</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'hsl(42 65% 52% / 0.5)',
                  letterSpacing: '0.1em',
                  padding: '1px 5px',
                  border: `1px solid hsl(42 65% 52% / 0.2)`,
                }}>REQUIRED</span>
              </div>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'hsl(215 14% 55%)',
                marginTop: 2,
              }}>
                Sr. Executive · Mission routing, delegation, final reports
              </p>
            </div>
          </div>
          <div style={{
            width: 20, height: 20,
            border: `2px solid ${amber}`,
            backgroundColor: amber,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: 'var(--color-background)', fontSize: 11, fontWeight: 900 }}>✓</span>
          </div>
        </div>

        {/* Optional departments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {OPTIONAL_DEPTS.map((dept, i) => {
            const isSelected = selected.has(dept.department)
            return (
              <motion.button
                key={dept.department}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggle(dept.department)}
                style={{
                  padding: '12px 16px',
                  border: `1px solid ${isSelected ? `${dept.color}55` : 'hsl(42 65% 52% / 0.1)'}`,
                  backgroundColor: isSelected ? `${dept.color}0D` : 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 8, height: 8,
                    backgroundColor: isSelected ? dept.color : 'hsl(42 65% 52% / 0.15)',
                    boxShadow: isSelected ? `0 0 8px ${dept.color}` : 'none',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        color: isSelected ? dept.color : 'hsl(215 14% 45%)',
                        transition: 'color 0.15s',
                      }}>
                        {dept.label}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: isSelected ? `${dept.color}99` : 'hsl(42 65% 52% / 0.25)',
                        letterSpacing: '0.1em',
                      }}>
                        {dept.candidate}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: isSelected ? 'hsl(215 14% 55%)' : 'hsl(215 14% 35%)',
                      marginTop: 2,
                      transition: 'color 0.15s',
                    }}>
                      {dept.description}
                    </p>
                  </div>
                </div>

                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20,
                  border: `2px solid ${isSelected ? dept.color : 'hsl(42 65% 52% / 0.2)'}`,
                  backgroundColor: isSelected ? dept.color : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                  {isSelected && (
                    <span style={{ color: 'var(--color-background)', fontSize: 11, fontWeight: 900 }}>✓</span>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Status + Continue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'hsl(42 65% 52% / 0.4)',
            letterSpacing: '0.1em',
            flex: 1,
          }}>
            {selected.size + 1} DEPT{selected.size + 1 !== 1 ? 'S' : ''} · {selected.size + 1} FOUNDING HEAD{selected.size + 1 !== 1 ? 'S' : ''}
          </span>
          <button
            onClick={handleContinue}
            style={{
              padding: '12px 32px',
              backgroundColor: amber,
              border: 'none',
              color: 'var(--color-background)',
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 0 25px hsl(42 65% 52% / 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(42 65% 60%)'
              e.currentTarget.style.boxShadow = '0 0 40px hsl(42 65% 52% / 0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = amber
              e.currentTarget.style.boxShadow = '0 0 25px hsl(42 65% 52% / 0.4)'
            }}
          >
            Begin Founding Review
          </button>
        </div>
      </motion.div>
    </div>
  )
}
