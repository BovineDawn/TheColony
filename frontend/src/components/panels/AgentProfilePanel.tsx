import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { X, Award, ShieldAlert, Star, GraduationCap, ChevronRight, Send, Loader2, History } from 'lucide-react'
import { StrikeModal } from '../hr/StrikeModal'
import { RewardModal } from '../hr/RewardModal'
import { ReportModal } from '../ld/ReportModal'
import { useColonyStore } from '../../stores/colonyStore'
import { useUIStore } from '../../stores/uiStore'
import { useTrainingStore } from '../../stores/trainingStore'
import { departmentColors, departmentLabels } from '../../lib/departments'
import { getModelLabel } from '../../lib/models'
import { api, connectSocket } from '../../lib/api'
import type { Agent } from '../../types/agent'

// ── Procedural barcode from a seed string ──
function Barcode({ seed }: { seed: string }) {
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (let i = 0; i < 24; i++) {
    const code = seed.charCodeAt(i % seed.length)
    const w = (code * (i + 1) * 7) % 3 === 0 ? 3 : (code + i * 11) % 5 === 0 ? 2 : 1
    if (i % 2 === 0) bars.push({ x, w })
    x += w + 1
  }
  return (
    <svg width={x} height="22" viewBox={`0 0 ${x} 22`} style={{ display: 'block' }}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={22} fill="currentColor" />
      ))}
    </svg>
  )
}

// ── Avatar placeholder — styled mugshot frame ──
function AgentAvatar({ agent, deptColor }: { agent: Agent; deptColor: string }) {
  const initials = agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      // double-border mugshot frame
      outline: `1px solid ${deptColor}80`,
      outlineOffset: '3px',
      border: `1.5px solid ${deptColor}`,
      backgroundColor: 'hsl(215 20% 8%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* CRT scan-line overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)',
      }} />
      {/* Subtle radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)',
      }} />
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '2.2rem', fontWeight: 700,
        color: deptColor,
        textShadow: `0 0 24px ${deptColor}70`,
        letterSpacing: 3,
        position: 'relative', zIndex: 1,
      }}>
        {initials}
      </span>
    </div>
  )
}

// ── Data row ──
function DataRow({
  label, value, valueColor,
}: {
  label: string; value: string; valueColor?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 7 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '8px',
        letterSpacing: '0.14em', color: 'var(--color-text-dim)',
        minWidth: 78, flexShrink: 0, paddingTop: 1,
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: '0.88rem',
        fontWeight: 600, letterSpacing: '0.04em',
        color: valueColor || 'var(--color-text-primary)',
        lineHeight: 1.2,
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Stat box ──
function StatBox({
  value, label, valueColor,
}: {
  value: number | string; label: string; valueColor?: string
}) {
  return (
    <div style={{
      flex: 1, padding: '10px 8px', textAlign: 'center',
      border: '1px solid var(--color-border)',
      borderRadius: 2,
    }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700,
        color: valueColor || 'var(--color-text-primary)', lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: '7px',
        letterSpacing: '0.14em', color: 'var(--color-text-dim)',
        marginTop: 3,
      }}>
        {label}
      </p>
    </div>
  )
}


const STATUS_LABELS: Record<string, string> = {
  idle:       'STANDBY',
  thinking:   'PROCESSING',
  working:    'ACTIVE DUTY',
  chatting:   'COORDINATING',
  training:   'IN TRAINING',
  terminated: 'TERMINATED',
}

const STATUS_COLORS: Record<string, string> = {
  idle:       'var(--color-text-muted)',
  thinking:   'var(--color-warning)',
  working:    'var(--color-success)',
  chatting:   'var(--color-primary)',
  training:   '#EC4899',
  terminated: 'var(--color-danger)',
}

export function AgentProfilePanel() {
  const { agents, colony } = useColonyStore()
  const { activePanel, selectedAgentId, setActivePanel, setSelectedAgent } = useUIStore()
  const { addSession, getSessionsForAgent } = useTrainingStore()
  const [showStrike, setShowStrike] = useState(false)
  const [showReward, setShowReward] = useState(false)
  const [ldHistory, setLdHistory] = useState<{ cycle_entries: any[], onboarding: any | null } | null>(null)
  const [openReport, setOpenReport] = useState<{ filename: string; isOnboarding: boolean; title: string } | null>(null)
  const [ldInput, setLdInput] = useState('')
  const [ldLoading, setLdLoading] = useState(false)
  const [ldMessages, setLdMessages] = useState<{ role: 'founder' | 'nova'; content: string }[]>([])
  const [ldShowHistory, setLdShowHistory] = useState(false)
  const ldChatRef = useRef<HTMLDivElement>(null)

  const agent = agents.find(a => a.id === selectedAgentId)
  const isOpen = activePanel === 'agent-profile' && !!agent

  useEffect(() => {
    if (!agent || !isOpen) return
    setLdHistory(null)
    api.get(`/api/ld/agents/${encodeURIComponent(agent.name)}/history`)
      .then((data: any) => setLdHistory(data))
      .catch(() => {/* backend offline */})
  }, [agent?.id, isOpen])

  // Reset L&D chat when agent changes
  useEffect(() => { setLdMessages([]); setLdInput(''); setLdShowHistory(false) }, [agent?.id])

  // Scroll L&D chat to bottom when new messages arrive
  useEffect(() => {
    if (ldChatRef.current) ldChatRef.current.scrollTop = ldChatRef.current.scrollHeight
  }, [ldMessages])

  const sendLdMessage = () => {
    if (!ldInput.trim() || ldLoading || !agent) return
    const msg = ldInput.trim()
    setLdInput('')
    setLdMessages(prev => [...prev, { role: 'founder', content: msg }])
    setLdLoading(true)
    const socket = connectSocket()
    socket.emit('ld_direct', { message: msg, target_agent: agent.name })
    const handler = (ev: any) => {
      if (ev.type === 'ld_direct_response') {
        const novaResponse = ev.content as string
        setLdMessages(prev => [...prev, { role: 'nova', content: novaResponse }])
        setLdLoading(false)
        socket.off('colony_event', handler)
        // Persist the session to training history
        addSession({
          agentId: agent.id,
          agentName: agent.name,
          timestamp: new Date().toISOString(),
          founderMessage: msg,
          novaResponse,
        })
      }
    }
    socket.on('colony_event', handler)
  }

  const manager = agent?.managerId ? agents.find(a => a.id === agent.managerId) : null
  const reports = agent ? agents.filter(a => a.managerId === agent.id) : []

  const tenure = agent
    ? Math.max(0, Math.floor((Date.now() - new Date(agent.hiredAt).getTime()) / 86400000))
    : 0

  const close = () => {
    setActivePanel('none')
    setSelectedAgent(null)
  }

  const deptColor  = agent ? departmentColors[agent.department] : 'var(--color-amber)'
  const empIdStr   = agent ? `#${String(agent.employeeId).padStart(4, '0')}` : ''
  const refCode    = agent
    ? `RWC-${String(agent.employeeId).padStart(4, '0')}-${agent.name.split(' ').map(n => n[0]).join('')}`
    : 'RWC-0000-XX'
  const statusColor = agent ? (STATUS_COLORS[agent.status] || 'var(--color-text-muted)') : 'var(--color-text-muted)'

  return (
    <>
      {showStrike && agent && <StrikeModal agent={agent} onClose={() => setShowStrike(false)} />}
      {showReward && agent && <RewardModal agent={agent} onClose={() => setShowReward(false)} />}
      {openReport && <ReportModal filename={openReport.filename} isOnboarding={openReport.isOnboarding} title={openReport.title} onClose={() => setOpenReport(null)} />}

      <AnimatePresence>
        {isOpen && agent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
              onClick={close}
            />

            {/* Panel scroll container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="fixed right-0 top-0 h-full z-50 overflow-y-auto"
              style={{
                width: '420px',
                backgroundColor: 'var(--color-background)',
                borderLeft: '1px solid var(--color-border)',
              }}
            >
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ══════════════════════════════════════
                    THE COLONY ID CARD
                ══════════════════════════════════════ */}
                <div style={{
                  position: 'relative',
                  backgroundColor: 'hsl(215 20% 8%)',
                  border: `1px solid var(--color-amber-dim)`,
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 0 40px rgba(0,0,0,0.6)',
                }}>

                  {/* Grain texture on card */}
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    opacity: 0.04,
                  }} />

                  {/* ── Card header ── */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px 10px',
                    borderBottom: '1px solid var(--color-amber-dim)',
                    background: 'linear-gradient(135deg, hsl(215 20% 11%) 0%, hsl(215 18% 8%) 100%)',
                  }}>
                    <div>
                      <p style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.5rem', fontWeight: 700,
                        letterSpacing: '0.14em', lineHeight: 1,
                        color: 'var(--color-amber)',
                        textShadow: '0 0 20px hsl(42 65% 52% / 0.3)',
                      }}>
                        {(colony?.name || 'THE COLONY').toUpperCase()}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-mono)', fontSize: '8px',
                        color: 'var(--color-text-dim)', letterSpacing: '0.2em',
                        marginTop: 3,
                      }}>
                        COLONIST IDENTIFICATION RECORD
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Star emblem */}
                      <div style={{
                        width: 34, height: 34,
                        border: '1.5px solid var(--color-amber-dim)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-amber)', opacity: 0.65,
                      }}>
                        <Star size={15} fill="currentColor" />
                      </div>
                      <button
                        onClick={close}
                        style={{
                          color: 'var(--color-text-dim)', cursor: 'pointer',
                          background: 'none', border: 'none', padding: 4,
                          lineHeight: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-dim)')}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* ── ID number sub-header ── */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 16px',
                    backgroundColor: `${deptColor}10`,
                    borderBottom: `1px solid ${deptColor}28`,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      letterSpacing: '0.12em', color: 'var(--color-text-dim)',
                    }}>
                      EMPLOYEE FILE
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '1.15rem',
                      fontWeight: 700, letterSpacing: '0.1em', color: deptColor,
                      textShadow: `0 0 12px ${deptColor}50`,
                    }}>
                      {empIdStr}
                    </span>
                  </div>

                  {/* ── Two-column body ── */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex', gap: 14, padding: '14px 16px',
                    borderBottom: '1px solid var(--color-border)',
                  }}>

                    {/* LEFT: mugshot + ruler + dept tag */}
                    <div style={{ width: 96, flexShrink: 0 }}>
                      {/* Height ruler + photo */}
                      <div style={{ display: 'flex', gap: 5, height: 116 }}>
                        {/* Ruler ticks */}
                        <div style={{
                          display: 'flex', flexDirection: 'column',
                          justifyContent: 'space-between', paddingBottom: 2,
                        }}>
                          {['6.0', '5.5', '5.0', '4.5', '4.0'].map(m => (
                            <span key={m} style={{
                              fontFamily: 'var(--font-mono)', fontSize: '7px',
                              color: 'var(--color-text-dim)', lineHeight: 1,
                            }}>
                              {m}
                            </span>
                          ))}
                        </div>
                        {/* Photo */}
                        <div style={{ flex: 1, height: 116 }}>
                          <AgentAvatar agent={agent} deptColor={deptColor} />
                        </div>
                      </div>

                      {/* Dept tag */}
                      <div style={{
                        marginTop: 8, padding: '3px 6px', textAlign: 'center',
                        border: `1px solid ${deptColor}45`,
                        backgroundColor: `${deptColor}0E`,
                        borderRadius: 2,
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                          letterSpacing: '0.14em', color: deptColor,
                        }}>
                          {departmentLabels[agent.department].toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT: data fields */}
                    <div style={{ flex: 1 }}>
                      <DataRow label="NAME"     value={agent.name.toUpperCase()} />
                      <DataRow label="ROLE"     value={agent.role.toUpperCase()} />
                      <DataRow
                        label="STATUS"
                        value={STATUS_LABELS[agent.status] || agent.status.toUpperCase()}
                        valueColor={statusColor}
                      />
                      <DataRow label="MODEL"    value={getModelLabel(agent.model).toUpperCase()} />
                      <DataRow label="TENURE"   value={`${tenure} DAYS`} />
                      {manager && (
                        <DataRow
                          label="REPORTS TO"
                          value={manager.name.toUpperCase()}
                          valueColor={departmentColors[manager.department]}
                        />
                      )}
                      {reports.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 7 }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '8px',
                            letterSpacing: '0.14em', color: 'var(--color-text-dim)',
                            minWidth: 78, flexShrink: 0, paddingTop: 1,
                          }}>
                            DIRECTS:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
                            {reports.map(r => (
                              <span key={r.id} style={{
                                fontFamily: 'var(--font-display)', fontSize: '0.8rem',
                                fontWeight: 600, letterSpacing: '0.04em',
                                color: departmentColors[r.department],
                              }}>
                                {r.name.split(' ')[0].toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Skills ── */}
                  {agent.skills.length > 0 && (
                    <div style={{
                      position: 'relative', zIndex: 2,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <p style={{
                        fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                        letterSpacing: '0.18em', color: 'var(--color-text-dim)',
                        marginBottom: 8,
                      }}>
                        SKILLS &amp; COMPETENCIES
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 20px' }}>
                        {agent.skills.map((skill: any) => (
                          <div key={skill.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{
                              fontFamily: 'var(--font-display)', fontSize: '0.82rem',
                              fontWeight: 600, letterSpacing: '0.05em',
                              color: 'var(--color-text-primary)',
                            }}>
                              {skill.name.toUpperCase()}
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                              color: deptColor, opacity: 0.8,
                            }}>
                              {skill.level.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Personality ── */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                      letterSpacing: '0.18em', color: 'var(--color-text-dim)',
                      marginBottom: 6,
                    }}>
                      PSYCHOLOGICAL PROFILE
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: '12px',
                      color: 'var(--color-text-muted)', lineHeight: 1.6,
                      fontStyle: 'italic',
                    }}>
                      "{agent.personalityNote}"
                    </p>
                  </div>

                  {/* ── Stats row ── */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex', gap: 6,
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <StatBox
                      value={agent.strikes.length}
                      label="STRIKES"
                      valueColor={agent.strikes.length > 0 ? 'var(--color-danger)' : 'var(--color-text-dim)'}
                    />
                    <StatBox
                      value={agent.rewards.length}
                      label="AWARDS"
                      valueColor={agent.rewards.length > 0 ? 'var(--color-amber)' : 'var(--color-text-dim)'}
                    />
                    <StatBox
                      value={tenure}
                      label="DAYS SVC"
                      valueColor="var(--color-primary)"
                    />
                  </div>

                  {/* ── Actions ── */}
                  {!agent.isFounder && (
                    <div style={{
                      position: 'relative', zIndex: 2,
                      display: 'flex', gap: 8,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <button
                        onClick={() => setShowReward(true)}
                        style={{
                          flex: 1, padding: '8px 12px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontFamily: 'var(--font-mono)', fontSize: '9.5px',
                          letterSpacing: '0.12em', fontWeight: 500,
                          color: 'var(--color-amber)',
                          backgroundColor: 'hsl(42 65% 52% / 0.08)',
                          border: '1px solid hsl(42 65% 52% / 0.25)',
                          borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.18)'
                          e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.55)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.08)'
                          e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.25)'
                        }}
                      >
                        <Award size={11} />
                        COMMEND
                      </button>
                      <button
                        onClick={() => setShowStrike(true)}
                        style={{
                          flex: 1, padding: '8px 12px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontFamily: 'var(--font-mono)', fontSize: '9.5px',
                          letterSpacing: '0.12em', fontWeight: 500,
                          color: 'var(--color-danger)',
                          backgroundColor: 'hsl(0 70% 52% / 0.08)',
                          border: '1px solid hsl(0 70% 52% / 0.25)',
                          borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'hsl(0 70% 52% / 0.18)'
                          e.currentTarget.style.borderColor = 'hsl(0 70% 52% / 0.55)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'hsl(0 70% 52% / 0.08)'
                          e.currentTarget.style.borderColor = 'hsl(0 70% 52% / 0.25)'
                        }}
                      >
                        <ShieldAlert size={11} />
                        ISSUE STRIKE
                      </button>
                    </div>
                  )}

                  {/* ── L&D History ── */}
                  {ldHistory && (ldHistory.onboarding || ldHistory.cycle_entries.length > 0) && (
                    <div style={{
                      position: 'relative', zIndex: 2,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <p style={{
                        fontFamily: 'var(--font-mono)', fontSize: '7.5px',
                        letterSpacing: '0.18em', color: 'var(--color-text-dim)',
                        marginBottom: 8,
                      }}>
                        L&amp;D TRAINING RECORD
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

                        {/* Onboarding report */}
                        {ldHistory.onboarding && (
                          <button
                            onClick={() => setOpenReport({
                              filename: ldHistory.onboarding.filename,
                              isOnboarding: true,
                              title: `${agent!.name} — Onboarding Report`,
                            })}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                              padding: '7px 10px', borderRadius: 3, cursor: 'pointer',
                              backgroundColor: 'hsl(262 80% 64% / 0.06)',
                              border: '1px solid hsl(262 80% 64% / 0.2)',
                              textAlign: 'left', transition: 'all 0.12s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(262 80% 64% / 0.45)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(262 80% 64% / 0.2)'}
                          >
                            <GraduationCap size={11} style={{ color: 'hsl(262 80% 64%)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'hsl(262 80% 64%)' }}>
                                ONBOARDING REPORT
                              </p>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--color-text-dim)' }}>
                                {ldHistory.onboarding.date}
                              </p>
                            </div>
                            <ChevronRight size={11} style={{ color: 'hsl(262 80% 64%)', flexShrink: 0 }} />
                          </button>
                        )}

                        {/* Cycle reports */}
                        {ldHistory.cycle_entries.slice(0, 3).map((entry: any) => (
                          <button
                            key={entry.filename}
                            onClick={() => setOpenReport({
                              filename: entry.filename,
                              isOnboarding: false,
                              title: `${agent!.name} — ${entry.date}`,
                            })}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                              padding: '7px 10px', borderRadius: 3, cursor: 'pointer',
                              backgroundColor: 'var(--color-surface-raised)',
                              border: '1px solid var(--color-border)',
                              textAlign: 'left', transition: 'all 0.12s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.35)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                          >
                            <GraduationCap size={11} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>
                                L&amp;D CYCLE
                              </p>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--color-text-dim)' }}>
                                {entry.date}
                              </p>
                            </div>
                            <ChevronRight size={11} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── L&D Direct Chat with NOVA ── */}
                  {!agent!.isFounder && (
                    <div style={{
                      position: 'relative', zIndex: 2,
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      {/* Section header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px 8px',
                      }}>
                        <GraduationCap size={11} style={{ color: 'hsl(262 80% 64%)', flexShrink: 0 }} />
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: '8px',
                          letterSpacing: '0.18em', color: 'hsl(262 80% 64%)',
                          flex: 1,
                        }}>
                          TRAIN WITH NOVA
                        </p>
                        {/* History toggle */}
                        {agent && getSessionsForAgent(agent.id).length > 0 && (
                          <button
                            onClick={() => setLdShowHistory(h => !h)}
                            title={ldShowHistory ? 'Show current session' : 'View training history'}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: ldShowHistory ? 'hsl(262 80% 64% / 0.12)' : 'transparent',
                              color: ldShowHistory ? 'hsl(262 80% 64%)' : 'var(--color-text-dim)',
                            }}
                          >
                            <History size={10} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em' }}>
                              {getSessionsForAgent(agent.id).length} SESSION{getSessionsForAgent(agent.id).length !== 1 ? 'S' : ''}
                            </span>
                          </button>
                        )}
                        {ldMessages.length > 0 && !ldShowHistory && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '8px',
                            color: 'var(--color-text-dim)', opacity: 0.5,
                          }}>
                            saved to memory
                          </span>
                        )}
                      </div>

                      {/* ── History view ── */}
                      {ldShowHistory && agent && (() => {
                        const sessions = getSessionsForAgent(agent.id)
                        return (
                          <div style={{
                            maxHeight: 380, overflowY: 'auto',
                            borderTop: '1px solid var(--color-border)',
                          }}>
                            {sessions.map((s, si) => (
                              <div key={s.id} style={{
                                borderBottom: si < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                              }}>
                                {/* Session timestamp */}
                                <div style={{
                                  padding: '8px 16px 4px',
                                  backgroundColor: 'hsl(215 22% 5%)',
                                  display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                  <History size={9} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
                                  <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                                    color: 'var(--color-text-dim)', letterSpacing: '0.1em',
                                  }}>
                                    {new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {' · '}
                                    {new Date(s.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                {/* Founder message */}
                                <div style={{
                                  padding: '8px 16px',
                                  backgroundColor: 'hsl(189 100% 50% / 0.04)',
                                }}>
                                  <p style={{
                                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                                    letterSpacing: '0.12em', color: 'var(--color-primary)',
                                    marginBottom: 4, fontWeight: 700,
                                  }}>FOUNDER</p>
                                  <p style={{
                                    fontFamily: 'var(--font-body)', fontSize: '12px',
                                    color: 'var(--color-text-muted)', lineHeight: 1.5,
                                    whiteSpace: 'pre-wrap',
                                  }}>{s.founderMessage}</p>
                                </div>
                                {/* NOVA response */}
                                <div style={{ padding: '8px 16px' }}>
                                  <p style={{
                                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                                    letterSpacing: '0.12em', color: 'hsl(262 80% 64%)',
                                    marginBottom: 4, fontWeight: 700,
                                  }}>NOVA</p>
                                  <p style={{
                                    fontFamily: 'var(--font-body)', fontSize: '12px',
                                    color: 'var(--color-text-primary)', lineHeight: 1.5,
                                    whiteSpace: 'pre-wrap',
                                  }}>
                                    {s.novaResponse.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s+/gm, '').trim()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {/* Chat transcript (current session) */}
                      {!ldShowHistory && ldMessages.length > 0 && (
                        <div
                          ref={ldChatRef}
                          style={{
                            maxHeight: 320, overflowY: 'auto',
                            display: 'flex', flexDirection: 'column',
                            borderTop: '1px solid var(--color-border)',
                          }}
                        >
                          {ldMessages.map((m, i) => {
                            const isFounder = m.role === 'founder'
                            const clean = m.content
                              .replace(/\*\*/g, '')
                              .replace(/\*/g, '')
                              .replace(/^#+\s+/gm, '')
                              .replace(/^(\d+)\.\s+/gm, '$1. ')
                              .trim()
                            return (
                              <div key={i} style={{
                                padding: '12px 16px',
                                borderBottom: i < ldMessages.length - 1 ? '1px solid var(--color-border)' : 'none',
                                backgroundColor: isFounder ? 'hsl(189 100% 50% / 0.04)' : 'transparent',
                              }}>
                                <p style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                                  letterSpacing: '0.12em',
                                  color: isFounder ? 'var(--color-primary)' : 'hsl(262 80% 64%)',
                                  marginBottom: 6, fontWeight: 700,
                                }}>
                                  {isFounder ? 'FOUNDER' : 'NOVA'}
                                </p>
                                <p style={{
                                  fontFamily: 'var(--font-body)', fontSize: '13px',
                                  color: isFounder ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                                  lineHeight: 1.6,
                                  whiteSpace: 'pre-wrap',
                                }}>
                                  {clean}
                                </p>
                              </div>
                            )
                          })}
                          {ldLoading && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '12px 16px',
                              borderTop: '1px solid var(--color-border)',
                            }}>
                              <Loader2 size={12} style={{ color: 'hsl(262 80% 64%)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)' }}>
                                NOVA is writing her training plan…
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Input row */}
                      <div style={{
                        display: 'flex', gap: 8, alignItems: 'flex-end',
                        padding: '10px 16px',
                        borderTop: ldMessages.length > 0 ? '1px solid var(--color-border)' : 'none',
                      }}>
                        <textarea
                          value={ldInput}
                          onChange={e => setLdInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              sendLdMessage()
                            }
                          }}
                          placeholder={`Direct NOVA to train ${agent!.name}… paste links, describe focus areas`}
                          rows={2}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 6,
                            backgroundColor: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-primary)',
                            fontFamily: 'var(--font-body)', fontSize: '13px',
                            resize: 'none', outline: 'none', lineHeight: 1.5,
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'hsl(262 80% 64% / 0.5)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                        />
                        <button
                          onClick={sendLdMessage}
                          disabled={!ldInput.trim() || ldLoading}
                          style={{
                            width: 34, height: 34, borderRadius: 6, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: ldInput.trim() && !ldLoading ? 'hsl(262 80% 64% / 0.15)' : 'transparent',
                            border: `1px solid ${ldInput.trim() && !ldLoading ? 'hsl(262 80% 64% / 0.4)' : 'var(--color-border)'}`,
                            color: ldInput.trim() && !ldLoading ? 'hsl(262 80% 64%)' : 'var(--color-text-dim)',
                            cursor: ldInput.trim() && !ldLoading ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s',
                          }}
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Card footer: quote + barcode ── */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    padding: '10px 16px',
                    backgroundColor: 'hsl(215 22% 6%)',
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      color: 'var(--color-text-dim)', opacity: 0.55,
                      fontStyle: 'italic', maxWidth: 170, lineHeight: 1.45,
                    }}>
                      "SURVIVAL IS OUR ONLY LAW."<br />— THE COLONY, EST. 5500
                    </p>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                    }}>
                      <div style={{ color: 'var(--color-text-dim)', opacity: 0.45 }}>
                        <Barcode seed={refCode} />
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '7px',
                        color: 'var(--color-text-dim)', opacity: 0.45,
                        letterSpacing: '0.1em',
                      }}>
                        {refCode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Strike history (below card) ── */}
                {agent.strikes.length > 0 && (
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      letterSpacing: '0.18em', color: 'var(--color-danger)',
                      marginBottom: 6,
                    }}>
                      ▲ DISCIPLINARY RECORD
                    </p>
                    {agent.strikes.map((strike: any) => (
                      <div key={strike.id} style={{
                        marginBottom: 4, padding: '8px 10px',
                        border: '1px solid hsl(0 70% 52% / 0.2)',
                        borderRadius: 2,
                        backgroundColor: 'hsl(0 70% 52% / 0.05)',
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-body)', fontSize: '12px',
                          color: 'var(--color-text-primary)',
                        }}>
                          {strike.reason}
                        </p>
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: '9px',
                          color: 'var(--color-text-dim)', marginTop: 3,
                        }}>
                          {new Date(strike.date).toLocaleDateString()}
                          {strike.resolved && (
                            <span style={{ color: 'var(--color-success)', marginLeft: 8 }}>
                              ✓ RESOLVED
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Commendations (below card) ── */}
                {agent.rewards.length > 0 && (
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      letterSpacing: '0.18em', color: 'var(--color-amber)',
                      marginBottom: 6,
                    }}>
                      ★ COMMENDATIONS
                    </p>
                    {agent.rewards.map((r: any) => (
                      <div key={r.id} style={{
                        marginBottom: 4, padding: '8px 10px',
                        border: '1px solid hsl(42 65% 52% / 0.2)',
                        borderRadius: 2,
                        backgroundColor: 'hsl(42 65% 52% / 0.05)',
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-display)', fontSize: '0.82rem',
                          fontWeight: 600, letterSpacing: '0.05em',
                          color: 'var(--color-amber)',
                        }}>
                          {r.title.toUpperCase()}
                        </p>
                        <p style={{
                          fontFamily: 'var(--font-body)', fontSize: '12px',
                          color: 'var(--color-text-muted)', marginTop: 2,
                        }}>
                          {r.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
