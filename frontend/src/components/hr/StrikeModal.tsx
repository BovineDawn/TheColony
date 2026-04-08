import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useHRStore } from '../../stores/hrStore'
import { useActivityStore } from '../../stores/activityStore'
import { departmentColors } from '../../lib/departments'
import type { Agent } from '../../types/agent'

interface StrikeModalProps {
  agent: Agent
  onClose: () => void
}

const STRIKE_REASONS = [
  'Hallucinated facts in output',
  'Failed to complete assigned task',
  'Provided incorrect information',
  'Did not follow instructions',
  'Quality below acceptable threshold',
  'Insubordination or out-of-scope response',
  'Custom reason...',
]

export function StrikeModal({ agent, onClose }: StrikeModalProps) {
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [severity, setSeverity] = useState<'minor' | 'major'>('minor')
  const [submitted, setSubmitted] = useState(false)

  const { updateAgent } = useColonyStore()
  const { addStrike, addTraining } = useHRStore()
  const { addEvent } = useActivityStore()

  const deptColor = departmentColors[agent.department]
  const strikeCount = agent.strikes.length + 1
  const finalReason = reason === 'Custom reason...' ? customReason : reason

  const handleSubmit = () => {
    if (!finalReason.trim()) return

    const strikeId = crypto.randomUUID()
    const now = new Date().toISOString()

    const newStrike = {
      id: strikeId,
      reason: finalReason,
      severity,
      date: now,
      resolved: false,
      trainingCompleted: false,
    }

    // Update agent in store
    updateAgent(agent.id, {
      strikes: [...agent.strikes, newStrike],
      status: strikeCount <= 2 ? 'training' : agent.status,
    })

    // Add to HR store
    addStrike({
      id: strikeId,
      agentId: agent.id,
      reason: finalReason,
      severity,
      strikeNumber: strikeCount,
      resolved: false,
      trainingCompleted: false,
      createdAt: now,
    })

    // Auto-schedule training for Strike 1 or 2
    if (strikeCount <= 2) {
      addTraining({
        id: crypto.randomUUID(),
        agentId: agent.id,
        strikeId,
        reason: `Strike #${strikeCount}: ${finalReason}`,
        status: 'scheduled',
        severity,
        createdAt: now,
      })
    }

    addEvent({ type: 'strike_issued', message: `Strike issued to ${agent.name}: ${finalReason}`, agentName: agent.name })

    setSubmitted(true)
    setTimeout(onClose, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md flex flex-col gap-5 p-6 rounded-2xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-danger)',
          boxShadow: 'var(--shadow-glow-danger)',
        }}
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertTriangle size={32} style={{ color: 'var(--color-danger)' }} />
            <p className="font-heading text-lg" style={{ color: 'var(--color-text-primary)' }}>
              Strike #{strikeCount} issued
            </p>
            {strikeCount <= 2 && (
              <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                L&D has been notified. Training session scheduled for {agent.name}.
              </p>
            )}
            {strikeCount >= 3 && (
              <p className="text-sm text-center" style={{ color: 'var(--color-danger)' }}>
                Strike #{strikeCount} — this requires your final decision.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
                  <span className="font-mono text-xs uppercase tracking-widest"
                    style={{ color: 'var(--color-danger)' }}>
                    Issue Strike
                  </span>
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

            {/* Strike count warning */}
            <div className="px-4 py-3 rounded-lg"
              style={{
                backgroundColor: strikeCount >= 3
                  ? 'hsl(0 72% 51% / 0.1)'
                  : 'hsl(38 92% 50% / 0.08)',
                border: `1px solid ${strikeCount >= 3 ? 'hsl(0 72% 51% / 0.4)' : 'hsl(38 92% 50% / 0.3)'}`,
              }}>
              <p className="text-sm" style={{
                color: strikeCount >= 3 ? 'var(--color-danger)' : 'var(--color-warning)'
              }}>
                {strikeCount === 1 && 'Strike 1 of 3 — L&D will schedule a training session.'}
                {strikeCount === 2 && 'Strike 2 of 3 — A formal training session will be visible on the colony map.'}
                {strikeCount >= 3 && `Strike ${strikeCount} — This will be escalated to you for a final decision.`}
              </p>
            </div>

            {/* Reason selector */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}>
                Reason
              </label>
              <div className="flex flex-col gap-1.5">
                {STRIKE_REASONS.map(r => (
                  <button key={r}
                    onClick={() => setReason(r)}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: reason === r ? 'hsl(0 72% 51% / 0.12)' : 'var(--color-surface-raised)',
                      border: reason === r ? '1px solid hsl(0 72% 51% / 0.5)' : '1px solid var(--color-border)',
                      color: reason === r ? 'var(--color-danger)' : 'var(--color-text-primary)',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom reason input */}
            <AnimatePresence>
              {reason === 'Custom reason...' && (
                <motion.textarea
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 80 }}
                  exit={{ opacity: 0, height: 0 }}
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Describe the issue..."
                  className="px-3 py-2 text-sm outline-none resize-none rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--color-danger)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />
              )}
            </AnimatePresence>

            {/* Severity */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}>
                Severity
              </label>
              <div className="flex gap-2">
                {(['minor', 'major'] as const).map(s => (
                  <button key={s}
                    onClick={() => setSeverity(s)}
                    className="flex-1 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: severity === s
                        ? (s === 'major' ? 'hsl(0 72% 51% / 0.2)' : 'hsl(38 92% 50% / 0.15)')
                        : 'var(--color-surface-raised)',
                      border: `1px solid ${severity === s
                        ? (s === 'major' ? 'hsl(0 72% 51% / 0.5)' : 'hsl(38 92% 50% / 0.4)')
                        : 'var(--color-border)'}`,
                      color: severity === s
                        ? (s === 'major' ? 'var(--color-danger)' : 'var(--color-warning)')
                        : 'var(--color-text-muted)',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Action */}
            <button
              onClick={handleSubmit}
              disabled={!finalReason.trim()}
              className="w-full py-3 font-heading font-semibold rounded-lg transition-all"
              style={{
                backgroundColor: finalReason.trim() ? 'var(--color-danger)' : 'transparent',
                border: '1px solid var(--color-danger)',
                color: finalReason.trim() ? 'white' : 'var(--color-danger)',
                opacity: finalReason.trim() ? 1 : 0.4,
                cursor: finalReason.trim() ? 'pointer' : 'not-allowed',
                boxShadow: finalReason.trim() ? 'var(--shadow-glow-danger)' : 'none',
              }}>
              Issue Strike #{strikeCount}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
