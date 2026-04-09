import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { HireCard } from './HireCard'
import { connectSocket, api } from '../../lib/api'
import type { Agent, Department, AIModel, AgentSkill } from '../../types/agent'
import type { DeptSelection } from './DepartmentSelector'

interface FoundingCandidate {
  name: string
  role: string
  department: string  // string to support custom departments
  model: AIModel
  personalityNote: string
  skills: AgentSkill[]
  recommendation: string
  tilePosition: { x: number; y: number }
  managerId: string
}

// Tile positions for each known department, plus overflow slots for custom depts
const DEPT_TILE_POSITIONS: Record<string, { x: number; y: number }> = {
  executive:   { x: 7, y: 1 },
  engineering: { x: 1, y: 4 },
  research:    { x: 6, y: 4 },
  writing:     { x: 11, y: 4 },
  legal:       { x: 1, y: 8 },
  ld:          { x: 11, y: 8 },
}
const CUSTOM_TILE_OVERFLOW = [
  { x: 5, y: 8 }, { x: 5, y: 3 }, { x: 3, y: 6 },
  { x: 8, y: 6 }, { x: 12, y: 6 }, { x: 2, y: 5 },
]

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
  selectedDepartments?: DeptSelection[]
}

export function OnboardingFlow({ onComplete, selectedDepartments }: OnboardingFlowProps) {
  // Build the active candidate list from DeptSelection (supports custom departments)
  const activeCandidates = useMemo<FoundingCandidate[]>(() => {
    if (!selectedDepartments || selectedDepartments.length === 0) return FOUNDING_CANDIDATES

    let customOverflowIdx = 0
    return selectedDepartments.map((sel) => {
      // Try to find a hardcoded template for this department
      const template = FOUNDING_CANDIDATES.find(c => c.department === sel.department)
      if (template) return template

      // Custom department — build a placeholder (LLM generation happens in generateCandidate)
      const tilePosition = DEPT_TILE_POSITIONS[sel.department]
        ?? CUSTOM_TILE_OVERFLOW[customOverflowIdx++ % CUSTOM_TILE_OVERFLOW.length]

      return {
        name: sel.label.charAt(0) + sel.label.slice(1).toLowerCase(), // e.g. 'Marketing'
        role: sel.role,
        department: sel.department,
        model: 'gpt-4o' as AIModel,
        personalityNote: `Specialist in ${sel.label.toLowerCase()}. Highly capable and eager to contribute.`,
        skills: [
          { name: 'Leadership', level: 'expert' as const },
          { name: 'Strategy', level: 'senior' as const },
          { name: 'Communication', level: 'expert' as const },
        ],
        recommendation: `A strong candidate for leading the ${sel.label} department. Brings the expertise and drive the colony needs.`,
        tilePosition,
        managerId: 'agent-0002',
      }
    })
  }, [selectedDepartments])

  const [hireIndex, setHireIndex] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedOverride, setGeneratedOverride] = useState<Pick<FoundingCandidate, 'name' | 'personalityNote' | 'skills' | 'recommendation'> | null>(null)
  const { addAgent, updateAgent, updateColony } = useColonyStore()

  const template = activeCandidates[hireIndex]
  const empNumber = hireIndex + 2

  const currentCandidate: FoundingCandidate = generatedOverride
    ? { ...template, ...generatedOverride }
    : template

  const generateCandidate = useCallback(async (index: number) => {
    const t = activeCandidates[index] // activeCandidates is stable (derived from props)
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
    const agentId = currentCandidate.department === 'executive' ? 'agent-0002' : `agent-${String(empNumber).padStart(4, '0')}`

    const newAgent: Agent = {
      id: agentId,
      employeeId: empNumber,
      name: candidate.name || currentCandidate.name,
      role: currentCandidate.role,
      tier: currentCandidate.department === 'executive' ? 'executive' : 'manager',
      department: currentCandidate.department as Department,
      model: currentCandidate.model,
      personalityNote: currentCandidate.personalityNote,
      skills: currentCandidate.skills,
      status: 'idle',
      hiredAt: new Date().toISOString(),
      strikes: [],
      rewards: [],
      managerId: currentCandidate.department === 'executive'
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

    if (hireIndex < activeCandidates.length - 1) {
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
      style={{ backgroundColor: 'var(--color-background)', overflow: 'hidden' }}>

      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
        zIndex: 50,
      }} />

      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsl(42 65% 52% / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(42 65% 52% / 0.04) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Progress indicator */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 12, height: 12,
            border: '2px solid var(--color-amber)',
            transform: 'rotate(45deg)',
            boxShadow: '0 0 8px hsl(42 65% 52% / 0.5)',
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            letterSpacing: '0.35em',
            color: 'var(--color-amber)',
            fontWeight: 700,
          }}>
            FOUNDING DEPARTMENT REVIEW
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.15em',
            color: 'hsl(42 65% 52% / 0.4)',
          }}>
            {hireIndex + 1}/{activeCandidates.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          {activeCandidates.map((c, i) => {
            const approved = i < hireIndex
            const active = i === hireIndex
            const deptColor = {
              executive: 'hsl(42 65% 52%)',
              engineering: 'hsl(199 89% 48%)',
              research: 'hsl(262 52% 47%)',
              writing: 'hsl(145 63% 42%)',
              legal: 'hsl(24 100% 50%)',
              ld: 'hsl(330 65% 52%)',
            }[c.department] || 'var(--color-primary)'
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 56 }}>
                <div style={{
                  height: 2,
                  width: '100%',
                  backgroundColor: approved
                    ? deptColor
                    : active
                      ? deptColor
                      : 'hsl(42 65% 52% / 0.12)',
                  opacity: approved ? 0.5 : 1,
                  boxShadow: active ? `0 0 8px ${deptColor}88` : 'none',
                  transition: 'all 0.4s',
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.1em',
                  color: approved
                    ? `${deptColor}66`
                    : active
                      ? deptColor
                      : 'hsl(42 65% 52% / 0.2)',
                  transition: 'color 0.4s',
                }}>
                  {c.name}
                </span>
              </div>
            )
          })}
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
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  minHeight: 340,
                  border: '1px solid hsl(42 65% 52% / 0.15)',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(42 65% 52% / 0.6)' }} />
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  color: 'hsl(42 65% 52% / 0.4)',
                }}>
                  ACCESSING PERSONNEL FILE...
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
            className="relative z-10 text-center flex flex-col items-center gap-6"
          >
            <div style={{
              width: 64, height: 64,
              border: '2px solid var(--color-amber)',
              transform: 'rotate(45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 40px hsl(42 65% 52% / 0.5)',
            }}>
              <span style={{ transform: 'rotate(-45deg)', fontSize: '1.5rem', color: 'var(--color-amber)' }}>✦</span>
            </div>
            <div>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: 'var(--color-amber)',
                textTransform: 'uppercase',
                textShadow: '0 0 40px hsl(42 65% 52% / 0.4)',
              }}>
                Colony Online
              </h2>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.3em',
                color: 'hsl(42 65% 52% / 0.55)',
                marginTop: 8,
              }}>
                {activeCandidates.length + 1} FOUNDING MEMBERS REPORTING FOR DUTY
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
