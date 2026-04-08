import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, AlertCircle, MessageSquare, GitBranch, UserPlus, Map,
  Activity, TrendingUp, CheckCircle2, Zap, GraduationCap,
  Users, ChevronRight, Award, Radio, Cpu,
} from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useUIStore } from '../../stores/uiStore'
import { useHRStore } from '../../stores/hrStore'
import { useActivityStore } from '../../stores/activityStore'
import { useLDStore } from '../../stores/ldStore'
import { departmentColors, departmentLabels } from '../../lib/departments'
import { connectSocket } from '../../lib/api'
import type { Department } from '../../types/agent'

const DEPT_ORDER: Department[] = ['engineering', 'research', 'writing', 'legal', 'ld']

// ─── helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-mono)', fontSize: '8px',
      letterSpacing: '0.2em', color: 'var(--color-text-dim)',
      marginBottom: 10, textTransform: 'uppercase',
    }}>
      {children}
    </p>
  )
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '20px 0' }} />
}

// ─── main component ──────────────────────────────────────────────────────────

export function MorningBriefing() {
  const { colony, agents, missions } = useColonyStore()
  const { setActiveView }            = useUIStore()
  const { hiringRecs, strikes, trainingSessions } = useHRStore()
  const { events: activityEvents }   = useActivityStore()
  const ldStore = useLDStore()
  const [backendOnline, setBackendOnline] = useState(false)

  React.useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  const founderName    = agents.find(a => a.isFounder)?.name || 'Founder'
  const executive      = agents.find(a => a.tier === 'executive' && !a.isFounder)
  const hour           = new Date().getHours()
  const greeting       = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr        = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

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
  const healthColor = healthScore >= 90 ? 'var(--color-success)'
    : healthScore >= 70 ? 'var(--color-primary)'
    : healthScore >= 50 ? 'var(--color-warning)'
    : 'var(--color-danger)'

  const triggerLD = () => {
    const socket = connectSocket()
    socket.emit('run_ld', {})
  }

  const STATS = [
    { label: 'COLONISTS', value: agents.length,     icon: Users,         color: 'var(--color-text-muted)' },
    { label: 'ACTIVE',    value: activeAgents,       icon: Activity,      color: activeAgents > 0 ? 'var(--color-success)' : 'var(--color-text-dim)' },
    { label: 'MISSIONS',  value: activeMissions,     icon: TrendingUp,    color: activeMissions > 0 ? 'var(--color-primary)' : 'var(--color-text-dim)' },
    { label: 'STRIKES',   value: openStrikes,        icon: AlertCircle,   color: openStrikes > 0 ? 'var(--color-danger)' : 'var(--color-text-dim)' },
    { label: 'TRAINING',  value: activeTraining,     icon: Zap,           color: activeTraining > 0 ? '#EC4899' : 'var(--color-text-dim)' },
    { label: 'PENDING',   value: pendingHires,       icon: CheckCircle2,  color: pendingHires > 0 ? 'var(--color-warning)' : 'var(--color-text-dim)' },
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--color-background)', display: 'flex', flexDirection: 'column' }}>

      {/* ══════════════════════════════════════
          GREETING HERO
      ══════════════════════════════════════ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '28px 32px 20px',
        borderBottom: '1px solid var(--color-border)',
        background: 'linear-gradient(135deg, hsl(215 22% 7%) 0%, var(--color-background) 100%)',
        flexShrink: 0,
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 140% at 0% 50%, hsl(42 65% 52% / 0.05) 0%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              letterSpacing: '0.2em', color: 'var(--color-text-dim)', marginBottom: 6,
            }}>
              {dateStr.toUpperCase()}
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.7rem',
              fontWeight: 700, lineHeight: 1.1,
              color: 'var(--color-text-primary)', letterSpacing: '0.04em',
            }}>
              {greeting},{' '}
              <span style={{
                color: 'var(--color-amber)',
                textShadow: '0 0 20px hsl(42 65% 52% / 0.3)',
              }}>
                {founderName}
              </span>.
            </h1>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--color-text-dim)', marginTop: 6, letterSpacing: '0.08em',
            }}>
              {colony?.name} &nbsp;·&nbsp; {agents.length} colonists
              {activeMissions > 0 && (
                <span style={{ color: 'var(--color-primary)', marginLeft: 8 }}>
                  · {activeMissions} mission{activeMissions > 1 ? 's' : ''} running
                </span>
              )}
            </p>
          </div>

          {/* Colony health */}
          <div style={{ textAlign: 'right' }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '7.5px',
              letterSpacing: '0.18em', color: 'var(--color-text-dim)', marginBottom: 5,
            }}>
              COLONY HEALTH
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} style={{
                    width: 5, height: 16, borderRadius: 1,
                    backgroundColor: i < Math.round(healthScore / 10) ? healthColor : 'var(--color-border)',
                    opacity: i < Math.round(healthScore / 10) ? 1 : 0.35,
                  }} />
                ))}
              </div>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '0.85rem',
                fontWeight: 700, color: healthColor, letterSpacing: '0.06em',
              }}>
                {healthScore >= 90 ? 'EXCELLENT' : healthScore >= 70 ? 'GOOD' : healthScore >= 50 ? 'FAIR' : 'CRITICAL'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          STAT STRIP
      ══════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {STATS.map(({ label, value, icon: Icon, color }, i) => (
          <div key={label} style={{
            flex: 1,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderRight: i < STATS.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}>
            <Icon size={12} style={{ color, flexShrink: 0 }} />
            <div>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '1.2rem',
                fontWeight: 700, lineHeight: 1,
                color: value > 0 ? color : 'var(--color-text-primary)',
              }}>
                {value}
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '7px',
                letterSpacing: '0.14em', color: 'var(--color-text-dim)', marginTop: 2,
              }}>
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════
          ALERT STRIP (conditional)
      ══════════════════════════════════════ */}
      {(openStrikes > 0 || pendingHires > 0 || activeTraining > 0) && (
        <div style={{
          display: 'flex', gap: 8, padding: '8px 32px',
          backgroundColor: 'hsl(215 20% 8%)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          {pendingHires > 0 && (
            <button onClick={() => setActiveView('hiring')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 2, cursor: 'pointer',
              backgroundColor: 'hsl(38 90% 52% / 0.08)',
              border: '1px solid hsl(38 90% 52% / 0.3)',
              color: 'var(--color-warning)',
              fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em',
            }}>
              <Bell size={9} />
              {pendingHires} HIRE{pendingHires > 1 ? 'S' : ''} PENDING
              <ChevronRight size={9} />
            </button>
          )}
          {openStrikes > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 2,
              backgroundColor: 'hsl(0 70% 52% / 0.08)',
              border: '1px solid hsl(0 70% 52% / 0.3)',
              color: 'var(--color-danger)',
              fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em',
            }}>
              <AlertCircle size={9} />
              {openStrikes} UNRESOLVED STRIKE{openStrikes > 1 ? 'S' : ''}
            </div>
          )}
          {activeTraining > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 2,
              backgroundColor: 'hsl(330 55% 52% / 0.08)',
              border: '1px solid hsl(330 55% 52% / 0.3)',
              color: '#EC4899',
              fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em',
            }}>
              <GraduationCap size={9} />
              {activeTraining} IN TRAINING
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          MAIN BODY: LEFT + RIGHT
      ══════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{
          flex: '1 1 0%',
          padding: '24px 32px',
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
        }}>

          {/* Department Roster */}
          <SectionLabel>Department Roster</SectionLabel>

          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            {DEPT_ORDER.map((dept, idx) => {
              const deptAgents  = agents.filter(a => a.department === dept)
              const manager     = deptAgents.find(a => a.tier === 'manager')
              const activeCount = deptAgents.filter(a => ['working','thinking','chatting'].includes(a.status)).length
              const inTraining  = deptAgents.filter(a => a.status === 'training').length
              const hasIssue    = deptAgents.some(a => (a.strikes || []).some((s: any) => !s.resolved))
              const color       = departmentColors[dept]

              const statusColor = inTraining > 0 ? '#EC4899'
                : activeCount > 0 ? 'var(--color-success)'
                : hasIssue ? 'var(--color-danger)'
                : 'hsl(215 14% 30%)'

              const statusLabel = inTraining > 0 ? `${inTraining} TRAINING`
                : activeCount > 0 ? `${activeCount} ACTIVE`
                : hasIssue ? 'ISSUE'
                : 'STANDBY'

              return (
                <motion.div
                  key={dept}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: idx < DEPT_ORDER.length - 1 ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: 'var(--color-surface)',
                    position: 'relative',
                    transition: 'background-color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-raised)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
                >
                  {/* Dept color bar */}
                  <div style={{
                    width: 2, alignSelf: 'stretch',
                    borderRadius: 1, backgroundColor: color,
                    flexShrink: 0, marginRight: 14, opacity: 0.85,
                  }} />

                  {/* Dept name */}
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                    letterSpacing: '0.18em', color,
                    width: 92, flexShrink: 0,
                  }}>
                    {departmentLabels[dept].toUpperCase()}
                  </span>

                  {/* Manager name */}
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '1rem',
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

                  {/* Agent count badge */}
                  <div style={{
                    marginRight: 14, flexShrink: 0,
                    padding: '2px 7px', borderRadius: 2,
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                      color: 'var(--color-text-muted)', letterSpacing: '0.05em',
                    }}>
                      {deptAgents.length}
                    </span>
                  </div>

                  {/* Issue icon */}
                  {hasIssue && (
                    <AlertCircle size={10} style={{ color: 'var(--color-danger)', marginRight: 8, flexShrink: 0 }} />
                  )}

                  {/* Status pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                    backgroundColor: `${statusColor}14`,
                    border: `1px solid ${statusColor}38`,
                  }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: '50%',
                      backgroundColor: statusColor,
                      boxShadow: (activeCount > 0 || inTraining > 0) ? `0 0 4px ${statusColor}` : 'none',
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                      letterSpacing: '0.1em', color: statusColor,
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <Divider />

          {/* Colony Activity Feed */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>Colony Activity</SectionLabel>
            {activityEvents.length > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                color: 'var(--color-text-dim)', letterSpacing: '0.1em',
                marginBottom: 10,
              }}>
                {activityEvents.length} events
              </span>
            )}
          </div>

          {activityEvents.length === 0 ? (
            <div style={{
              padding: '20px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              backgroundColor: 'var(--color-surface)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 3, flexShrink: 0,
                backgroundColor: 'hsl(189 100% 50% / 0.06)',
                border: '1px solid hsl(189 100% 50% / 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={14} style={{ color: 'var(--color-primary)', opacity: 0.5 }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontFamily: 'var(--font-heading)', fontSize: '0.85rem',
                  color: 'var(--color-text-primary)', marginBottom: 3,
                }}>
                  No activity yet
                </p>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  color: 'var(--color-text-dim)', letterSpacing: '0.06em',
                }}>
                  Missions, hires, strikes, and promotions appear here
                </p>
              </div>
              <button
                onClick={() => setActiveView('mission-control')}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.12em',
                  color: 'var(--color-primary)',
                  backgroundColor: 'hsl(189 100% 50% / 0.08)',
                  border: '1px solid hsl(189 100% 50% / 0.3)',
                  borderRadius: 2, cursor: 'pointer',
                }}
              >
                START MISSION
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
                    <Icon size={10} style={{ color, flexShrink: 0 }} />
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
          width: 280, flexShrink: 0,
          padding: '24px 20px',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>

          {/* DISPATCH MISSION — primary CTA */}
          <button
            onClick={() => setActiveView('mission-control')}
            style={{
              width: '100%', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, hsl(189 100% 50% / 0.14), hsl(189 100% 50% / 0.07))',
              border: '1px solid hsl(189 100% 50% / 0.4)',
              borderRadius: 4, cursor: 'pointer',
              marginBottom: 8, transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.75)'
              e.currentTarget.style.background = 'linear-gradient(135deg, hsl(189 100% 50% / 0.22), hsl(189 100% 50% / 0.12))'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.4)'
              e.currentTarget.style.background = 'linear-gradient(135deg, hsl(189 100% 50% / 0.14), hsl(189 100% 50% / 0.07))'
            }}
          >
            <MessageSquare size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '1rem',
                fontWeight: 700, letterSpacing: '0.1em',
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
            <ChevronRight size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          </button>

          {/* Quick nav */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 6, marginBottom: 20,
          }}>
            {[
              { icon: Map,       label: 'MAP',      view: 'colony-map'  },
              { icon: GitBranch, label: 'ORG CHART', view: 'org-chart'   },
              { icon: UserPlus,  label: 'HIRING',   view: 'hiring'      },
              { icon: Cpu,       label: 'INBOX',    view: 'inbox'       },
            ].map(({ icon: Icon, label, view }) => (
              <button
                key={view}
                onClick={() => setActiveView(view as any)}
                style={{
                  padding: '9px 10px',
                  display: 'flex', alignItems: 'center', gap: 7,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 3, cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-amber-dim)'
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                }}
              >
                <Icon size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.14em', color: 'var(--color-text-muted)',
                }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: 'var(--color-border)', marginBottom: 20 }} />

          {/* L&D Status */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>L&amp;D Autopilot</SectionLabel>
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${ldStore.isRunning ? 'hsl(42 65% 52% / 0.35)' : 'var(--color-border)'}`,
              borderRadius: 4,
              transition: 'border-color 0.3s',
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

          {/* Workforce breakdown */}
          <div>
            <SectionLabel>Workforce</SectionLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 5,
            }}>
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

        </div>
      </div>
    </div>
  )
}
