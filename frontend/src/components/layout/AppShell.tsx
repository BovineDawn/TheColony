import { useUIStore } from '../../stores/uiStore'
import { useColonyStore } from '../../stores/colonyStore'
import { useHRStore } from '../../stores/hrStore'
import { GlobalSocketHandler } from './GlobalSocketHandler'
import { ColonyMap } from '../colony-map/ColonyMap'
import { MorningBriefing } from '../dashboard/MorningBriefing'
import { AgentProfilePanel } from '../panels/AgentProfilePanel'
import { MissionControl } from '../mission/MissionControl'
import { OrgChart } from '../panels/OrgChart'
import { HiringPipeline } from '../hr/HiringPipeline'
import { FounderInbox } from '../inbox/FounderInbox'
import { SettingsPanel } from '../settings/SettingsPanel'
import {
  LayoutDashboard, Map, MessageSquare, GitBranch,
  UserPlus, Settings, Users, Wifi, WifiOff, Activity, Bell,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { api, connectSocket } from '../../lib/api'

const NAV_ITEMS = [
  { id: 'dashboard',       icon: LayoutDashboard, label: 'Dashboard'       },
  { id: 'colony-map',      icon: Map,             label: 'Colony Map'      },
  { id: 'mission-control', icon: MessageSquare,   label: 'Mission Control' },
  { id: 'org-chart',       icon: GitBranch,       label: 'Org Chart'       },
  { id: 'hiring',          icon: UserPlus,        label: 'Hiring'          },
  { id: 'inbox',           icon: Bell,            label: 'Inbox'           },
] as const

export function AppShell() {
  const { activeView, setActiveView } = useUIStore()
  const { colony, agents, missions, resetAgentStatuses } = useColonyStore()
  const { hiringRecs }               = useHRStore()
  const [backendOnline, setBackendOnline] = useState(false)

  const pendingHires   = hiringRecs.filter(h => h.status === 'pending').length
  const strikeEscalations = agents.filter(a => (a.strikes || []).filter((s: any) => !s.resolved).length >= 3).length
  const inboxCount     = pendingHires + strikeEscalations
  const activeAgents   = agents.filter(a => ['working', 'thinking', 'chatting'].includes(a.status))
  const activeMissions = missions.filter(m => m.status === 'in_progress').length

  useEffect(() => {
    const check = () =>
      api.get('/health')
        .then(() => setBackendOnline(true))
        .catch(() => setBackendOnline(false))
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  // ── DB sync: push localStorage agents to backend if DB is empty ───────────
  // Happens when the founding ceremony ran while the backend was offline.
  useEffect(() => {
    if (!backendOnline || agents.length === 0) return
    api.get('/api/agents/').then((dbAgents: any[]) => {
      if (dbAgents.length > 0) return  // DB already populated — nothing to do
      const socket = connectSocket()
      agents.forEach(agent => {
        socket.emit('new_hire_onboarding', { agent })
      })
    }).catch(() => {/* backend not ready yet */})
  }, [backendOnline, agents])

  return (
    <div className="fixed inset-0 flex" style={{ backgroundColor: 'var(--color-background)' }}>
      <GlobalSocketHandler />

      {/* ══════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════ */}
      <nav
        style={{
          width: '56px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '12px',
          paddingBottom: '12px',
          gap: '2px',
          backgroundColor: 'hsl(215 22% 7%)',
          borderRight: '1px solid var(--color-border)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Colony logo / emblem */}
        <div style={{ marginBottom: 18, marginTop: 4, position: 'relative' }}>
          {/* Outer diamond */}
          <div style={{
            width: 28, height: 28,
            transform: 'rotate(45deg)',
            border: '1.5px solid var(--color-amber)',
            boxShadow: '0 0 12px hsl(42 65% 52% / 0.35), inset 0 0 8px hsl(42 65% 52% / 0.08)',
            position: 'relative',
          }}>
            {/* Inner dot */}
            <div style={{
              position: 'absolute', inset: '6px',
              backgroundColor: 'var(--color-amber)',
              opacity: 0.35,
            }} />
          </div>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = activeView === id
          const badge    = id === 'hiring' && pendingHires > 0 ? pendingHires
                         : id === 'inbox' && inboxCount > 0 ? inboxCount
                         : 0

          return (
            <div key={id} className="relative group" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setActiveView(id)}
                title={label}
                style={{
                  width: 40, height: 40,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', cursor: 'pointer', border: 'none',
                  backgroundColor: isActive
                    ? 'hsl(42 65% 52% / 0.12)'
                    : 'transparent',
                  color: isActive
                    ? 'var(--color-amber)'
                    : 'var(--color-text-dim)',
                  outline: isActive
                    ? '1px solid hsl(42 65% 52% / 0.3)'
                    : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'hsl(215 14% 14%)'
                    e.currentTarget.style.color = 'var(--color-text-muted)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--color-text-dim)'
                  }
                }}
              >
                <Icon size={16} />

                {/* Active indicator — left edge bar */}
                {isActive && (
                  <div style={{
                    position: 'absolute', left: -8, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3, height: 20, borderRadius: '0 2px 2px 0',
                    backgroundColor: 'var(--color-amber)',
                    boxShadow: '0 0 8px hsl(42 65% 52% / 0.6)',
                  }} />
                )}

                {/* Badge */}
                {badge > 0 && (
                  <div style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: 'var(--color-warning)',
                    color: 'hsl(215 22% 6%)',
                    fontSize: '8px', fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {badge}
                  </div>
                )}
              </button>

              {/* Tooltip */}
              <div style={{
                position: 'absolute', left: 50, top: '50%',
                transform: 'translateY(-50%) translateX(-4px)',
                padding: '5px 10px', borderRadius: 3,
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                letterSpacing: '0.1em',
                backgroundColor: 'hsl(215 20% 12%)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap', pointerEvents: 'none',
                opacity: 0, transition: 'opacity 0.15s, transform 0.15s',
                zIndex: 50,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
                ref={el => {
                  if (!el) return
                  const parent = el.closest('.group') as HTMLElement
                  if (!parent) return
                  const show = () => {
                    el.style.opacity = '1'
                    el.style.transform = 'translateY(-50%) translateX(0)'
                  }
                  const hide = () => {
                    el.style.opacity = '0'
                    el.style.transform = 'translateY(-50%) translateX(-4px)'
                  }
                  parent.addEventListener('mouseenter', show)
                  parent.addEventListener('mouseleave', hide)
                }}
              >
                {label}
              </div>
            </div>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* Settings */}
        <button
          title="Settings"
          onClick={() => setActiveView('settings')}
          style={{
            width: 40, height: 40, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: activeView === 'settings' ? 'var(--color-amber)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeView === 'settings' ? 'hsl(42 65% 52% / 0.12)' : 'transparent',
            outline: activeView === 'settings' ? '1px solid hsl(42 65% 52% / 0.3)' : '1px solid transparent',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (activeView !== 'settings') {
              e.currentTarget.style.color = 'var(--color-text-muted)'
              e.currentTarget.style.backgroundColor = 'hsl(215 14% 14%)'
            }
          }}
          onMouseLeave={e => {
            if (activeView !== 'settings') {
              e.currentTarget.style.color = 'var(--color-text-dim)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <Settings size={15} />
        </button>
      </nav>

      {/* ══════════════════════════════════════
          MAIN AREA
      ══════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Top bar ── */}
        <header style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center',
          height: '48px',
          padding: '0 20px',
          backgroundColor: 'hsl(215 22% 7%)',
          borderBottom: '1px solid var(--color-border)',
          gap: 16,
        }}>

          {/* LEFT: colony identity */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem', fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--color-amber)',
              textShadow: '0 0 16px hsl(42 65% 52% / 0.25)',
            }}>
              {colony?.name?.toUpperCase() || 'THE COLONY'}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: 'var(--color-border)',
            }}>
              /
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              letterSpacing: '0.12em',
              color: 'var(--color-text-dim)',
            }}>
              {activeView === 'dashboard'       ? 'MORNING BRIEFING'
               : activeView === 'colony-map'      ? 'COLONY MAP'
               : activeView === 'mission-control' ? 'MISSION CONTROL'
               : activeView === 'org-chart'       ? 'ORG CHART'
               : activeView === 'hiring'          ? 'HIRING PIPELINE'
               : activeView === 'inbox'           ? 'INBOX'
               : activeView === 'settings'        ? 'SETTINGS'
               : String(activeView).toUpperCase()}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* CENTER: live activity strip — shows who is working and navigates to Mission Control */}
          {activeAgents.length > 0 && (
            <button
              onClick={() => setActiveView('mission-control')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 14px', borderRadius: 20,
                backgroundColor: 'hsl(189 100% 50% / 0.07)',
                border: '1px solid hsl(189 100% 50% / 0.22)',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'hsl(189 100% 50% / 0.13)'
                e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'hsl(189 100% 50% / 0.07)'
                e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.22)'
              }}
            >
              <Activity size={10} style={{ color: 'var(--color-primary)' }} className="animate-pulse" />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                letterSpacing: '0.08em', color: 'var(--color-primary)',
              }}>
                {activeAgents.slice(0, 3).map(a => a.name).join(' · ')}
                {activeAgents.length > 3 ? ` +${activeAgents.length - 3}` : ''}
                {' — WORKING'}
              </span>
            </button>
          )}

          {/* Reset stuck agents button */}
          {activeAgents.length > 0 && (
            <button
              onClick={resetAgentStatuses}
              title="Force-reset all agent statuses to idle"
              style={{
                padding: '3px 10px', borderRadius: 20,
                backgroundColor: 'hsl(0 72% 51% / 0.08)',
                border: '1px solid hsl(0 72% 51% / 0.3)',
                color: 'var(--color-danger)',
                fontFamily: 'var(--font-mono)', fontSize: '8px',
                letterSpacing: '0.12em', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.18)'
                e.currentTarget.style.borderColor = 'hsl(0 72% 51% / 0.55)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.08)'
                e.currentTarget.style.borderColor = 'hsl(0 72% 51% / 0.3)'
              }}
            >
              RESET
            </button>
          )}

          {/* RIGHT: metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>

            {/* Agents count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={11} style={{ color: 'var(--color-text-dim)' }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                letterSpacing: '0.1em', color: 'var(--color-text-dim)',
              }}>
                {agents.length} COLONISTS
              </span>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 16, backgroundColor: 'var(--color-border)' }} />

            {/* Missions */}
            {activeMissions > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={11} style={{ color: 'var(--color-primary)' }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '9px',
                    letterSpacing: '0.1em', color: 'var(--color-primary)',
                  }}>
                    {activeMissions} MISSION{activeMissions > 1 ? 'S' : ''}
                  </span>
                </div>
                <div style={{ width: 1, height: 16, backgroundColor: 'var(--color-border)' }} />
              </>
            )}

            {/* Backend status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {backendOnline
                ? <Wifi size={11} style={{ color: 'var(--color-success)' }} />
                : <WifiOff size={11} style={{ color: 'var(--color-text-dim)' }} />
              }
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                letterSpacing: '0.1em',
                color: backendOnline ? 'var(--color-success)' : 'var(--color-text-dim)',
              }}>
                {backendOnline ? 'AI ONLINE' : 'AI OFFLINE'}
              </span>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {activeView === 'dashboard'       && <MorningBriefing />}
          {activeView === 'colony-map'      && <ColonyMap />}
          {activeView === 'mission-control' && <MissionControl />}
          {activeView === 'org-chart'       && <OrgChart />}
          {activeView === 'hiring'          && <HiringPipeline />}
          {activeView === 'inbox'           && <FounderInbox />}
          {activeView === 'settings'        && <SettingsPanel />}
        </div>
      </div>

      {/* Agent profile panel overlay */}
      <AgentProfilePanel />
    </div>
  )
}
