import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Loader2, Radio, FileText, ChevronDown,
  ChevronUp, Sparkles, MessageSquare, History, Play
} from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useMissionHistoryStore } from '../../stores/missionHistoryStore'
import { useActivityStore } from '../../stores/activityStore'
import { connectSocket, api } from '../../lib/api'
import { playDemo, DEMO_PROMPT, DEMO_TITLE } from '../../lib/demoPlayback'
import type { Socket } from 'socket.io-client'

type Mode = 'chat' | 'formal'

interface ColonyEvent {
  type: string
  text?: string
  content?: string
  from_name?: string
  from_role?: string
  msg_type?: string
  agent_name?: string
  status?: string
  mission_title?: string
  timestamp: string
}

interface DisplayMessage {
  id: string
  role: 'founder' | 'executive' | 'system'
  content: string
  name?: string
  msgType?: string
  timestamp: string
  isFormal?: boolean
  missionTitle?: string
  streaming?: boolean
}

const MODEL_LABELS: Record<string, string> = {
  'claude-3-5-sonnet': 'Claude',
  'gpt-4o':            'GPT-4o',
  'gemini-1.5-pro':    'Gemini',
}

const EXAMPLE_PROMPTS = [
  'Research our top 3 competitors and summarize their strengths',
  'Draft a project status update for stakeholders',
  'Review our current processes and identify bottlenecks',
  'Create a risk assessment for our upcoming launch',
]

export function MissionControl() {
  const { agents, updateAgent } = useColonyStore()
  const { missions: historicalMissions, saveMission } = useMissionHistoryStore()
  const { addEvent } = useActivityStore()
  const [mode, setMode] = useState<Mode>('chat')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [formalTitle, setFormalTitle] = useState('')
  const [formalPriority, setFormalPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const currentMissionTitleRef = useRef('')
  const setCurrentMissionTitle = (t: string) => { currentMissionTitleRef.current = t }
  const [isRunning, setIsRunning] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set())
  const [showAudit, setShowAudit] = useState(false)
  const [auditEvents, setAuditEvents] = useState<ColonyEvent[]>([])
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const eventHandlerRef = useRef<((event: ColonyEvent) => void) | null>(null)
  const demoCleanupRef = useRef<(() => void) | null>(null)

  const executive = agents.find(a => a.tier === 'executive' && !a.isFounder)
  const founder   = agents.find(a => a.isFounder)

  useEffect(() => {
    api.get('/health')
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  // ── Extracted event handler (used by both socket and demo playback) ────────
  const handleColonyEvent = useCallback((event: ColonyEvent) => {
    if (!event?.type) return
    setAuditEvents(prev => [...prev, event])

    if (event.type === 'agent_stream_start') {
      setMessages(prev => [...prev, {
        id: event.stream_id,
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
          ? { ...m, content: event.content, streaming: false, missionTitle: event.mission_title }
          : m
      ))
    }

    if (event.type === 'agent_message' && event.msg_type !== 'internal') {
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'executive',
        content: event.content || '',
        name: event.from_name,
        msgType: event.msg_type,
        timestamp: event.timestamp,
        isFormal: event.msg_type === 'formal_report',
        missionTitle: event.mission_title,
      }])
    }

    if (event.type === 'status_update') {
      const name = event.agent_name || ''
      if (event.status === 'working') {
        setActiveAgents(prev => new Set([...prev, name]))
      } else {
        setActiveAgents(prev => { const s = new Set(prev); s.delete(name); return s })
      }
      const agentId = agents.find(a => a.name === name)?.id
      if (agentId) updateAgent(agentId, { status: (event.status || 'idle') as any })
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

  // Keep ref pointing at the latest handler so the stable socket listener
  // always calls the current version without re-subscribing.
  useEffect(() => { eventHandlerRef.current = handleColonyEvent }, [handleColonyEvent])

  // ── Socket listener (set up once) ────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket()
    socketRef.current = socket
    socket.on('connected', () => setBackendOnline(true))
    // Stable wrapper — safe for socket.off
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

  const handleSend = () => {
    const socket = socketRef.current
    if (!socket || !input.trim() || isRunning) return

    const title = mode === 'formal'
      ? (formalTitle.trim() || input.trim().slice(0, 60))
      : input.trim().slice(0, 60)

    setCurrentMissionTitle(title)

    setMessages(prev => [...prev, {
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

  const handleRunDemo = useCallback(() => {
    demoCleanupRef.current?.()
    setCurrentMissionTitle(DEMO_TITLE)
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
  }, [founder])

  const priorityColors = {
    normal: 'var(--color-text-muted)',
    high:   'var(--color-warning)',
    urgent: 'var(--color-danger)',
  }

  const isEmpty = messages.length === 0

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-3"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}>

        {/* Agent info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'hsl(189 100% 50% / 0.1)', border: '1px solid hsl(189 100% 50% / 0.25)' }}>
            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold leading-none mb-0.5"
              style={{ color: 'var(--color-text-primary)' }}>
              {executive?.name || 'Sr. Executive'}
            </p>
            <p className="font-mono text-xs leading-none"
              style={{ color: 'var(--color-text-muted)' }}>
              {executive ? MODEL_LABELS[executive.model] || executive.model : '—'}
              {' · '}Direct line
            </p>
          </div>
        </div>

        {/* Active agents */}
        <AnimatePresence>
          {activeAgents.size > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'hsl(189 100% 50% / 0.1)',
                border: '1px solid hsl(189 100% 50% / 0.3)',
              }}>
              <Radio size={11} className="animate-pulse" style={{ color: 'var(--color-primary)' }} />
              <span className="font-mono text-xs" style={{ color: 'var(--color-primary)' }}>
                {[...activeAgents].slice(0, 2).join(', ')}
                {activeAgents.size > 2 ? ` +${activeAgents.size - 2}` : ''} working
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden shrink-0"
          style={{ border: '1px solid var(--color-border)' }}>
          {(['chat', 'formal'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setShowHistory(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-all"
              style={{
                backgroundColor: !showHistory && mode === m ? 'var(--color-primary)' : 'transparent',
                color: !showHistory && mode === m ? 'var(--color-background)' : 'var(--color-text-muted)',
                borderRight: m === 'chat' ? '1px solid var(--color-border)' : 'none',
              }}>
              {m === 'chat'
                ? <><MessageSquare size={11} /> Chat</>
                : <><FileText size={11} /> Brief</>
              }
            </button>
          ))}
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-all"
            style={{
              backgroundColor: showHistory ? 'hsl(262 80% 64% / 0.2)' : 'transparent',
              color: showHistory ? 'hsl(262 80% 64%)' : 'var(--color-text-muted)',
              borderLeft: '1px solid var(--color-border)',
            }}>
            <History size={11} /> History
          </button>
        </div>
      </div>

      {/* ── History View ── */}
      {showHistory && (
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
          {selectedHistoryId ? (() => {
            const hm = historicalMissions.find(m => m.id === selectedHistoryId)
            if (!hm) return null
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedHistoryId(null)}
                    className="flex items-center gap-1 font-mono text-xs"
                    style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ← Back
                  </button>
                  <span className="font-heading text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {hm.title}
                  </span>
                  <span className="font-mono text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
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
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
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

      {/* ── Messages ── */}
      {!showHistory && <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'hsl(189 100% 50% / 0.08)', border: '1px solid hsl(189 100% 50% / 0.2)' }}>
              <Sparkles size={20} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
            </div>
            <div className="text-center">
              <p className="font-heading text-base mb-1"
                style={{ color: 'var(--color-text-primary)' }}>
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
              ) : msg.isFormal ? (
                <FormalReportBubble msg={msg} />
              ) : (
                <ChatBubble msg={msg} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator — only shown while waiting for the stream to start */}
        {isRunning && !messages.some(m => m.streaming) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderBottomLeftRadius: 4,
              }}>
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {executive?.name || 'Executive'} is coordinating…
              </span>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>}

      {/* ── Audit drawer ── */}
      <div className="shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setShowAudit(v => !v)}
          className="w-full flex items-center justify-between px-5 py-2 transition-colors"
          style={{ backgroundColor: 'var(--color-surface)', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(222 30% 13%)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
        >
          <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Audit log
            {auditEvents.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                {auditEvents.length}
              </span>
            )}
          </span>
          {showAudit
            ? <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
            : <ChevronUp size={12} style={{ color: 'var(--color-text-muted)' }} />
          }
        </button>

        <AnimatePresence>
          {showAudit && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 180 }}
              exit={{ height: 0 }}
              className="overflow-y-auto"
              style={{
                backgroundColor: 'var(--color-surface-raised)',
                borderTop: '1px solid var(--color-border)',
              }}>
              <div className="p-3 flex flex-col gap-1">
                {auditEvents.length === 0
                  ? <p className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>No events yet.</p>
                  : [...auditEvents].reverse().map((ev, i) => (
                    <div key={i} className="font-mono text-xs flex gap-3">
                      <span className="shrink-0" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                      <span style={{ color: ev.type === 'error' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        [{ev.type}] {ev.text || ev.from_name || ev.agent_name || ''}
                      </span>
                    </div>
                  ))
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
