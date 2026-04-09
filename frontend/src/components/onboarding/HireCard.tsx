import { motion } from 'framer-motion'
import type { Agent, AIModel } from '../../types/agent'
import { departmentColors, departmentLabels } from '../../lib/departments'

interface HireCardProps {
  candidate: Partial<Agent>
  employeeNumber: number
  managerRecommendation: string
  onApprove: (candidate: Partial<Agent>) => void
  onReject: () => void
}

const modelLabels: Record<AIModel, string> = {
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'gpt-4o': 'GPT-4o',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
}

const SKILL_LEVEL_WIDTH: Record<string, string> = {
  beginner: '30%',
  intermediate: '55%',
  advanced: '78%',
  expert: '100%',
}

export function HireCard({ candidate, employeeNumber, managerRecommendation, onApprove, onReject }: HireCardProps) {
  const empId = `#${String(employeeNumber).padStart(4, '0')}`
  const deptColor = departmentColors[candidate.department!] || 'var(--color-primary)'
  const deptLabel = departmentLabels[candidate.department!] || candidate.department

  // First letter of name for mugshot
  const initial = (candidate.name || '?')[0].toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -32, scale: 0.97 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        width: '100%',
        maxWidth: 480,
        backgroundColor: 'var(--color-surface)',
        border: `1px solid hsl(42 65% 52% / 0.2)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
            borderTop: isTop ? `2px solid ${deptColor}` : 'none',
            borderBottom: !isTop ? `2px solid ${deptColor}` : 'none',
            borderLeft: isLeft ? `2px solid ${deptColor}` : 'none',
            borderRight: !isLeft ? `2px solid ${deptColor}` : 'none',
            zIndex: 10,
          }} />
        )
      })}

      {/* Department stripe — top */}
      <div style={{ height: 3, backgroundColor: deptColor, boxShadow: `0 0 12px ${deptColor}88` }} />

      {/* Header: dept label + emp ID */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        backgroundColor: `${deptColor}0D`,
        borderBottom: `1px solid hsl(42 65% 52% / 0.1)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6,
            backgroundColor: deptColor,
            borderRadius: 1,
            boxShadow: `0 0 6px ${deptColor}`,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.3em',
            color: deptColor,
            fontWeight: 600,
          }}>
            {deptLabel?.toUpperCase()}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.2em',
          color: 'hsl(42 65% 52% / 0.4)',
        }}>
          CANDIDATE {empId}
        </span>
      </div>

      {/* Main body */}
      <div style={{ display: 'flex', gap: 0 }}>

        {/* Left column: mugshot */}
        <div style={{
          width: 110,
          flexShrink: 0,
          borderRight: `1px solid hsl(42 65% 52% / 0.1)`,
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          {/* Mugshot frame */}
          <div style={{
            width: 76,
            height: 84,
            border: `1px solid hsl(42 65% 52% / 0.25)`,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${deptColor}0A`,
          }}>
            {/* Corner ticks */}
            {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((p, i) => (
              <div key={i} style={{
                position: 'absolute',
                ...p,
                width: 6, height: 6,
                borderTop: i < 2 ? `1px solid ${deptColor}` : 'none',
                borderBottom: i >= 2 ? `1px solid ${deptColor}` : 'none',
                borderLeft: i % 2 === 0 ? `1px solid ${deptColor}` : 'none',
                borderRight: i % 2 !== 0 ? `1px solid ${deptColor}` : 'none',
              }} />
            ))}
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '3rem',
              fontWeight: 900,
              color: `${deptColor}50`,
              lineHeight: 1,
            }}>
              {initial}
            </span>
            {/* Height ruler marks */}
            <div style={{
              position: 'absolute',
              right: -8,
              top: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingBlock: 4,
            }}>
              {[0,1,2,3,4].map(t => (
                <div key={t} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}>
                  <div style={{ width: t % 2 === 0 ? 5 : 3, height: 1, backgroundColor: 'hsl(42 65% 52% / 0.2)' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Model badge */}
          <div style={{
            padding: '3px 8px',
            border: `1px solid hsl(42 65% 52% / 0.2)`,
            backgroundColor: 'var(--color-surface-raised)',
            textAlign: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '7.5px',
              letterSpacing: '0.1em',
              color: 'hsl(42 65% 52% / 0.4)',
            }}>
              {candidate.model ? modelLabels[candidate.model] : candidate.model}
            </span>
          </div>

          {/* Barcode */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i} style={{
                  width: i % 3 === 0 ? 2 : 1,
                  height: i % 4 === 0 ? 16 : 11,
                  backgroundColor: `${deptColor}35`,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '7px',
              color: 'hsl(42 65% 52% / 0.2)',
              letterSpacing: '0.05em',
            }}>
              {empId.replace('#', '')}
            </span>
          </div>
        </div>

        {/* Right column: details */}
        <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Name + role */}
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.4rem',
              fontWeight: 900,
              color: 'var(--color-text-primary)',
              letterSpacing: '0.03em',
              lineHeight: 1.1,
              textTransform: 'uppercase',
            }}>
              {candidate.name}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: deptColor,
              letterSpacing: '0.15em',
              marginTop: 4,
              opacity: 0.85,
            }}>
              {candidate.role?.toUpperCase()}
            </div>
          </div>

          {/* Skills */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              letterSpacing: '0.3em',
              color: 'hsl(42 65% 52% / 0.4)',
              marginBottom: 6,
            }}>
              SKILLS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {candidate.skills?.map((skill) => (
                <div key={skill.name}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 2,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--color-text-primary)',
                    }}>
                      {skill.name}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8px',
                      color: 'hsl(42 65% 52% / 0.4)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}>
                      {skill.level}
                    </span>
                  </div>
                  <div style={{
                    height: 2,
                    backgroundColor: 'hsl(42 65% 52% / 0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: SKILL_LEVEL_WIDTH[skill.level] || '50%',
                      backgroundColor: deptColor,
                      opacity: 0.7,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'hsl(215 14% 55%)',
            lineHeight: 1.6,
            borderLeft: `2px solid hsl(42 65% 52% / 0.2)`,
            paddingLeft: 10,
          }}>
            {candidate.personalityNote}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div style={{
        margin: '0 18px',
        padding: '10px 14px',
        backgroundColor: 'var(--color-surface-raised)',
        border: `1px solid hsl(42 65% 52% / 0.12)`,
        borderLeft: `2px solid hsl(42 65% 52% / 0.35)`,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '8px',
          letterSpacing: '0.25em',
          color: 'hsl(42 65% 52% / 0.4)',
          marginBottom: 5,
        }}>
          SR. EXECUTIVE RECOMMENDATION
        </div>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'hsl(215 14% 65%)',
          lineHeight: 1.6,
        }}>
          {managerRecommendation}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 0, marginTop: 16, borderTop: `1px solid hsl(42 65% 52% / 0.1)` }}>
        <button
          onClick={() => onApprove(candidate)}
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: `${deptColor}18`,
            border: 'none',
            borderRight: `1px solid hsl(42 65% 52% / 0.1)`,
            color: deptColor,
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${deptColor}30`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${deptColor}18`}
        >
          ✓ Approve
        </button>
        <button
          onClick={onReject}
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'hsl(0 72% 51% / 0.6)',
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.08)'
            e.currentTarget.style.color = 'hsl(0 72% 60%)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'hsl(0 72% 51% / 0.6)'
          }}
        >
          ✕ New Candidate
        </button>
      </div>
    </motion.div>
  )
}
