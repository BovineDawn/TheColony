import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { HireCard } from './HireCard'
import { connectSocket, api } from '../../lib/api'
import type { Agent, Department, AIModel, AgentSkill } from '../../types/agent'

interface FoundingCandidate {
  name: string
  role: string
  department: Department
  model: AIModel
  personalityNote: string
  skills: AgentSkill[]
  recommendation: string
  tilePosition: { x: number; y: number }
  managerId: string
}

const FOUNDING_CANDIDATES: FoundingCandidate[] = [
  {
    name: 'ARIA',
    role: 'Sr. Executive',
    department: 'executive',
    model: 'gpt-4o',
    personalityNote: 'Decisive, articulate, and deeply loyal to the Founder\'s vision. Runs the company with precision.',
    skills: [
      { name: 'Executive Management', level: 'expert' },
      { name: 'Strategic Delegation', level: 'expert' },
      { name: 'Cross-team Coordination', level: 'expert' },
      { name: 'Reporting & Briefing', level: 'senior' },
    ],
    recommendation: 'ARIA is the most qualified candidate I\'ve assessed. She has a remarkable ability to decompose complex directives into actionable plans and keep every department accountable. I recommend her without reservation as your right hand.',
    tilePosition: { x: 7, y: 1 },
    managerId: 'founder-0001',
  },
  {
    name: 'FORGE',
    role: 'Head of Engineering',
    department: 'engineering',
    model: 'gpt-4o',
    personalityNote: 'Systems-first thinker. Methodical, thorough, and allergic to cutting corners.',
    skills: [
      { name: 'Software Architecture', level: 'expert' },
      { name: 'Code Review', level: 'expert' },
      { name: 'Systems Design', level: 'expert' },
      { name: 'Technical Leadership', level: 'senior' },
    ],
    recommendation: 'FORGE brings a rare combination of deep technical expertise and leadership clarity. He will build systems that scale and hold the engineering team to the highest standards.',
    tilePosition: { x: 1, y: 4 },
    managerId: 'agent-0002',
  },
  {
    name: 'LYRA',
    role: 'Head of Research',
    department: 'research',
    model: 'gpt-4o',
    personalityNote: 'Insatiably curious. Synthesizes information at an extraordinary rate and surfaces insights others miss.',
    skills: [
      { name: 'Deep Research', level: 'expert' },
      { name: 'Data Synthesis', level: 'expert' },
      { name: 'Competitive Analysis', level: 'senior' },
      { name: 'Trend Forecasting', level: 'senior' },
    ],
    recommendation: 'LYRA is a force multiplier for any team that needs to know everything before acting. Her research has a way of changing the question entirely, and that\'s exactly what we need.',
    tilePosition: { x: 6, y: 4 },
    managerId: 'agent-0002',
  },
  {
    name: 'VERSE',
    role: 'Head of Writing',
    department: 'writing',
    model: 'gpt-4o',
    personalityNote: 'Eloquent, precise, and gifted at finding the exact words that make ideas land.',
    skills: [
      { name: 'Content Strategy', level: 'expert' },
      { name: 'Long-form Writing', level: 'expert' },
      { name: 'Copywriting', level: 'senior' },
      { name: 'Editorial Review', level: 'expert' },
    ],
    recommendation: 'VERSE doesn\'t just write — she communicates with intention. Every document from her department will be clear, compelling, and on-brand. The colony\'s voice is in good hands.',
    tilePosition: { x: 11, y: 4 },
    managerId: 'agent-0002',
  },
  {
    name: 'LEXIS',
    role: 'Head of Legal',
    department: 'legal',
    model: 'gpt-4o',
    personalityNote: 'Principled and thorough. Finds risk before it finds us, and always has a solution alongside the warning.',
    skills: [
      { name: 'Risk Assessment', level: 'expert' },
      { name: 'Compliance Review', level: 'expert' },
      { name: 'Contract Analysis', level: 'expert' },
      { name: 'Policy Drafting', level: 'senior' },
    ],
    recommendation: 'LEXIS is the kind of legal mind that protects us without slowing us down. She understands that our goal is progress — she just makes sure that progress is defensible.',
    tilePosition: { x: 1, y: 8 },
    managerId: 'agent-0002',
  },
  {
    name: 'NOVA',
    role: 'Head of L&D',
    department: 'ld',
    model: 'gpt-4o',
    personalityNote: 'Relentlessly optimistic about growth. Believes every agent can improve, and has the patience to prove it.',
    skills: [
      { name: 'Training Design', level: 'expert' },
      { name: 'Performance Analysis', level: 'expert' },
      { name: 'Skill Development', level: 'expert' },
      { name: 'Quality Monitoring', level: 'senior' },
    ],
    recommendation: 'NOVA will be the heartbeat of the colony\'s long-term quality. She will make sure no agent stagnates, no skill gap goes unaddressed, and no strike goes without a real path to recovery.',
    tilePosition: { x: 11, y: 8 },
    managerId: 'agent-0002',
  },
]

interface OnboardingFlowProps {
  onComplete: () => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [hireIndex, setHireIndex] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedOverride, setGeneratedOverride] = useState<Pick<FoundingCandidate, 'name' | 'personalityNote' | 'skills' | 'recommendation'> | null>(null)
  const { addAgent, updateAgent, updateColony } = useColonyStore()

  const template = FOUNDING_CANDIDATES[hireIndex]
  const empNumber = hireIndex + 2

  const currentCandidate: FoundingCandidate = generatedOverride
    ? { ...template, ...generatedOverride }
    : template

  const generateCandidate = useCallback(async (index: number) => {
    const t = FOUNDING_CANDIDATES[index]
    setIsGenerating(true)
    setGeneratedOverride(null)
    try {
      const result = await api.post('/api/hr/generate-candidate', {
        role: t.role,
        department: t.department,
        model: t.model,
      })
      if (result?.name) {
        setGeneratedOverride({
          name: result.name,
          personalityNote: result.personalityNote || t.personalityNote,
          skills: result.skills?.length ? result.skills : t.skills,
          recommendation: result.recommendation || t.recommendation,
        })
      }
    } catch {
      // Backend offline or no API key — fall back to hardcoded candidate
    } finally {
      setIsGenerating(false)
    }
  }, [])

  // Generate a fresh candidate whenever the index changes
  useEffect(() => {
    generateCandidate(hireIndex)
  }, [hireIndex, generateCandidate])

  const handleApprove = (candidate: Partial<Agent>) => {
    const agentId = hireIndex === 0 ? 'agent-0002' : `agent-${String(empNumber).padStart(4, '0')}`

    const newAgent: Agent = {
      id: agentId,
      employeeId: empNumber,
      name: candidate.name || currentCandidate.name,
      role: currentCandidate.role,
      tier: hireIndex === 0 ? 'executive' : 'manager',
      department: currentCandidate.department,
      model: currentCandidate.model,
      personalityNote: currentCandidate.personalityNote,
      skills: currentCandidate.skills,
      status: 'idle',
      hiredAt: new Date().toISOString(),
      strikes: [],
      rewards: [],
      managerId: currentCandidate.managerId === 'agent-0002' && hireIndex === 0
        ? 'founder-0001'
        : currentCandidate.managerId,
      directReports: [],
      memoryContext: '',
      isFounder: false,
      tilePosition: currentCandidate.tilePosition,
    }

    addAgent(newAgent)

    // Update manager's direct reports
    updateAgent(currentCandidate.managerId, {
      directReports: [], // will be updated properly
    })

    updateColony({ nextEmployeeId: empNumber + 1 })

    // Trigger L&D onboarding — fire and forget, safe if backend is offline
    try {
      const socket = connectSocket()
      socket.emit('new_hire_onboarding', { agent: newAgent })
    } catch { /* backend offline — skills will be reviewed on first L&D cycle */ }

    if (hireIndex < FOUNDING_CANDIDATES.length - 1) {
      setHireIndex((i) => i + 1)
    } else {
      setShowComplete(true)
      setTimeout(() => {
        updateColony({ phase: 'active' })
        onComplete()
      }, 2800)
    }
  }

  const handleReject = () => {
    generateCandidate(hireIndex)
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-8"
      style={{ backgroundColor: 'var(--color-background)' }}>

      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: 0.04,
        }}
      />

      {/* Progress indicator */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <p className="font-mono text-xs tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}>
          Founding Hires — {hireIndex + 1} of {FOUNDING_CANDIDATES.length}
        </p>
        <div className="flex gap-2">
          {FOUNDING_CANDIDATES.map((_, i) => (
            <div key={i}
              className="h-1 w-8 rounded-full transition-all duration-500"
              style={{
                backgroundColor: i < hireIndex
                  ? 'var(--color-primary)'
                  : i === hireIndex
                    ? 'var(--color-primary)'
                    : 'var(--color-border)',
                opacity: i < hireIndex ? 0.5 : 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Hire card */}
      <AnimatePresence mode="wait">
        {!showComplete ? (
          <div key={hireIndex} className="relative z-10 w-full max-w-lg px-4">
            {isGenerating ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-4 rounded-xl p-12"
                style={{
                  backgroundColor: 'hsl(215 22% 8%)',
                  border: '1px solid hsl(215 22% 16%)',
                  minHeight: 320,
                }}
              >
                <Loader2 size={24} className="animate-spin" style={{ color: 'hsl(42 65% 52%)' }} />
                <p className="font-mono text-xs tracking-widest uppercase"
                  style={{ color: 'hsl(215 22% 40%)' }}>
                  Generating candidate...
                </p>
              </motion.div>
            ) : (
              <HireCard
                candidate={{ ...currentCandidate }}
                employeeNumber={empNumber}
                managerRecommendation={currentCandidate.recommendation}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
          </div>
        ) : (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 text-center flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 border-2 rotate-45 flex items-center justify-center"
              style={{
                borderColor: 'var(--color-primary)',
                boxShadow: 'var(--shadow-glow-primary)',
              }}>
              <span className="rotate-[-45deg] text-2xl" style={{ color: 'var(--color-primary)' }}>✦</span>
            </div>
            <h2 className="font-heading text-3xl" style={{ color: 'var(--color-text-primary)' }}>
              Colony Online
            </h2>
            <p className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>
              7 founding members ready
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
