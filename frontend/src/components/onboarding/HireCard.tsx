import { motion } from 'framer-motion'
import type { Agent, AIModel } from '../../types/agent'
import { departmentColors, departmentLabels } from '../../lib/departments'

interface HireCardProps {
  candidate: Partial<Agent>
  employeeNumber: number
  managerRecommendation: string
  onApprove: (candidate: Partial<Agent>) => void
  onReject: () => void
}

const modelLabels: Record<AIModel, string> = {
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'gpt-4o': 'GPT-4o',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
}

export function HireCard({ candidate, employeeNumber, managerRecommendation, onApprove, onReject }: HireCardProps) {
  const empId = `#${String(employeeNumber).padStart(4, '0')}`
  const deptColor = departmentColors[candidate.department!] || 'var(--color-primary)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -32, scale: 0.96 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-lg flex flex-col gap-5 p-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `1px solid ${deptColor}44`,
        borderRadius: '16px',
        boxShadow: `0 0 40px ${deptColor}18`,
      }}
    >
      {/* Dept color stripe */}
      <div className="h-0.5 w-full rounded-full" style={{ backgroundColor: deptColor }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-mono text-xs mb-1.5" style={{ color: deptColor, opacity: 0.8 }}>
            Candidate {empId}
          </p>
          <h2 className="font-heading text-xl" style={{ color: 'var(--color-text-primary)' }}>
            {candidate.name}
          </h2>
          <p className="font-heading text-sm font-medium mt-0.5" style={{ color: deptColor }}>
            {candidate.role}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-mono shrink-0"
          style={{ border: `1px solid ${deptColor}66`, color: deptColor, backgroundColor: `${deptColor}11` }}>
          {departmentLabels[candidate.department!]}
        </span>
      </div>

      {/* Skills */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-2"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          Skills
        </p>
        <div className="flex flex-wrap gap-2">
          {candidate.skills?.map((skill) => (
            <span key={skill.name}
              className="px-2.5 py-1 text-xs rounded-md"
              style={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}>
              {skill.name}
              <span className="ml-1.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {skill.level}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Sr. Executive recommendation */}
      <div className="p-4 rounded-lg"
        style={{
          backgroundColor: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
        }}>
        <p className="text-xs uppercase tracking-widest mb-1.5 font-mono"
          style={{ color: 'var(--color-text-muted)' }}>
          Sr. Executive Recommendation
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
          {managerRecommendation}
        </p>
      </div>

      {/* Personality */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-1 font-mono"
          style={{ color: 'var(--color-text-muted)' }}>
          Personality
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {candidate.personalityNote}
        </p>
      </div>

      {/* Model + footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Powered by</span>
          <span className="px-2 py-0.5 rounded text-xs font-mono"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-primary)',
            }}>
            {candidate.model ? modelLabels[candidate.model] : candidate.model}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => onApprove(candidate)}
          className="flex-1 py-3 font-heading font-semibold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-background)',
            borderRadius: '8px',
            border: 'none',
            boxShadow: 'var(--shadow-glow-primary)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          Approve Hire
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-3 font-heading font-semibold text-sm tracking-wide transition-all"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--color-danger)',
            color: 'var(--color-danger)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-danger)'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--color-danger)'
          }}
        >
          Request New Candidate
        </button>
      </div>
    </motion.div>
  )
}
