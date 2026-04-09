import { useState } from 'react'
import { motion } from 'framer-motion'
import { Award, X } from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useHRStore } from '../../stores/hrStore'
import { useActivityStore } from '../../stores/activityStore'
import { departmentColors } from '../../lib/departments'
import { api } from '../../lib/api'
import type { Agent } from '../../types/agent'

interface RewardModalProps {
  agent: Agent
  onClose: () => void
}

const REWARD_TYPES = [
  { value: 'commendation', label: 'Commendation', desc: 'Recognize outstanding work', color: 'var(--color-warning)' },
  { value: 'badge',        label: 'Badge',         desc: 'Award a skill achievement badge', color: 'var(--color-primary)' },
  { value: 'promotion',    label: 'Promotion',     desc: 'Promote to a new role title', color: 'var(--color-secondary)' },
] as const

export function RewardModal({ agent, onClose }: RewardModalProps) {
  const [type, setType] = useState<'commendation' | 'badge' | 'promotion'>('commendation')
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { updateAgent } = useColonyStore()
  const { addReward } = useHRStore()
  const { addEvent } = useActivityStore()
  const deptColor = departmentColors[agent.department]

  const handleSubmit = () => {
    if (!title.trim() || !reason.trim()) return

    const rewardId = crypto.randomUUID()
    const now = new Date().toISOString()

    const newReward = { id: rewardId, type, title, reason, date: now }

    updateAgent(agent.id, {
      rewards: [...agent.rewards, newReward],
      ...(type === 'promotion' ? { role: title } : {}),
    })

    addReward({ id: rewardId, agentId: agent.id, type, title, reason, createdAt: now })
    addEvent({ type: 'reward_granted', message: `${agent.name} commended: ${title}`, agentName: agent.name })

    // Persist to backend
    api.post('/api/hr/rewards', {
      agent_id: agent.id,
      type,
      title,
      reason,
      granted_by: 'founder',
    }).catch(() => {/* backend offline — reward saved locally */})

    setSubmitted(true)
    setTimeout(onClose, 1600)
  }

  const selectedType = REWARD_TYPES.find(t => t.value === type)!

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md flex flex-col gap-5 p-6 rounded-2xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: `1px solid ${selectedType.color}44`,
          boxShadow: `0 0 30px ${selectedType.color}22`,
        }}
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Award size={36} style={{ color: selectedType.color }} />
            <p className="font-heading text-xl" style={{ color: 'var(--color-text-primary)' }}>
              {type === 'promotion' ? `${agent.name} promoted!` : `Reward granted to ${agent.name}`}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Award size={16} style={{ color: selectedType.color }} />
                  <span className="font-mono text-xs uppercase tracking-widest"
                    style={{ color: selectedType.color }}>Grant Reward</span>
                </div>
                <h3 className="font-heading text-xl" style={{ color: 'var(--color-text-primary)' }}>
                  {agent.name}
                </h3>
                <p className="text-xs font-mono mt-0.5" style={{ color: deptColor }}>
                  #{String(agent.employeeId).padStart(4, '0')} · {agent.role}
                </p>
              </div>
              <button onClick={onClose}
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                <X size={18} />
              </button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {REWARD_TYPES.map(rt => (
                <button key={rt.value} onClick={() => setType(rt.value)}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-all"
                  style={{
                    backgroundColor: type === rt.value ? `${rt.color}18` : 'var(--color-surface-raised)',
                    border: `1px solid ${type === rt.value ? rt.color + '66' : 'var(--color-border)'}`,
                  }}>
                  <span className="font-heading text-xs font-semibold"
                    style={{ color: type === rt.value ? rt.color : 'var(--color-text-muted)' }}>
                    {rt.label}
                  </span>
                  <span className="text-xs leading-tight"
                    style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    {rt.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}>
                {type === 'promotion' ? 'New Role Title' : 'Award Title'}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={type === 'promotion' ? 'e.g. Senior Researcher' : 'e.g. Excellence in Research'}
                className="px-3 py-2.5 text-sm outline-none rounded-lg"
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = selectedType.color}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'} />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}>
                Reason
              </label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Why are you recognizing this agent?"
                rows={3}
                className="px-3 py-2.5 text-sm outline-none resize-none rounded-lg"
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = selectedType.color}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'} />
            </div>

            <button onClick={handleSubmit}
              disabled={!title.trim() || !reason.trim()}
              className="w-full py-3 font-heading font-semibold rounded-lg transition-all"
              style={{
                backgroundColor: title.trim() && reason.trim() ? selectedType.color : 'transparent',
                border: `1px solid ${selectedType.color}`,
                color: title.trim() && reason.trim() ? 'var(--color-background)' : selectedType.color,
                opacity: title.trim() && reason.trim() ? 1 : 0.4,
                cursor: title.trim() && reason.trim() ? 'pointer' : 'not-allowed',
              }}>
              {type === 'promotion' ? 'Promote Agent' : 'Grant Reward'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
