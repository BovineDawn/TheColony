import React from 'react'
import { useColonyStore } from '../../stores/colonyStore'
import { useHRStore } from '../../stores/hrStore'
import { useActivityStore } from '../../stores/activityStore'
import { useUIStore } from '../../stores/uiStore'
import {
  AlertTriangle, UserPlus, Award, MessageSquare,
  GraduationCap, TrendingUp, ChevronRight, Bell
} from 'lucide-react'
import type { ActivityEventType } from '../../stores/activityStore'

const EVENT_COLORS: Record<ActivityEventType, string> = {
  mission_complete: 'var(--color-primary)',
  mission_start:   'var(--color-primary)',
  agent_hired:     'var(--color-success)',
  strike_issued:   'var(--color-danger)',
  reward_granted:  'var(--color-warning)',
  training_start:  '#EC4899',
  promotion:       'hsl(262 80% 64%)',
}

const EVENT_ICONS: Record<ActivityEventType, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  mission_complete: MessageSquare,
  mission_start:   MessageSquare,
  agent_hired:     UserPlus,
  strike_issued:   AlertTriangle,
  reward_granted:  Award,
  training_start:  GraduationCap,
  promotion:       TrendingUp,
}

export function FounderInbox() {
  const { agents } = useColonyStore()
  const { hiringRecs } = useHRStore()
  const { events } = useActivityStore()
  const { setActiveView, setSelectedAgent, setActivePanel } = useUIStore()

  const pendingHires = hiringRecs.filter(h => h.status === 'pending')

  // Agents with 3+ strikes
  const strikeEscalations = agents.filter(a => {
    const openStrikes = (a.strikes || []).filter((s: any) => !s.resolved)
    return openStrikes.length >= 3
  })

  const sectionHeader = (label: string, count?: number) => (
    <div className="flex items-center gap-3 mb-3">
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
        letterSpacing: '0.2em',
        color: 'var(--color-amber)',
        fontWeight: 700,
      }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--color-amber)',
          backgroundColor: 'hsl(42 65% 52% / 0.12)',
          border: '1px solid hsl(42 65% 52% / 0.3)',
          borderRadius: 3,
          padding: '1px 6px',
        }}>
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: 1, backgroundColor: 'hsl(42 65% 52% / 0.2)' }} />
    </div>
  )

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px' }}>

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Bell size={14} style={{ color: 'var(--color-amber)' }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--color-text-muted)',
            }}>
              FOUNDER INBOX
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.05em',
          }}>
            Items Requiring Attention
          </h1>
        </div>

        {/* SECTION 1: PENDING HIRES */}
        <div className="mb-8">
          {sectionHeader('PENDING HIRES', pendingHires.length)}
          {pendingHires.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                No pending hire recommendations.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingHires.map(rec => (
                <div key={rec.id} style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      marginBottom: 2,
                    }}>
                      {rec.candidateName}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {rec.role} · {rec.department} · via {rec.recommendedBy}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveView('hiring')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 12px',
                      backgroundColor: 'hsl(42 65% 52% / 0.1)',
                      border: '1px solid hsl(42 65% 52% / 0.3)',
                      borderRadius: 4,
                      color: 'var(--color-amber)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      letterSpacing: '0.05em',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.1)'}
                  >
                    View in Pipeline <ChevronRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2: STRIKE ESCALATIONS */}
        <div className="mb-8">
          {sectionHeader('STRIKE ESCALATIONS', strikeEscalations.length)}
          {strikeEscalations.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                No agents with 3+ strikes.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {strikeEscalations.map(agent => {
                const openStrikes = (agent.strikes || []).filter((s: any) => !s.resolved).length
                return (
                  <div key={agent.id} style={{
                    padding: '14px 16px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid hsl(0 72% 51% / 0.3)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <AlertTriangle size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: 2,
                      }}>
                        {agent.name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {agent.role} · {openStrikes} open strike{openStrikes !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAgent(agent.id)
                        setActivePanel('agent-profile')
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '6px 12px',
                        backgroundColor: 'hsl(0 72% 51% / 0.1)',
                        border: '1px solid hsl(0 72% 51% / 0.3)',
                        borderRadius: 4,
                        color: 'var(--color-danger)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        letterSpacing: '0.05em',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.2)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.1)'}
                    >
                      View File <ChevronRight size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: RECENT ACTIVITY */}
        <div>
          {sectionHeader('RECENT ACTIVITY')}
          {events.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                No activity logged yet.
              </p>
            </div>
          ) : (
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              {events.slice(0, 20).map((ev, i) => {
                const color = EVENT_COLORS[ev.type]
                const Icon = EVENT_ICONS[ev.type]
                return (
                  <div key={ev.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 4,
                      backgroundColor: `${color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={12} style={{ color }} />
                    </div>
                    <span style={{
                      flex: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                    }}>
                      {ev.message}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--color-text-muted)',
                      flexShrink: 0,
                    }}>
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
