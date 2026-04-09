import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Loader2, Radio, FileText, ChevronDown,
  ChevronUp, Sparkles, MessageSquare, History, Play,
  Activity, Terminal, Zap,
} from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useMissionHistoryStore } from '../../stores/missionHistoryStore'
import { useActivityStore } from '../../stores/activityStore'
import { connectSocket, api } from '../../lib/api'
import { getModelLabel } from '../../lib/models'
import { playDemo, DEMO_PROMPT, DEMO_TITLE } from '../../lib/demoPlayback'
import type { Socket } from 'socket.io-client'

type Mode = 'chat' | 'formal'

interface ColonyEvent {
  type: string
  text?: string
  content?: string
  from_name?: string
  from_role?: string
  to_name?: string
  msg_type?: string
  agent_name?: string
  status?: string
  mission_title?: string
  timestamp: string
  stream_id?: string
  chunk?: string
  agent_id?: string
  score?: number
}

interface DisplayMessage {
  id: string
  role: 'founder' | 'executive' | 'system'
  content: string
  name?: string
  toName?: string
  msgType?: string
  timestamp: string
  isFormal?: boolean
  isInternal?: boolean
  missionTitle?: string
  streaming?: boolean
}

interface FeedEntry {
  id: string
  timestamp: string
  label: string
  detail?: string
  kind: 'agent' | 'delegation' | 'system' | 'complete' | 'error'
  agentName?: string
}


const EXAMPLE_PROMPTS = [
  'Research our top 3 competitors and summarize their strengths',
  'Draft a project status update for stakeholders',
  'Review our current processes and identify bottlenecks',
  'Create a risk assessment for our upcoming launch',
]

const TIER_COLOR: Record<string, string> = {
  executive: 'hsl(189 100% 50%)',
  manager:   'hsl(262 80% 64%)',
  worker:    'hsl(42 65% 52%)',
}

const STATUS_COLOR: Record<string, string> = {
  working:  'hsl(142 76% 53%)',
  thinking: 'hsl(189 100% 50%)',
  chatting: 'hsl(262 80% 64%)',
  idle:     'hsl(222 15% 35%)',
}

function formatElapsed(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function eventToFeed(ev: ColonyEvent): FeedEntry | null {
  const id = `feed-${ev.timestamp}-${Math.random()}`
  const timestamp = ev.timestamp

  if (ev.type === 'status_update') {
    const status = ev.status || 'idle'
    if (status === 'working') {
      return { id, timestamp, label: `${ev.agent_name || 'Agent'} activated`, kind: 'agent', agentName: ev.agent_name }
    }
    if (status === 'idle') {
      return { id, timestamp, label: `${ev.agent_name || 'Agent'} completed`, kind: 'agent', agentName: ev.agent_name }
    }
    return { id, timestamp, label: `${ev.agent_name || 'Agent'} → ${status}`, kind: 'agent', agentName: ev.agent_name }
  }

  if (ev.type === 'agent_message' && ev.msg_type === 'internal') {
    const to = ev.to_name ? ` → ${ev.to_name}` : ''
    const snippet = (ev.content || ev.text || '').slice(0, 100)
    return { id, timestamp, label: `${ev.from_name || 'Agent'}${to}`, detail: snippet, kind: 'delegation', agentName: ev.from_name }
  }

  if (ev.type === 'quality_score') {
    const score = ev.score ?? 0
    const color = score >= 80 ? 'complete' : score >= 60 ? 'agent' : 'error'
    return { id, timestamp, label: `${ev.agent_name} scored ${score.toFixed(0)}/100`, kind: color as FeedEntry['kind'], agentName: ev.agent_name }
  }

  if (ev.type === 'status') {
    return { id, timestamp, label: ev.text || 'Mission routing', kind: 'system' }
  }

  if (ev.type === 'mission_complete') {
    return { id, timestamp, label: 'Mission complete', kind: 'complete' }
  }

  if (ev.type === 'mission_cancelled') {
    return { id, timestamp, label: 'Mission stopped', kind: 'error' }
  }

  if (ev.type === 'error') {
    return { id, timestamp, label: `Error: ${ev.text}`, kind: 'error' }
  }

  return null
}

export function MissionControl() {
  const { agents, updateAgent } = useColonyStore()
  const { missions: historicalMissions, saveMission, activeSession, setActiveSession } = useMissionHistoryStore()
  const { addEvent } = useActivityStore()
  const [mode, setMode] = useState<Mode>('chat')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [formalTitle, setFormalTitle] = useState('')
  const [formalPriority, setFormalPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [messages, setMessages] = useState<DisplayMessage[]>(
    () => (activeSession?.messages ?? []) as DisplayMessage[]
  )
  const currentMissionTitleRef = useRef(activeSession?.title ?? '')
  const setCurrentMissionTitle = (t: string) => { currentMissionTitleRef.current = t }
  const [isRunning, setIsRunning] = useState(activeSession?.isRunning ?? false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set())
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([])
  const [auditEvents, setAuditEvents] = useState<ColonyEvent[]>([])
  const [showAuditRaw, setShowAuditRaw] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const feedBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const eventHandlerRef = useRef<((event: ColonyEvent) => void) | null>(null)
  const demoCleanupRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const executive = agents.find(a => a.tier === 'executive' && !a.isFounder)
  const founder   = agents.find(a => a.isFounder)

  // Elapsed timer
  useEffect(() => {
    if (isRunning) {
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning])

  useEffect(() => {
    api.get('/health')
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  // ── Extracted event handler ───────────────────────────────────────────────
  const handleColonyEvent = useCallback((event: ColonyEvent) => {
    if (!event?.type) return
    setAuditEvents(prev => [...prev, event])

    // Push to ops feed
    const entry = eventToFeed(event)
    if (entry) {
      setFeedEntries(prev => [...prev, entry])
    }

    if (event.type === 'agent_stream_start') {
      setMessages(prev => [...prev, {
        id: event.stream_id!,
        role: 'executive',
        content: '',
        name: event.from_name,
        msgType: event.msg_type,
        timestamp: event.timestamp,
        isFormal: event.msg_type === 'formal_report',
        streaming: true,
      }])
    }

    if (event.type === 'agent_stream_chunk') {
      setMessages(prev => prev.map(m =>
        m.id === event.stream_id ? { ...m, content: m.content + event.chunk } : m
      ))
    }

    if (event.type === 'agent_stream_end') {
      setMessages(prev => prev.map(m =>
        m.id === event.stream_id
          ? { ...m, content: event.content!, streaming: false, missionTitle: event.mission_title }
          : m
      ))
    }

    if (event.type === 'agent_message') {
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'executive',
        content: event.content || '',
        name: event.from_name,
        toName: event.to_name,
        msgType: event.msg_type,
        timestamp: event.timestamp,
        isFormal: event.msg_type === 'formal_report',
        isInternal: event.msg_type === 'internal',
        missionTitle: event.mission_title,
      }])
    }

    if (event.type === 'status_update') {
      const name = event.agent_name || ''
      if (event.status === 'working') {
        setActiveAgents(prev => new Set([...prev, name]))
        addEvent({ type: 'mission_start', message: `Working on mission`, agentName: name })
      } else if (event.status === 'idle' && name) {
        setActiveAgents(prev => { const s = new Set(prev); s.delete(name); return s })
        addEvent({ type: 'mission_complete', message: `Completed task`, agentName: name })
      } else {
        setActiveAgents(prev => { const s = new Set(prev); s.delete(name); return s })
      }
      // NOTE: Do NOT call updateAgent here. GlobalSocketHandler owns agent status
      // updates and has the cancelledAt stale-event guard. Calling updateAgent here
      // would bypass that guard and re-set agents to 'working' after cancellation.
    }

    if (event.type === 'status') {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: 'system',
        content: event.text || '',
        timestamp: event.timestamp,
      }])
    }

    if (event.type === 'mission_complete') {
      setIsRunning(false)
      setActiveAgents(new Set())
      setMessages(prev => {
        const finalMessages = [...prev, {
          id: `done-${Date.now()}`,
          role: 'system' as const,
          content: '✓ Mission complete',
          timestamp: event.timestamp,
        }]
        const mTitle = currentMissionTitleRef.current || 'Untitled Mission'
        saveMission({
          id: `mission-${Date.now()}`,
          title: mTitle,
          completedAt: new Date().toISOString(),
          messages: finalMessages,
        })
        addEvent({ type: 'mission_complete', message: `Mission complete: ${mTitle}` })
        return finalMessages
      })
    }

    if (event.type === 'mission_cancelled') {
      setIsRunning(false)
      setActiveAgents(new Set())
      useColonyStore.getState().agents
        .filter(a => ['working', 'thinking', 'chatting'].includes(a.status))
        .forEach(a => updateAgent(a.id, { status: 'idle' }))
      setMessages(prev => [...prev, {
        id: `cancel-${Date.now()}`,
        role: 'system',
        content: '⊘ Mission stopped by Founder',
        timestamp: event.timestamp,
      }])
    }

    if (event.type === 'error') {
      setIsRunning(false)
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error: ${event.text}`,
        timestamp: event.timestamp,
      }])
    }
  }, [agents, updateAgent, saveMission, addEvent])

  useEffect(() => { eventHandlerRef.current = handleColonyEvent }, [handleColonyEvent])

  // ── Socket listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket()
    socketRef.current = socket
    socket.on('connected', () => setBackendOnline(true))
    const stableHandler = (event: ColonyEvent) => eventHandlerRef.current?.(event)
    socket.on('colony_event', stableHandler)
    return () => {
      socket.off('connected')
      socket.off('colony_event', stableHandler)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feedEntries])

  // Persist active session
  useEffect(() => {
    if (messages.length === 0) return
    setActiveSession({
      messages: messages.map(m => ({ ...m, streaming: undefined }) as any),
      isRunning,
      title: currentMissionTitleRef.current,
    })
  }, [messages, isRunning, setActiveSession])

  const handleSend = () => {
    const socket = socketRef.current
    if (!socket || !input.trim() || isRunning) return

    const title = mode === 'formal'
      ? (formalTitle.trim() || input.trim().slice(0, 60))
      : input.trim().slice(0, 60)

    setCurrentMissionTitle(title)
    setFeedEntries([])

    setMessages([{
      id: `f-${Date.now()}`,
      role: 'founder',
      content: input.trim(),
      name: founder?.name || 'You',
      msgType: mode === 'formal' ? 'formal_report' : 'chat',
      timestamp: new Date().toISOString(),
      isFormal: mode === 'formal',
      missionTitle: mode === 'formal' ? title : undefined,
    }])

    setIsRunning(true)
    socket.emit('send_mission', {
      title,
      description: input.trim(),
      priority: formalPriority,
      msg_type: mode === 'formal' ? 'formal_report' : 'chat',
    })

    setInput('')
    setFormalTitle('')
    textareaRef.current?.focus()
  }

  const handleStop = () => {
    socketRef.current?.emit('cancel_missions', {})
  }

  const handleRunDemo = useCallback(() => {
    demoCleanupRef.current?.()
    setCurrentMissionTitle(DEMO_TITLE)
    setActiveSession(null)
    setFeedEntries([])
    setMessages([{
      id: 'demo-founder',
      role: 'founder',
      content: DEMO_PROMPT,
      name: founder?.name || 'You',
      timestamp: new Date().toISOString(),
    }])
    setIsRunning(true)
    setAuditEvents([])
    setActiveAgents(new Set())
    demoCleanupRef.current = playDemo(event => eventHandlerRef.current?.(event))
  }, [founder, setActiveSession])

  const priorityColors = {
    normal: 'var(--color-text-muted)',
    high:   'var(--color-warning)',
    urgent: 'var(--color-danger)',
  }

  const isEmpty = messages.length === 0
  const missionTitle = currentMissionTitleRef.current

  // Active non-founder agents from store
  const liveActiveAgents = agents.filter(
    a => !a.isFounder && ['working', 'thinking', 'chatting'].includes(a.status)
  )

  const feedKindColor: Record<FeedEntry['kind'], string> = {
    agent:      'hsl(142 76% 53%)',
    delegation: 'hsl(262 80% 64%)',
    system:     'hsl(189 100% 50%)',
    complete:   'hsl(142 76% 53%)',
    error:      'var(--color-danger)',
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Command Center Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-2.5"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}>

        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'hsl(189 100% 50% / 0.1)', border: '1px solid hsl(189 100% 50% / 0.25)' }}>
            <Terminal size={13} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-widest leading-none"
              style={{ color: 'var(--color-primary)', letterSpacing: '0.12em' }}>
              COMMAND CENTER
            </p>
            {isRunning && missionTitle ? (
              <p className="font-mono leading-none mt-0.5 truncate max-w-[180px]"
                style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                {missionTitle}
              </p>
            ) : (
              <p className="font-mono leading-none mt-0.5"
                style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                {executive?.name || 'Sr. Executive'} · {getModelLabel(executive?.model)}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* Mission status badge */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'hsl(142 76% 53% / 0.08)',
                border: '1px solid hsl(142 76% 53% / 0.3)',
              }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: 'hsl(142 76% 53%)', boxShadow: '0 0 6px hsl(142 76% 53%)' }} />
              <span className="font-mono text-xs" style={{ color: 'hsl(142 76% 53%)' }}>
                ACTIVE · {formatElapsed(elapsedSeconds)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}>
            {(['chat', 'formal'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setShowHistory(false) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-xs transition-all"
                style={{
                  backgroundColor: !showHistory && mode === m ? 'var(--color-primary)' : 'transparent',
                  color: !showHistory && mode === m ? 'var(--color-background)' : 'var(--color-text-muted)',
                  borderRight: m === 'chat' ? '1px solid var(--color-border)' : 'none',
                }}>
                {m === 'chat'
                  ? <><MessageSquare size={10} /> Chat</>
                  : <><FileText size={10} /> Brief</>
                }
              </button>
            ))}
          </div>

          <button
            onClick={() => { setShowHistory(v => !v); setSelectedHistoryId(null) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-xs transition-all"
            style={{
              backgroundColor: showHistory ? 'hsl(262 80% 64% / 0.15)' : 'transparent',
              border: '1px solid var(--color-border)',
              color: showHistory ? 'hsl(262 80% 64%)' : 'var(--color-text-muted)',
            }}>
            <History size={10} /> History
          </button>

          {isRunning && (
            <button
              onClick={handleStop}
              title="Stop all missions"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-xs transition-all"
              style={{
                backgroundColor: 'hsl(0 72% 51% / 0.1)',
                border: '1px solid hsl(0 72% 51% / 0.4)',
                color: 'var(--color-danger)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.2)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.1)'}
            >
              <span style={{ fontSize: '13px', lineHeight: 1 }}>⊘</span> STOP
            </button>
          )}
        </div>
      </div>

      {/* ── Main split pane ── */}
      <div className="flex-1 flex min-h-0">

        {/* ── LEFT: Ops Feed ── */}
        <div className="w-64 shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>

          {/* Active agents */}
          <div className="shrink-0 px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={10} style={{ color: 'var(--color-text-muted)' }} />
              <span className="font-mono tracking-widest"
                style={{ fontSize: '9px', color: 'var(--color-text-muted)', letterSpacing: '0.15em' }}>
                ACTIVE AGENTS
              </span>
            </div>

            {liveActiveAgents.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLOR.idle }} />
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                  No active agents
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {liveActiveAgents.map(agent => {
                  const color = TIER_COLOR[agent.tier] || TIER_COLOR.worker
                  const statusColor = STATUS_COLOR[agent.status] || STATUS_COLOR.idle
                  return (
                    <div key={agent.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded"
                      style={{
                        backgroundColor: `${color}08`,
                        border: `1px solid ${color}22`,
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                        style={{ backgroundColor: statusColor, boxShadow: `0 0 5px ${statusColor}` }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs leading-none truncate"
                          style={{ color: 'var(--color-text-primary)' }}>
                          {agent.name}
                        </p>
                        <p className="font-mono leading-none mt-0.5 truncate"
                          style={{ fontSize: '9px', color }}>
                          {agent.status.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 mx-3" style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

          {/* Ops feed */}
          <div className="flex items-center gap-2 px-3 pt-2 pb-1 shrink-0">
            <Zap size={10} style={{ color: 'var(--color-text-muted)' }} />
            <span className="font-mono tracking-widest"
              style={{ fontSize: '9px', color: 'var(--color-text-muted)', letterSpacing: '0.15em' }}>
              OPS FEED
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1">
            {feedEntries.length === 0 ? (
              <p className="font-mono px-2 py-2" style={{ fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.4 }}>
                Awaiting operations…
              </p>
            ) : (
              feedEntries.map(entry => (
                <div key={entry.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: feedKindColor[entry.kind] }} />
                    <span className="font-mono truncate"
                      style={{ fontSize: '10px', color: 'var(--color-text-primary)' }}>
                      {entry.label}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="font-mono pl-2.5 leading-relaxed"
                      style={{ fontSize: '9px', color: 'var(--color-text-muted)', opacity: 0.7 }}>
                      {entry.detail}
                    </p>
                  )}
                  <span className="font-mono pl-2.5"
                    style={{ fontSize: '9px', color: 'var(--color-text-muted)', opacity: 0.35 }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={feedBottomRef} />
          </div>

          {/* Raw audit toggle */}
          <div className="shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setShowAuditRaw(v => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 transition-colors"
              style={{ cursor: 'pointer', backgroundColor: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(222 30% 10%)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span className="font-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)', opacity: 0.5 }}>
                RAW LOG {auditEvents.length > 0 ? `(${auditEvents.length})` : ''}
              </span>
              {showAuditRaw
                ? <ChevronDown size={10} style={{ color: 'var(--color-text-muted)' }} />
                : <ChevronUp size={10} style={{ color: 'var(--color-text-muted)' }} />
              }
            </button>
            <AnimatePresence>
              {showAuditRaw && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 140 }}
                  exit={{ height: 0 }}
                  className="overflow-y-auto"
                  style={{ backgroundColor: 'var(--color-surface-raised)', borderTop: '1px solid var(--color-border)' }}>
                  <div className="p-2 flex flex-col gap-0.5">
                    {[...auditEvents].reverse().map((ev, i) => (
                      <div key={i} className="font-mono flex gap-2"
                        style={{ fontSize: '9px', color: ev.type === 'error' ? 'var(--color-danger)' : 'var(--color-text-muted)', opacity: 0.7 }}>
                        <span className="shrink-0" style={{ opacity: 0.5 }}>
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="truncate">
                          [{ev.type}] {ev.text || ev.from_name || ev.agent_name || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── RIGHT: Output ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* History view */}
          {showHistory && (
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {selectedHistoryId ? (() => {
                const hm = historicalMissions.find(m => m.id === selectedHistoryId)
                if (!hm) return null
                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedHistoryId(null)}
                        className="font-mono text-xs transition-colors"
                        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                        ← Back
                      </button>
                      <span className="font-heading text-sm flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {hm.title}
                      </span>
                      <span className="font-mono text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(hm.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {hm.messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'founder' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'system' ? (
                          <span className="font-mono text-xs px-3 py-1.5 rounded-full"
                            style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                            {msg.content}
                          </span>
                        ) : (
                          <div className="max-w-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                            style={{
                              backgroundColor: msg.role === 'founder' ? 'hsl(189 100% 50% / 0.12)' : 'var(--color-surface)',
                              border: msg.role === 'founder' ? '1px solid hsl(189 100% 50% / 0.3)' : '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                              borderRadius: msg.role === 'founder' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              fontFamily: 'var(--font-body)',
                            }}>
                            {msg.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })() : (
                historicalMissions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 opacity-50">
                    <History size={24} style={{ color: 'var(--color-text-muted)' }} />
                    <p className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>No completed missions yet</p>
                  </div>
                ) : (
                  historicalMissions.map(hm => (
                    <button key={hm.id}
                      onClick={() => setSelectedHistoryId(hm.id)}
                      className="w-full text-left px-4 py-3 rounded-xl transition-all"
                      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(262 80% 64% / 0.4)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                    >
                      <p className="font-heading text-sm mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                        {hm.title}
                      </p>
                      <p className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(hm.completedAt).toLocaleDateString()} · {hm.messages.length} messages
                      </p>
                    </button>
                  ))
                )
              )}
            </div>
          )}

          {/* Messages */}
          {!showHistory && (
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Empty state */}
              {isEmpty && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(189 100% 50% / 0.08)', border: '1px solid hsl(189 100% 50% / 0.2)' }}>
                    <Sparkles size={20} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
                  </div>
                  <div className="text-center">
                    <p className="font-heading text-base mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      {backendOnline
                        ? `Ready to coordinate with ${executive?.name || 'your team'}`
                        : 'Backend offline — add API keys to activate AI'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {backendOnline
                        ? 'Your message goes directly to the Sr. Executive, who coordinates the colony.'
                        : 'Edit backend/.env with your ANTHROPIC_API_KEY then restart the backend.'}
                    </p>
                  </div>

                  {backendOnline ? (
                    <div className="flex flex-col gap-2 w-full max-w-sm">
                      {EXAMPLE_PROMPTS.map(prompt => (
                        <button key={prompt}
                          onClick={() => setInput(prompt)}
                          className="text-left px-4 py-2.5 rounded-lg text-sm transition-all"
                          style={{
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'hsl(189 100% 50% / 0.35)'
                            e.currentTarget.style.color = 'var(--color-text-primary)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border)'
                            e.currentTarget.style.color = 'var(--color-text-muted)'
                          }}>
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={handleRunDemo}
                        disabled={isRunning}
                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-mono text-xs transition-all"
                        style={{
                          backgroundColor: 'hsl(42 65% 52% / 0.1)',
                          border: '1px solid hsl(42 65% 52% / 0.4)',
                          color: 'hsl(42 65% 52%)',
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.1em',
                        }}
                        onMouseEnter={e => {
                          if (!isRunning) {
                            e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.18)'
                            e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.7)'
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.1)'
                          e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.4)'
                        }}
                      >
                        <Play size={12} />
                        RUN DEMO MISSION
                      </button>
                      <p className="font-mono text-xs" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                        Simulates a full mission — no API key needed
                      </p>
                    </div>
                  )}
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${msg.role === 'founder' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'system' ? (
                      <div className="w-full flex justify-center">
                        <span className="font-mono text-xs px-3 py-1.5 rounded-full"
                          style={{
                            color: msg.content.startsWith('✓') ? 'var(--color-success)' : 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                          }}>
                          {msg.content}
                        </span>
                      </div>
                    ) : msg.isInternal ? (
                      <DelegationBubble msg={msg} />
                    ) : msg.isFormal ? (
                      <FormalReportBubble msg={msg} />
                    ) : (
                      <ChatBubble msg={msg} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator — shown when running but no active stream yet */}
              {isRunning && !messages.some(m => m.streaming) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderBottomLeftRadius: 4,
                    }}>
                    <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {liveActiveAgents.length > 0
                        ? `${liveActiveAgents.map(a => a.name).join(', ')} working…`
                        : `${executive?.name || 'Executive'} is coordinating…`}
                    </span>
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 flex flex-col gap-2.5 p-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
        }}>

        {/* Formal extras */}
        <AnimatePresence>
          {mode === 'formal' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 overflow-hidden"
            >
              <input
                value={formalTitle}
                onChange={e => setFormalTitle(e.target.value)}
                placeholder="Mission title…"
                className="flex-1 px-3 py-2 font-mono text-xs outline-none rounded-lg"
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
              <select
                value={formalPriority}
                onChange={e => setFormalPriority(e.target.value as any)}
                className="px-3 py-2 font-mono text-xs outline-none rounded-lg cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: priorityColors[formalPriority],
                }}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input row */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder={mode === 'chat'
              ? `Message ${executive?.name || 'the Sr. Executive'}…`
              : 'Describe the mission objectives…'}
            rows={2}
            disabled={isRunning}
            className="flex-1 px-4 py-3 text-sm outline-none resize-none rounded-xl"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              opacity: isRunning ? 0.5 : 1,
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isRunning}
            className="flex items-center justify-center rounded-xl transition-all"
            style={{
              width: '44px',
              height: '44px',
              flexShrink: 0,
              backgroundColor: input.trim() && !isRunning ? 'var(--color-primary)' : 'var(--color-surface-raised)',
              border: `1px solid ${input.trim() && !isRunning ? 'var(--color-primary)' : 'var(--color-border)'}`,
              color: input.trim() && !isRunning ? 'var(--color-background)' : 'var(--color-text-muted)',
              cursor: input.trim() && !isRunning ? 'pointer' : 'not-allowed',
              boxShadow: input.trim() && !isRunning ? 'var(--shadow-glow-primary)' : 'none',
            }}>
            {isRunning
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>

        <p className="text-center font-mono"
          style={{ fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.5 }}>
          ↵ send · ⇧↵ newline · goes to {executive?.name || 'Sr. Executive'} only
        </p>
      </div>
    </div>
  )
}

function ChatBubble({ msg }: { msg: DisplayMessage }) {
  const isFounder = msg.role === 'founder'
  return (
    <div className="max-w-lg flex flex-col gap-1"
      style={{ alignItems: isFounder ? 'flex-end' : 'flex-start' }}>
      {msg.name && (
        <span className="font-mono px-1"
          style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {msg.name}
        </span>
      )}
      <div
        className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          backgroundColor: isFounder ? 'hsl(189 100% 50% / 0.12)' : 'var(--color-surface)',
          border: isFounder
            ? '1px solid hsl(189 100% 50% / 0.3)'
            : '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          borderRadius: isFounder ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          fontFamily: 'var(--font-body)',
        }}>
        {msg.content}
        {msg.streaming && (
          <span className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse"
            style={{ backgroundColor: 'var(--color-primary)' }} />
        )}
      </div>
    </div>
  )
}

function FormalReportBubble({ msg }: { msg: DisplayMessage }) {
  const [expanded, setExpanded] = useState(msg.role === 'executive')
  const isFounder = msg.role === 'founder'

  return (
    <div className="w-full max-w-2xl flex flex-col gap-1"
      style={{ alignItems: isFounder ? 'flex-end' : 'flex-start' }}>
      {msg.name && (
        <span className="font-mono px-1"
          style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {msg.name}
        </span>
      )}
      <div className="w-full rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}>
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
          style={{
            borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(222 30% 13%)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'hsl(262 80% 64% / 0.12)', border: '1px solid hsl(262 80% 64% / 0.25)' }}>
            <FileText size={13} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <span className="font-heading text-sm flex-1"
            style={{ color: 'var(--color-text-primary)' }}>
            {msg.missionTitle ? `Report: ${msg.missionTitle}` : 'Formal Report'}
          </span>
          {expanded
            ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
          }
        </button>
        {expanded && (
          <div className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-body)',
              maxHeight: '420px',
            }}>
            {msg.content}
            {msg.streaming && (
              <span className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse"
                style={{ backgroundColor: 'var(--color-primary)' }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DelegationBubble({ msg }: { msg: DisplayMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = msg.content.length > 120

  return (
    <div className="flex justify-start w-full">
      <div style={{
        borderLeft: '2px solid hsl(262 80% 64% / 0.4)',
        paddingLeft: '12px',
        maxWidth: '520px',
        minWidth: '200px',
      }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono"
            style={{ fontSize: '9px', color: 'hsl(262 80% 64%)', letterSpacing: '0.08em' }}>
            {msg.name}
            {msg.toName && (
              <span style={{ color: 'var(--color-text-dim)' }}> → {msg.toName}</span>
            )}
          </span>
          <span className="font-mono"
            style={{ fontSize: '8px', color: 'var(--color-text-dim)', letterSpacing: '0.14em', opacity: 0.6 }}>
            INTERNAL
          </span>
        </div>
        <p className="leading-relaxed"
          style={{
            fontFamily: 'var(--font-body)', fontSize: '12px',
            color: 'var(--color-text-muted)',
            display: isLong && !expanded ? '-webkit-box' : 'block',
            WebkitLineClamp: isLong && !expanded ? 2 : undefined,
            WebkitBoxOrient: isLong && !expanded ? 'vertical' : undefined,
            overflow: isLong && !expanded ? 'hidden' : 'visible',
          } as React.CSSProperties}>
          {msg.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="font-mono mt-1"
            style={{ fontSize: '9px', color: 'hsl(262 80% 64%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.7 }}>
            {expanded ? '↑ less' : '↓ more'}
          </button>
        )}
      </div>
    </div>
  )
}
