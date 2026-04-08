import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, ChevronDown, ChevronUp,
  Cpu, CheckCircle, Zap,
} from 'lucide-react'
import { useLDStore } from '../../stores/ldStore'
import { connectSocket } from '../../lib/api'
import type { LDLogEntry } from '../../stores/ldStore'

const LOG_PAGE_SIZE = 6

function extractAssessment(message: string): string {
  const lines = message.split('\n')
  const assessLine = lines.find(l => l.toUpperCase().includes('ASSESSMENT'))
  if (assessLine) return assessLine.replace(/^[^:]*:\s*/i, '').trim()
  // fallback: first non-empty line
  return lines.find(l => l.trim()) || message
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatRelative(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch {
    return ''
  }
}

function LogIcon({ type }: { type: LDLogEntry['type'] }) {
  const size = 11
  switch (type) {
    case 'start':        return <Cpu size={size} style={{ color: 'var(--color-primary)' }} />
    case 'reviewing':    return <GraduationCap size={size} style={{ color: 'var(--color-amber)' }} />
    case 'reviewed':     return <CheckCircle size={size} style={{ color: '#10B981' }} />
    case 'skill_update': return <Zap size={size} style={{ color: '#7C3AED' }} />
    case 'complete':     return <CheckCircle size={size} style={{ color: '#10B981' }} />
    case 'error':        return <Cpu size={size} style={{ color: 'var(--color-danger, #EF4444)' }} />
    default:             return <Cpu size={size} style={{ color: 'var(--color-text-dim)' }} />
  }
}

export function LDActivityOverlay() {
  const { isRunning, lastRun, currentAgent, logs, stats } = useLDStore()
  const [collapsed, setCollapsed] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Hide if nothing to show
  if (logs.length === 0 && !isRunning) return null

  const visibleLogs = showAll ? logs : logs.slice(0, LOG_PAGE_SIZE)

  const boxShadow = isRunning
    ? '0 0 20px hsl(42 65% 52% / 0.25), 0 4px 24px rgba(0,0,0,0.6)'
    : '0 4px 24px rgba(0,0,0,0.5)'

  function handleRunNow() {
    const socket = connectSocket()
    socket.emit('run_ld')
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 320,
        zIndex: 20,
        border: '1px solid var(--color-amber-dim, hsl(42 65% 52% / 0.25))',
        backgroundColor: 'hsl(215 22% 7%)',
        borderRadius: 4,
        boxShadow,
        overflow: 'hidden',
        fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
      }}
    >
      {/* ── Header ── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid hsl(42 65% 52% / 0.15)',
          backgroundColor: 'hsl(215 22% 9%)',
          userSelect: 'none',
        }}
      >
        {/* Pulsing dot when running */}
        {isRunning && (
          <span
            className="animate-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--color-amber, hsl(42 65% 52%))',
              boxShadow: '0 0 6px hsl(42 65% 52% / 0.8)',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
        )}

        <GraduationCap size={13} style={{ color: 'var(--color-amber, hsl(42 65% 52%))', flexShrink: 0 }} />

        <span
          style={{
            fontFamily: 'var(--font-display, Rajdhani, sans-serif)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--color-amber, hsl(42 65% 52%))',
            flex: 1,
          }}
        >
          L&D AUTOPILOT
        </span>

        {isRunning && (
          <span
            style={{
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: 'var(--color-amber, hsl(42 65% 52%))',
              backgroundColor: 'hsl(42 65% 52% / 0.12)',
              border: '1px solid hsl(42 65% 52% / 0.3)',
              borderRadius: 3,
              padding: '1px 5px',
            }}
          >
            RUNNING
          </span>
        )}

        {!isRunning && (
          <button
            onClick={e => { e.stopPropagation(); handleRunNow() }}
            style={{
              fontSize: '9px',
              letterSpacing: '0.08em',
              color: 'var(--color-primary, cyan)',
              backgroundColor: 'hsl(189 100% 50% / 0.08)',
              border: '1px solid hsl(189 100% 50% / 0.25)',
              borderRadius: 3,
              padding: '2px 7px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            RUN NOW
          </button>
        )}

        {collapsed
          ? <ChevronDown size={12} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
          : <ChevronUp size={12} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
        }
      </div>

      {/* ── Collapsible body ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Currently reviewing bar */}
            {currentAgent && (
              <div
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'hsl(42 65% 52% / 0.08)',
                  borderBottom: '1px solid hsl(42 65% 52% / 0.15)',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: 'var(--color-amber, hsl(42 65% 52%))',
                }}
              >
                CURRENTLY REVIEWING: {currentAgent.toUpperCase()}
              </div>
            )}

            {/* Stats row — only when running */}
            {isRunning && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  borderBottom: '1px solid hsl(42 65% 52% / 0.1)',
                }}
              >
                {[
                  { label: 'REVIEWED', value: stats.reviewed },
                  { label: 'TRAINING', value: stats.trainingPlans },
                  { label: 'SKILLS',   value: stats.skillUpdates },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      padding: '7px 0',
                      textAlign: 'center',
                      borderRight: '1px solid hsl(42 65% 52% / 0.1)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display, Rajdhani)',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--color-amber, hsl(42 65% 52%))',
                        lineHeight: 1,
                      }}
                    >
                      {value}
                    </div>
                    <div
                      style={{
                        fontSize: '8px',
                        letterSpacing: '0.08em',
                        color: 'var(--color-text-dim)',
                        marginTop: 2,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Log feed */}
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {visibleLogs.map(entry => {
                const msg = entry.type === 'reviewed'
                  ? extractAssessment(entry.message)
                  : entry.message
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 7,
                      padding: '6px 12px',
                      borderBottom: '1px solid hsl(215 22% 12%)',
                    }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1 }}>
                      <LogIcon type={entry.type} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {entry.agentName && (
                        <span
                          style={{
                            fontSize: '10px',
                            letterSpacing: '0.06em',
                            color: 'var(--color-amber, hsl(42 65% 52%))',
                            marginRight: 4,
                          }}
                        >
                          {entry.agentName}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-text-dim)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {msg}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        color: 'hsl(215 20% 40%)',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {formatTs(entry.timestamp)}
                    </span>
                  </div>
                )
              })}

              {logs.length > LOG_PAGE_SIZE && (
                <div style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => setShowAll(v => !v)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary, cyan)',
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {showAll ? 'SHOW LESS' : `SHOW MORE (${logs.length - LOG_PAGE_SIZE})`}
                  </button>
                </div>
              )}
            </div>

            {/* Footer — idle only */}
            {!isRunning && lastRun && (
              <div
                style={{
                  padding: '6px 12px',
                  borderTop: '1px solid hsl(215 22% 11%)',
                  fontSize: '9px',
                  letterSpacing: '0.08em',
                  color: 'hsl(215 20% 40%)',
                }}
              >
                LAST RUN: {formatRelative(lastRun)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
