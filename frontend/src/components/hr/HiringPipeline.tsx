import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, AlertTriangle } from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useHRStore } from '../../stores/hrStore'
import { useActivityStore } from '../../stores/activityStore'
import { departmentColors, departmentLabels } from '../../lib/departments'
import { connectSocket } from '../../lib/api'
import type { AIModel, AgentSkill, Department } from '../../types/agent'

const DEPARTMENTS: Department[] = ['engineering', 'research', 'writing', 'legal', 'ld']
const MODELS: AIModel[] = ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro']
const MODEL_LABELS: Record<AIModel, string> = {
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'gpt-4o': 'GPT-4o',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
}

export function HiringPipeline() {
  const { agents, addAgent, colony, updateColony } = useColonyStore()
  const { hiringRecs, addHiringRec, updateHiringRec } = useHRStore()
  const { addEvent } = useActivityStore()
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [dept, setDept] = useState<Department>('engineering')
  const [role, setRole] = useState('')
  const [name, setName] = useState('')
  const [model, setModel] = useState<AIModel>('claude-3-5-sonnet')
  const [personality, setPersonality] = useState('')
  const [recText, setRecText] = useState('')
  const [skills, setSkills] = useState('')

  const pendingRecs = hiringRecs.filter(h => h.status === 'pending')
  const manager = agents.find(a => a.department === dept && a.tier === 'manager')

  const hasDuplicate = agents.some(a =>
    a.department === dept && a.role.toLowerCase() === role.toLowerCase() && a.status !== 'terminated'
  )

  const submitRec = () => {
    if (!role.trim() || !name.trim() || !recText.trim()) return

    const parsedSkills: AgentSkill[] = skills.split(',')
      .filter(s => s.trim())
      .map(s => ({ name: s.trim(), level: 'mid' as const }))

    const rec = {
      id: crypto.randomUUID(),
      department: dept,
      role: role.trim(),
      candidateName: name.trim(),
      model,
      personalityNote: personality.trim(),
      skills: parsedSkills,
      recommendedBy: manager?.name || 'Sr. Executive',
      recommendationText: recText.trim(),
      hasDuplicateWarning: hasDuplicate,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }

    addHiringRec(rec)
    setShowForm(false)
    setRole(''); setName(''); setPersonality(''); setRecText(''); setSkills('')
  }

  const approveHire = (rec: typeof pendingRecs[0]) => {
    const nextId = colony?.nextEmployeeId ?? agents.length + 1
    const mgr = agents.find(a => a.department === rec.department && a.tier === 'manager')
    const parsedSkills = rec.skills as AgentSkill[]

    // Assign a tile position — generate all zone tiles dynamically
    const ZONE_BOUNDS: Record<string, { xs: number[]; ys: number[] }> = {
      engineering: { xs: [0,1,2,3], ys: [3,4,5,6] },
      research:    { xs: [5,6,7,8], ys: [3,4,5,6] },
      writing:     { xs: [10,11,12,13], ys: [3,4,5,6] },
      legal:       { xs: [0,1,2,3], ys: [8,9,10] },
      ld:          { xs: [10,11,12,13], ys: [8,9,10] },
      executive:   { xs: [4,5,6,7,8,9], ys: [0,1] },
    }
    const bounds = ZONE_BOUNDS[rec.department]
    const occupied = new Set(agents.map(a => `${a.tilePosition.x},${a.tilePosition.y}`))
    const tilePos = bounds
      ? bounds.xs.flatMap(x => bounds.ys.map(y => ({ x, y })))
          .find(t => !occupied.has(`${t.x},${t.y}`)) ?? { x: 0, y: 0 }
      : { x: 0, y: 0 }

    const newAgent = {
      id: crypto.randomUUID(),
      employeeId: nextId,
      name: rec.candidateName,
      role: rec.role,
      tier: 'worker' as const,
      department: rec.department as Department,
      model: rec.model as AIModel,
      personalityNote: rec.personalityNote,
      skills: parsedSkills,
      status: 'idle' as const,
      hiredAt: new Date().toISOString(),
      strikes: [],
      rewards: [],
      managerId: mgr?.id || null,
      directReports: [],
      memoryContext: '',
      isFounder: false,
      tilePosition: tilePos,
    }

    addAgent(newAgent)
    updateColony({ nextEmployeeId: nextId + 1 })
    updateHiringRec(rec.id, 'approved')
    addEvent({ type: 'agent_hired', message: `${rec.candidateName} joined as ${rec.role}`, agentName: rec.candidateName })

    // Trigger L&D onboarding training for the new hire
    try {
      const socket = connectSocket()
      socket.emit('new_hire_onboarding', { agent: newAgent })
    } catch { /* backend offline — onboarding will run on next L&D cycle */ }
  }

  const rejectHire = (id: string) => updateHiringRec(id, 'rejected')

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div>
          <h2 className="font-heading text-lg" style={{ color: 'var(--color-text-primary)' }}>
            Hiring Pipeline
          </h2>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {pendingRecs.length} pending approval{pendingRecs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-heading text-sm transition-all"
          style={{
            backgroundColor: showForm ? 'transparent' : 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
            color: showForm ? 'var(--color-primary)' : 'var(--color-background)',
          }}>
          <UserPlus size={14} />
          {showForm ? 'Cancel' : 'Submit Recommendation'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">

        {/* Submission form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-4 p-5 rounded-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="font-mono text-xs uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}>
                New Hire Recommendation
              </p>

              {/* Duplicate warning */}
              <AnimatePresence>
                {hasDuplicate && role && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-start gap-2 p-3 rounded-lg"
                    style={{ backgroundColor: 'hsl(38 92% 50% / 0.1)', border: '1px solid hsl(38 92% 50% / 0.3)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                      A {role} already exists in {departmentLabels[dept]}. This hire requires your explicit approval as a duplicate role.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>Department</label>
                  <select value={dept} onChange={e => setDept(e.target.value as Department)}
                    className="px-3 py-2.5 text-sm outline-none rounded-lg cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border)',
                      color: departmentColors[dept],
                    }}>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{departmentLabels[d]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>AI Model</label>
                  <select value={model} onChange={e => setModel(e.target.value as AIModel)}
                    className="px-3 py-2.5 text-sm outline-none rounded-lg cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-primary)',
                    }}>
                    {MODELS.map(m => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
                  </select>
                </div>
              </div>

              {[
                { label: 'Candidate Name', val: name, set: setName, ph: 'e.g. NEXUS' },
                { label: 'Role Title', val: role, set: setRole, ph: 'e.g. Senior Engineer' },
                { label: 'Personality Note', val: personality, set: setPersonality, ph: 'One line description of their character...' },
                { label: 'Skills (comma-separated)', val: skills, set: setSkills, ph: 'e.g. React, TypeScript, Testing' },
              ].map(({ label, val, set, ph }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
                  <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    className="px-3 py-2.5 text-sm outline-none rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'} />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Recommendation
                </label>
                <textarea value={recText} onChange={e => setRecText(e.target.value)}
                  placeholder="Why should this candidate be hired?"
                  rows={3}
                  className="px-3 py-2.5 text-sm outline-none resize-none rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'} />
              </div>

              {manager && (
                <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  Submitted as recommendation from: <span style={{ color: departmentColors[dept] }}>{manager.name}</span>
                </p>
              )}

              <button onClick={submitRec}
                disabled={!role.trim() || !name.trim() || !recText.trim()}
                className="py-3 font-heading font-semibold rounded-lg transition-all"
                style={{
                  backgroundColor: role && name && recText ? 'var(--color-primary)' : 'transparent',
                  border: '1px solid var(--color-primary)',
                  color: role && name && recText ? 'var(--color-background)' : 'var(--color-primary)',
                  opacity: role && name && recText ? 1 : 0.35,
                  cursor: role && name && recText ? 'pointer' : 'not-allowed',
                  boxShadow: role && name && recText ? 'var(--shadow-glow-primary)' : 'none',
                }}>
                Submit for Founder Approval
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending recommendations */}
        {pendingRecs.length > 0 && (
          <div>
            <p className="font-mono text-xs uppercase tracking-widest mb-3"
              style={{ color: 'var(--color-text-muted)' }}>
              Pending Your Approval
            </p>
            <div className="flex flex-col gap-3">
              {pendingRecs.map(rec => {
                const color = departmentColors[rec.department as Department] || 'var(--color-primary)'
                return (
                  <motion.div key={rec.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-xl flex flex-col gap-4"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: `1px solid ${color}33`,
                    }}>
                    <div className="h-0.5 rounded-full" style={{ backgroundColor: color }} />

                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-xs mb-1" style={{ color, opacity: 0.8 }}>
                          Candidate — {departmentLabels[rec.department as Department]}
                        </p>
                        <h3 className="font-heading text-lg" style={{ color: 'var(--color-text-primary)' }}>
                          {rec.candidateName}
                        </h3>
                        <p className="font-heading text-sm" style={{ color }}>{rec.role}</p>
                      </div>

                      {rec.hasDuplicateWarning && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                          style={{ backgroundColor: 'hsl(38 92% 50% / 0.1)', border: '1px solid hsl(38 92% 50% / 0.3)' }}>
                          <AlertTriangle size={12} style={{ color: 'var(--color-warning)' }} />
                          <span className="font-mono text-xs" style={{ color: 'var(--color-warning)' }}>
                            Duplicate role
                          </span>
                        </div>
                      )}
                    </div>

                    {rec.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {rec.skills.map((s: any) => (
                          <span key={s.name} className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: 'var(--color-surface-raised)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-muted)',
                            }}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                      <p className="font-mono text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                        {rec.recommendedBy}
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                        {rec.recommendationText}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>Powered by</span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono"
                        style={{
                          backgroundColor: 'var(--color-surface-raised)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-primary)',
                        }}>
                        {MODEL_LABELS[rec.model as AIModel] || rec.model}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => approveHire(rec)}
                        className="flex-1 py-2.5 font-heading font-semibold text-sm rounded-lg transition-all"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-background)',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-glow-primary)',
                        }}>
                        Approve Hire
                      </button>
                      <button onClick={() => rejectHire(rec.id)}
                        className="flex-1 py-2.5 font-heading font-semibold text-sm rounded-lg transition-all"
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-danger)',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                        }}>
                        Reject
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {pendingRecs.length === 0 && !showForm && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
            <UserPlus size={32} style={{ color: 'var(--color-text-muted)' }} />
            <p className="font-mono text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
              No pending recommendations.<br />
              Submit one above or wait for a manager to recommend a hire.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
