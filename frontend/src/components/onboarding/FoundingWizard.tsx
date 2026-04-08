import { motion } from 'framer-motion'
import { useState } from 'react'
import { useColonyStore } from '../../stores/colonyStore'
import type { Agent } from '../../types/agent'
import type { Colony } from '../../types/colony'

interface FoundingWizardProps {
  onComplete: () => void
}

export function FoundingWizard({ onComplete }: FoundingWizardProps) {
  const [colonyName, setColonyName] = useState('The Colony')
  const [founderName, setFounderName] = useState('')
  const { setColony, addAgent } = useColonyStore()

  const handleFound = () => {
    if (!founderName.trim()) return

    const colony: Colony = {
      id: crypto.randomUUID(),
      name: colonyName || 'The Colony',
      foundedAt: new Date().toISOString(),
      phase: 'onboarding',
      nextEmployeeId: 2,
    }

    const founder: Agent = {
      id: 'founder-0001',
      employeeId: 1,
      name: founderName.trim(),
      role: 'Founder & CEO',
      tier: 'founder',
      department: 'executive',
      model: 'claude-3-5-sonnet',
      personalityNote: 'The visionary and architect of The Colony.',
      skills: [
        { name: 'Leadership', level: 'expert' },
        { name: 'Strategy', level: 'expert' },
        { name: 'Vision', level: 'expert' },
      ],
      status: 'idle',
      hiredAt: new Date().toISOString(),
      strikes: [],
      rewards: [],
      managerId: null,
      directReports: [],
      memoryContext: '',
      isFounder: true,
      tilePosition: { x: 6, y: 0 },
    }

    setColony(colony)
    addAgent(founder)
    onComplete()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)' }}>

      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: 0.04,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md p-8 flex flex-col gap-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 border rotate-45"
              style={{ borderColor: 'var(--color-primary)' }} />
            <span className="font-mono text-xs tracking-widest uppercase"
              style={{ color: 'var(--color-primary)' }}>
              Founding Day
            </span>
          </div>
          <h1 className="font-heading text-2xl" style={{ color: 'var(--color-text-primary)' }}>
            Establish Your Colony
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            You will be Employee <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>#0001</span>.
          </p>
        </div>

        {/* Colony name */}
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Colony Name
          </label>
          <input
            value={colonyName}
            onChange={(e) => setColonyName(e.target.value)}
            className="px-4 py-3 font-heading text-base outline-none transition-all"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
          />
        </div>

        {/* Founder name */}
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Your Name
          </label>
          <input
            value={founderName}
            onChange={(e) => setFounderName(e.target.value)}
            placeholder="Enter your name"
            className="px-4 py-3 font-heading text-base outline-none transition-all"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleFound}
          disabled={!founderName.trim()}
          className="mt-2 py-3.5 font-heading font-semibold tracking-wide transition-all"
          style={{
            backgroundColor: founderName.trim() ? 'var(--color-primary)' : 'transparent',
            border: '1px solid var(--color-primary)',
            color: founderName.trim() ? 'var(--color-background)' : 'var(--color-primary)',
            borderRadius: '8px',
            opacity: founderName.trim() ? 1 : 0.35,
            boxShadow: founderName.trim() ? 'var(--shadow-glow-primary)' : 'none',
            cursor: founderName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Establish Colony
        </button>
      </motion.div>
    </div>
  )
}
