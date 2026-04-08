import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface StrikeRecord {
  id: string
  agentId: string
  reason: string
  severity: 'minor' | 'major'
  strikeNumber: number
  resolved: boolean
  trainingCompleted: boolean
  createdAt: string
}

export interface TrainingSession {
  id: string
  agentId: string
  strikeId: string | null
  reason: string
  status: 'scheduled' | 'active' | 'completed'
  severity: 'minor' | 'major'
  createdAt: string
}

export interface HiringRec {
  id: string
  department: string
  role: string
  candidateName: string
  model: string
  personalityNote: string
  skills: Array<{ name: string; level: string }>
  recommendedBy: string
  recommendationText: string
  hasDuplicateWarning: boolean
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface RewardRecord {
  id: string
  agentId: string
  type: 'badge' | 'promotion' | 'commendation'
  title: string
  reason: string
  createdAt: string
}

interface HRStore {
  strikes: StrikeRecord[]
  trainingSessions: TrainingSession[]
  hiringRecs: HiringRec[]
  rewards: RewardRecord[]

  addStrike: (s: StrikeRecord) => void
  resolveStrike: (id: string) => void
  addTraining: (t: TrainingSession) => void
  completeTraining: (id: string) => void
  addHiringRec: (h: HiringRec) => void
  updateHiringRec: (id: string, status: 'approved' | 'rejected') => void
  addReward: (r: RewardRecord) => void
}

export const useHRStore = create<HRStore>()(
  persist(
    (set) => ({
      strikes: [],
      trainingSessions: [],
      hiringRecs: [],
      rewards: [],

      addStrike: (s) => set(state => ({ strikes: [s, ...state.strikes] })),
      resolveStrike: (id) => set(state => ({
        strikes: state.strikes.map(s => s.id === id ? { ...s, resolved: true, trainingCompleted: true } : s)
      })),
      addTraining: (t) => set(state => ({ trainingSessions: [t, ...state.trainingSessions] })),
      completeTraining: (id) => set(state => ({
        trainingSessions: state.trainingSessions.map(t => t.id === id ? { ...t, status: 'completed' as const } : t)
      })),
      addHiringRec: (h) => set(state => ({ hiringRecs: [h, ...state.hiringRecs] })),
      updateHiringRec: (id, status) => set(state => ({
        hiringRecs: state.hiringRecs.map(h => h.id === id ? { ...h, status } : h)
      })),
      addReward: (r) => set(state => ({ rewards: [r, ...state.rewards] })),
    }),
    { name: 'the-colony-hr-store' }
  )
)
