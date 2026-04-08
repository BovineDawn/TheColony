export type AgentStatus = 'idle' | 'thinking' | 'working' | 'chatting' | 'training' | 'terminated'
export type AgentTier = 'founder' | 'executive' | 'manager' | 'worker'
export type Department = 'executive' | 'engineering' | 'research' | 'writing' | 'legal' | 'ld'
export type AIModel = 'claude-3-5-sonnet' | 'gpt-4o' | 'gemini-1.5-pro'
export type SkillLevel = 'junior' | 'mid' | 'senior' | 'expert'

export interface AgentSkill {
  name: string
  level: SkillLevel
}

export interface Strike {
  id: string
  reason: string
  severity: 'minor' | 'major'
  date: string
  resolved: boolean
  trainingCompleted: boolean
}

export interface Reward {
  id: string
  type: 'badge' | 'promotion' | 'commendation'
  title: string
  date: string
  reason: string
}

export interface Agent {
  id: string
  employeeId: number
  name: string
  role: string
  tier: AgentTier
  department: Department
  model: AIModel
  personalityNote: string
  skills: AgentSkill[]
  status: AgentStatus
  hiredAt: string
  strikes: Strike[]
  rewards: Reward[]
  managerId: string | null
  directReports: string[]
  memoryContext: string
  isFounder: boolean
  tilePosition: { x: number; y: number }
}
