import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertCircle, MessageSquare, GitBranch, UserPlus, Map,
  Activity, TrendingUp, CheckCircle2, Zap, GraduationCap,
  Users, ChevronRight, ChevronDown, Award, Radio, Cpu,
  Shield, Wifi, WifiOff,
} from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useUIStore } from '../../stores/uiStore'
import { useHRStore } from '../../stores/hrStore'
import { useActivityStore } from '../../stores/activityStore'
import { useLDStore } from '../../stores/ldStore'
import { departmentColors, departmentLabels } from '../../lib/departments'
import { getModelLabel } from '../../lib/models'
import { connectSocket, api } from '../../lib/api'
import type { Department } from '../../types/agent'

const DEPT_ORDER: Department[] = ['engineering', 'research', 'writing', 'legal', 'ld']

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

const ACTIVITY_ICONS: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  mission_complete: MessageSquare,
  mission_start:    Radio,
  agent_hired:      UserPlus,
  strike_issued:    AlertCircle,
  reward_granted:   Award,
  training_start:   GraduationCap,
  promotion:        TrendingUp,
}

const ACTIVITY_COLORS: Record<string, string> = {
  mission_complete: 'var(--color-primary)',
  mission_start:    'var(--color-primary)',
  agent_hired:      'var(--color-success)',
  strike_issued:    'var(--color-danger)',
  reward_granted:   'var(--color-amber)',
  training_start:   '#EC4899',
  promotion:        'var(--color-amber)',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 16, height: 1, backgroundColor: 'var(--color-border)' }} />
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: '8px',
        letterSpacing: '0.2em', color: 'var(--color-text-dim)',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {children}
      </p>
      <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function MorningBriefing() {
  const { colony, agents, missions } = useColonyStore()
  const { setActiveView }            = useUIStore()
  const { hiringRecs, strikes, trainingSessions } = useHRStore()
  const { events: activityEvents }   = useActivityStore()
  const ldStore = useLDStore()
  const [backendOnline, setBackendOnline] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const clock = useClock()

  React.useEffect(() => {
    api.get('/health')
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  const founderName    = agents.find(a => a.isFounder)?.name || 'Founder'
  const executive      = agents.find(a => a.tier === 'executive' && !a.isFounder)

  const pendingHires   = hiringRecs.filter(h => h.status === 'pending').length
  const activeTraining = trainingSessions.filter(t => ['scheduled','active'].includes(t.status)).length
  const openStrikes    = strikes.filter(s => !s.resolved).length
  const activeMissions = missions.filter(m => m.status === 'in_progress').length
  const activeAgents   = agents.filter(a => ['working','thinking','chatting'].includes(a.status)).length

  const founders   = agents.filter(a => a.isFounder).length
  const executives = agents.filter(a => a.tier === 'executive' && !a.isFounder).length
  const managers   = agents.filter(a => a.tier === 'manager').length
  const workers    = agents.filter(a => a.tier === 'worker').length

  const healthDeductions = openStrikes * 12 + (pendingHires > 2 ? 10 : 0) + activeTraining * 5
  const healthScore = Math.max(0, Math.min(100, 100 - healthDeductions))
  const healthColor = healthScore >= 90 ? 'hsl(142 76% 53%)'
    : healthScore >= 70 ? 'var(--color-primary)'
    : healthScore >= 50 ? 'var(--color-warning)'
    : 'var(--color-danger)'
  const healthLabel = healthScore >= 90 ? 'OPTIMAL'
    : healthScore >= 70 ? 'NOMINAL'
    : healthScore >= 50 ? 'DEGRADED'
    : 'CRITICAL'

  const triggerLD = () => {
    const socket = connectSocket()
    socket.emit('run_ld', {})
  }

  const STATS = [
    { label: 'COLONISTS', value: agents.length,   icon: Users,        color: 'var(--color-text-muted)', activeColor: 'var(--color-primary)' },
    { label: 'ACTIVE',    value: activeAgents,     icon: Activity,     color: 'var(--color-text-dim)',   activeColor: 'hsl(142 76% 53%)' },
    { label: 'MISSIONS',  value: activeMissions,   icon: Radio,        color: 'var(--color-text-dim)',   activeColor: 'var(--color-primary)' },
    { label: 'STRIKES',   value: openStrikes,      icon: AlertCircle,  color: 'var(--color-text-dim)',   activeColor: 'var(--color-danger)' },
    { label: 'TRAINING',  value: activeTraining,   icon: Zap,          color: 'var(--color-text-dim)',   activeColor: '#EC4899' },
    { label: 'PENDING',   value: pendingHires,     icon: CheckCircle2, color: 'var(--color-text-dim)',   activeColor: 'var(--color-warning)' },
  ]

  const timeStr = clock.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--color-background)', display: 'flex', flexDirection: 'column' }}>

      {/* ══════════════════════════════════════
          HQ HEADER
      ══════════════════════════════════════ */}
      <div style={{
        position: 'relative', overflow: 'hidden', flexShrink: 0,
        borderBottom: '1px solid var(--color-border)',
        background: 'linear-gradient(180deg, hsl(215 28% 7%) 0%, var(--color-background) 100%)',
      }}>
        {/* Corner accent lines */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 60, height: 60, pointerEvents: 'none',
          borderTop: '1px solid hsl(189 100% 50% / 0.2)',
          borderLeft: '1px solid hsl(189 100% 50% / 0.2)',
        }} />
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 60, height: 60, pointerEvents: 'none',
          borderTop: '1px solid hsl(189 100% 50% / 0.2)',
          borderRight: '1px solid hsl(189 100% 50% / 0.2)',
        }} />

        <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>

          {/* Left: Colony designation */}
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              letterSpacing: '0.28em', color: 'var(--color-primary)',
              marginBottom: 5, opacity: 0.7,
            }}>
              COLONY HEADQUARTERS
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.6rem',
              fontWeight: 700, lineHeight: 1.05, letterSpacing: '0.06em',
              color: 'var(--color-text-primary)',
            }}>
              {colony?.name || 'THE COLONY'}
            </h1>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: 'var(--color-text-dim)', marginTop: 5, letterSpacing: '0.1em',
            }}>
              CMD {founderName.toUpperCase()}
              {executive && (
                <span style={{ color: 'var(--color-text-dim)', opacity: 0.6 }}>
                  {' '}· XO {executive.name.toUpperCase()}
                </span>
              )}
            </p>
          </div>

          {/* Center: Colony health */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '7.5px',
              letterSpacing: '0.2em', color: 'var(--color-text-dim)', marginBottom: 8,
            }}>
              COLONY STATUS
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '1.8rem',
                fontWeight: 700, color: healthColor, lineHeight: 1,
                textShadow: `0 0 24px ${healthColor}55`,
              }}>
                {healthScore}
              </span>
              <div>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '8px',
                  letterSpacing: '0.14em', color: healthColor, lineHeight: 1,
                }}>
                  {healthLabel}
                </p>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '7px',
                  color: 'var(--color-text-dim)', letterSpacing: '0.1em', marginTop: 2,
                }}>
                  / 100
                </p>
              </div>
            </div>
            {/* Health bar */}
            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < Math.round(healthScore / 10)
                return (
                  <div key={i} style={{
                    width: 14, height: 3, borderRadius: 1,
                    backgroundColor: filled ? healthColor : 'var(--color-border)',
                    opacity: filled ? 1 : 0.3,
                    boxShadow: filled ? `0 0 4px ${healthColor}88` : 'none',
                    transition: 'all 0.3s',
                  }} />
                )
              })}
            </div>
          </div>

          {/* Right: Clock + connection */}
          <div style={{ textAlign: 'right', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
              {backendOnline
                ? <Wifi size={9} style={{ color: 'hsl(142 76% 53%)' }} />
                : <WifiOff size={9} style={{ color: 'var(--color-danger)' }} />
              }
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '8px',
                letterSpacing: '0.12em',
                color: backendOnline ? 'hsl(142 76% 53%)' : 'var(--color-danger)',
              }}>
                {backendOnline ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '1.3rem',
              fontWeight: 700, color: 'var(--color-text-primary)',
              letterSpacing: '0.05em', lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {timeStr}
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              color: 'var(--color-text-dim)', letterSpacing: '0.14em',
              marginTop: 4,
            }}>
              {dateStr}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SYSTEM STATUS STRIP
      ══════════════════════════════════════ */}
      <div style={{
        display: 'flex', flexShrink: 0,
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        {STATS.map(({ label, value, icon: Icon, color, activeColor }, i) => {
          const isActive = value > 0
          const displayColor = isActive ? activeColor : color
          return (
            <div key={label} style={{
              flex: 1, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderRight: i < STATS.length - 1 ? '1px solid var(--color-border)' : 'none',
              borderTop: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
              transition: 'border-color 0.3s',
              backgroundColor: isActive ? `${activeColor}06` : 'transparent',
            }}>
              <Icon size={11} style={{ color: displayColor, flexShrink: 0 }} />
              <div>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '1.15rem',
                  fontWeight: 700, lineHeight: 1,
                  color: isActive ? displayColor : 'var(--color-text-primary)',
                  textShadow: isActive ? `0 0 12px ${activeColor}66` : 'none',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'all 0.3s',
                }}>
                  {value}
                </p>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '6.5px',
                  letterSpacing: '0.16em', color: 'var(--color-text-dim)', marginTop: 2,
                }}>
                  {label}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ══════════════════════════════════════
          ALERT STRIP (conditional)
      ══════════════════════════════════════ */}
      {(openStrikes > 0 || pendingHires > 0 || activeTraining > 0) && (
        <div style={{
          display: 'flex', gap: 6, padding: '7px 32px',
          backgroundColor: 'hsl(215 20% 7%)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          {pendingHires > 0 && (
            <button onClick={() => setActiveView('hiring')} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 2, cursor: 'pointer',
              backgroundColor: 'hsl(38 90% 52% / 0.08)',
              border: '1px solid hsl(38 90% 52% / 0.3)',
              color: 'var(--color-warning)',
              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'hsl(38 90% 52% / 0.15)'
              e.currentTarget.style.borderColor = 'hsl(38 90% 52% / 0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'hsl(38 90% 52% / 0.08)'
              e.currentTarget.style.borderColor = 'hsl(38 90% 52% / 0.3)'
            }}>
              <Bell size={8} />
              {pendingHires} HIRE{pendingHires > 1 ? 'S' : ''} PENDING
              <ChevronRight size={8} />
            </button>
          )}
          {openStrikes > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 2,
              backgroundColor: 'hsl(0 70% 52% / 0.08)',
              border: '1px solid hsl(0 70% 52% / 0.3)',
              color: 'var(--color-danger)',
              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em',
            }}>
              <AlertCircle size={8} />
              {openStrikes} UNRESOLVED STRIKE{openStrikes > 1 ? 'S' : ''}
            </div>
          )}
          {activeTraining > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 2,
              backgroundColor: 'hsl(330 55% 52% / 0.08)',
              border: '1px solid hsl(330 55% 52% / 0.3)',
              color: '#EC4899',
              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em',
            }}>
              <GraduationCap size={8} />
              {activeTraining} IN TRAINING
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          MAIN BODY
      ══════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{
          flex: '1 1 0%',
          padding: '22px 28px',
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
        }}>

          {/* Unit Roster */}
          <SectionLabel>Unit Roster</SectionLabel>

          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 24,
          }}>
            {DEPT_ORDER.map((dept, idx) => {
              const deptAgents  = agents.filter(a => a.department === dept)
              const manager     = deptAgents.find(a => a.tier === 'manager')
              const activeCount = deptAgents.filter(a => ['working','thinking','chatting'].includes(a.status)).length
              const inTraining  = deptAgents.filter(a => a.status === 'training').length
              const hasIssue    = deptAgents.some(a => (a.strikes || []).some((s: any) => !s.resolved))
              const color       = departmentColors[dept]

              const statusColor = inTraining > 0 ? '#EC4899'
                : activeCount > 0 ? 'hsl(142 76% 53%)'
                : hasIssue ? 'var(--color-danger)'
                : 'hsl(215 14% 30%)'

              const statusLabel = inTraining > 0 ? `${inTraining} TRAINING`
                : activeCount > 0 ? `${activeCount} ACTIVE`
                : hasIssue ? 'ISSUE'
                : 'STANDBY'

              const isExpanded = expandedDept === dept

              return (
                <motion.div
                  key={dept}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  style={{
                    borderBottom: idx < DEPT_ORDER.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {/* Dept header row */}
                  <div
                    onClick={() => setExpandedDept(isExpanded ? null : dept)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: isExpanded ? `${color}08` : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s',
                      borderLeft: `2px solid ${isExpanded ? color : 'transparent'}`,
                    }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-raised)' }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)' }}
                  >
                    {/* Dept name */}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      letterSpacing: '0.18em', color,
                      width: 96, flexShrink: 0,
                    }}>
                      {departmentLabels[dept].toUpperCase()}
                    </span>

                    {/* Manager name */}
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '0.95rem',
                      fontWeight: 700, color: 'var(--color-text-primary)',
                      flex: '0 0 110px', letterSpacing: '0.03em',
                    }}>
                      {manager?.name || '—'}
                    </span>

                    {/* Role */}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      color: 'var(--color-text-dim)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {manager?.role || 'Unassigned'}
                    </span>

                    {/* Agent count */}
                    <div style={{
                      marginRight: 12, flexShrink: 0,
                      padding: '2px 7px', borderRadius: 2,
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border)',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '8px',
                        color: 'var(--color-text-muted)',
                      }}>
                        {deptAgents.length}
                      </span>
                    </div>

                    {hasIssue && (
                      <AlertCircle size={10} style={{ color: 'var(--color-danger)', marginRight: 8, flexShrink: 0 }} />
                    )}

                    {/* Status pill */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                      backgroundColor: `${statusColor}12`,
                      border: `1px solid ${statusColor}35`,
                      marginRight: 10,
                    }}>
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        backgroundColor: statusColor,
                        boxShadow: (activeCount > 0 || inTraining > 0) ? `0 0 5px ${statusColor}` : 'none',
                        animation: (activeCount > 0 || inTraining > 0) ? 'breathe 1.5s ease-in-out infinite' : 'none',
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                        letterSpacing: '0.1em', color: statusColor,
                      }}>
                        {statusLabel}
                      </span>
                    </div>

                    {isExpanded
                      ? <ChevronDown size={11} style={{ color, flexShrink: 0 }} />
                      : <ChevronRight size={11} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
                    }
                  </div>

                  {/* Expanded agent list */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden', backgroundColor: 'hsl(215 22% 8%)' }}
                      >
                        {deptAgents.map((agent, ai) => {
                          const agentEvents = activityEvents
                            .filter(e => e.agentName === agent.name)
                            .slice(0, 5)

                          const isActive = ['working', 'thinking', 'chatting'].includes(agent.status)
                          const isTraining = agent.status === 'training'

                          const dotColor = isTraining ? '#EC4899'
                            : isActive ? 'hsl(142 76% 53%)'
                            : agent.status === 'terminated' ? 'var(--color-danger)'
                            : 'hsl(215 14% 30%)'

                          return (
                            <div
                              key={agent.id}
                              style={{
                                borderTop: '1px solid hsl(215 22% 12%)',
                                padding: '10px 14px 10px 28px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: agentEvents.length > 0 ? 7 : 0 }}>
                                <div style={{
                                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                  backgroundColor: dotColor,
                                  boxShadow: (isActive || isTraining) ? `0 0 6px ${dotColor}` : 'none',
                                }} />
                                <span style={{
                                  fontFamily: 'var(--font-display)', fontSize: '13px',
                                  fontWeight: 700, color: 'var(--color-text-primary)',
                                  letterSpacing: '0.05em', flex: '0 0 auto',
                                }}>
                                  {agent.name}
                                </span>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '8px',
                                  color: 'var(--color-text-dim)', flex: 1,
                                  letterSpacing: '0.06em',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {agent.role}
                                </span>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '7px',
                                  letterSpacing: '0.12em', color: dotColor,
                                  padding: '1px 6px',
                                  border: `1px solid ${dotColor}44`,
                                  borderRadius: 2, flexShrink: 0,
                                }}>
                                  {agent.status?.toUpperCase() || 'IDLE'}
                                </span>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '7px',
                                  color: 'var(--color-text-dim)', letterSpacing: '0.06em', flexShrink: 0,
                                }}>
                                  {getModelLabel(agent.model)}
                                </span>
                              </div>

                              {agentEvents.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 16 }}>
                                  {agentEvents.map(ev => (
                                    <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                      <span style={{
                                        fontFamily: 'var(--font-mono)', fontSize: '7px',
                                        color: 'var(--color-text-dim)', flexShrink: 0,
                                      }}>
                                        {relativeTime(ev.timestamp)}
                                      </span>
                                      <span style={{
                                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                                        color: 'var(--color-text-muted)',
                                      }}>
                                        {ev.message}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '8px',
                                  color: 'hsl(215 14% 28%)', paddingLeft: 16,
                                  letterSpacing: '0.05em',
                                }}>
                                  {isActive ? 'On mission...' : 'No recent activity'}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>

          {/* Colony Activity Feed */}
          <SectionLabel>
            Colony Activity
            {activityEvents.length > 0 && ` · ${activityEvents.length}`}
          </SectionLabel>

          {activityEvents.length === 0 ? (
            <div style={{
              padding: '18px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              backgroundColor: 'var(--color-surface)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 3, flexShrink: 0,
                backgroundColor: 'hsl(189 100% 50% / 0.06)',
                border: '1px solid hsl(189 100% 50% / 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={13} style={{ color: 'var(--color-primary)', opacity: 0.5 }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontFamily: 'var(--font-heading)', fontSize: '0.82rem',
                  color: 'var(--color-text-primary)', marginBottom: 3,
                }}>
                  No activity recorded
                </p>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                  color: 'var(--color-text-dim)', letterSpacing: '0.06em',
                }}>
                  Missions, hires, strikes, and promotions appear here
                </p>
              </div>
              <button
                onClick={() => setActiveView('mission-control')}
                style={{
                  flexShrink: 0, padding: '5px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                  letterSpacing: '0.12em', color: 'var(--color-primary)',
                  backgroundColor: 'hsl(189 100% 50% / 0.08)',
                  border: '1px solid hsl(189 100% 50% / 0.3)',
                  borderRadius: 2, cursor: 'pointer',
                }}
              >
                DISPATCH →
              </button>
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 4, overflow: 'hidden',
              backgroundColor: 'var(--color-surface)',
            }}>
              {activityEvents.slice(0, 8).map((ev, i) => {
                const Icon  = ACTIVITY_ICONS[ev.type] || Activity
                const color = ACTIVITY_COLORS[ev.type] || 'var(--color-text-muted)'
                return (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    borderBottom: i < Math.min(activityEvents.length, 8) - 1
                      ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: color,
                    }} />
                    <Icon size={9} style={{ color, flexShrink: 0, opacity: 0.7 }} />
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: '12px',
                      color: 'var(--color-text-muted)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.message}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      color: 'var(--color-text-dim)', flexShrink: 0,
                    }}>
                      {relativeTime(ev.timestamp)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{
          width: 268, flexShrink: 0,
          padding: '22px 18px',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 0,
          borderLeft: '1px solid var(--color-border)',
        }}>

          {/* DISPATCH MISSION — primary CTA */}
          <button
            onClick={() => setActiveView('mission-control')}
            style={{
              width: '100%', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, hsl(189 100% 50% / 0.12), hsl(189 100% 50% / 0.05))',
              border: '1px solid hsl(189 100% 50% / 0.35)',
              borderRadius: 4, cursor: 'pointer',
              marginBottom: 6, transition: 'all 0.15s',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.7)'
              e.currentTarget.style.background = 'linear-gradient(135deg, hsl(189 100% 50% / 0.2), hsl(189 100% 50% / 0.08))'
              e.currentTarget.style.boxShadow = '0 0 20px hsl(189 100% 50% / 0.12)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.35)'
              e.currentTarget.style.background = 'linear-gradient(135deg, hsl(189 100% 50% / 0.12), hsl(189 100% 50% / 0.05))'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 3, flexShrink: 0,
              backgroundColor: 'hsl(189 100% 50% / 0.1)',
              border: '1px solid hsl(189 100% 50% / 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare size={14} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                fontWeight: 700, letterSpacing: '0.16em',
                color: 'var(--color-primary)', lineHeight: 1,
              }}>
                DISPATCH MISSION
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '8px',
                color: 'var(--color-text-dim)', letterSpacing: '0.08em', marginTop: 3,
              }}>
                Route to {executive?.name || 'Sr. Executive'}
              </p>
            </div>
            <ChevronRight size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          </button>

          {/* Quick nav */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 5, marginBottom: 20,
          }}>
            {[
              { icon: Map,       label: 'MAP',       view: 'colony-map' },
              { icon: GitBranch, label: 'ORG CHART', view: 'org-chart'  },
              { icon: UserPlus,  label: 'HIRING',    view: 'hiring'     },
              { icon: Cpu,       label: 'INBOX',     view: 'inbox'      },
            ].map(({ icon: Icon, label, view }) => (
              <button
                key={view}
                onClick={() => setActiveView(view as any)}
                style={{
                  padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 7,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 3, cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.3)'
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                }}
              >
                <Icon size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                  letterSpacing: '0.12em', color: 'var(--color-text-muted)',
                }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div style={{ height: 1, backgroundColor: 'var(--color-border)', marginBottom: 18 }} />

          {/* L&D Autopilot */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>L&amp;D Autopilot</SectionLabel>
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${ldStore.isRunning ? 'hsl(42 65% 52% / 0.4)' : 'var(--color-border)'}`,
              borderRadius: 4, transition: 'border-color 0.3s',
            }}>
              {ldStore.isRunning ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: 'var(--color-amber)',
                      boxShadow: '0 0 8px hsl(42 65% 52% / 0.8)',
                      animation: 'breathe 1.2s ease-in-out infinite',
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      letterSpacing: '0.12em', color: 'var(--color-amber)',
                    }}>
                      CYCLE RUNNING
                    </span>
                  </div>
                  {ldStore.currentAgent && (
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                      color: 'var(--color-text-dim)', letterSpacing: '0.08em',
                    }}>
                      Reviewing: <span style={{ color: 'var(--color-text-primary)' }}>{ldStore.currentAgent}</span>
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {[
                      { label: 'REVIEWED', v: ldStore.stats.reviewed },
                      { label: 'TRAINING', v: ldStore.stats.trainingPlans },
                      { label: 'SKILLS',   v: ldStore.stats.skillUpdates },
                    ].map(({ label, v }) => (
                      <div key={label} style={{
                        flex: 1, textAlign: 'center', padding: '4px 0',
                        border: '1px solid var(--color-border)', borderRadius: 2,
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-display)', fontSize: '1rem',
                          fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1,
                        }}>{v}</p>
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: '6.5px',
                          letterSpacing: '0.12em', color: 'var(--color-text-dim)', marginTop: 2,
                        }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {ldStore.lastRun ? (
                    <>
                      <p style={{
                        fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                        color: 'var(--color-text-dim)', letterSpacing: '0.08em', marginBottom: 4,
                      }}>
                        Last run: <span style={{ color: 'var(--color-text-muted)' }}>{relativeTime(ldStore.lastRun)}</span>
                      </p>
                      {ldStore.lastSummary && (
                        <p style={{
                          fontFamily: 'var(--font-body)', fontSize: '11px',
                          color: 'var(--color-text-muted)', lineHeight: 1.45,
                          marginBottom: 10,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        } as React.CSSProperties}>
                          {ldStore.lastSummary}
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                      color: 'var(--color-text-dim)', letterSpacing: '0.08em', marginBottom: 10,
                    }}>
                      No cycle run yet
                    </p>
                  )}
                  {backendOnline && (
                    <button
                      onClick={triggerLD}
                      style={{
                        width: '100%', padding: '6px',
                        fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                        letterSpacing: '0.14em', color: 'var(--color-amber)',
                        backgroundColor: 'hsl(42 65% 52% / 0.08)',
                        border: '1px solid hsl(42 65% 52% / 0.3)',
                        borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.18)'
                        e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.55)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.08)'
                        e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.3)'
                      }}
                    >
                      RUN CYCLE NOW
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Workforce Breakdown */}
          <div>
            <SectionLabel>Workforce</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[
                { label: 'FOUNDER',   count: founders,   color: 'var(--color-amber)'   },
                { label: 'EXECUTIVE', count: executives, color: 'var(--color-primary)'  },
                { label: 'MANAGERS',  count: managers,   color: 'var(--color-text-muted)' },
                { label: 'WORKERS',   count: workers,    color: 'var(--color-text-muted)' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 3,
                }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.1rem',
                    fontWeight: 700, color, lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {count}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '7px',
                    letterSpacing: '0.14em', color: 'var(--color-text-dim)', marginTop: 2,
                  }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '18px 0' }} />

          {/* System integrity */}
          <div>
            <SectionLabel>System</SectionLabel>
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {[
                { label: 'AI BACKEND', ok: backendOnline },
                { label: 'AGENT MESH', ok: agents.length > 0 },
                { label: 'COMPLIANCE', ok: openStrikes === 0 },
              ].map(({ label, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: ok ? 'hsl(142 76% 53%)' : 'var(--color-danger)',
                    boxShadow: ok ? '0 0 5px hsl(142 76% 53% / 0.6)' : '0 0 5px hsl(0 72% 51% / 0.6)',
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                    letterSpacing: '0.12em', color: 'var(--color-text-dim)', flex: 1,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                    letterSpacing: '0.1em',
                    color: ok ? 'hsl(142 76% 53%)' : 'var(--color-danger)',
                  }}>
                    {ok ? 'OK' : 'WARN'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
