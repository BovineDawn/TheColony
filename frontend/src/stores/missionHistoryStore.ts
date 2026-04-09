import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HistoricalMission {
  id: string
  title: string
  completedAt: string
  formalReport?: string          // final compiled ARIA report (markdown)
  messages: Array<{
    id: string
    role: 'founder' | 'executive' | 'system'
    content: string
    name?: string
    timestamp: string
    isFormal?: boolean
  }>
}

export interface ActiveSession {
  messages: HistoricalMission['messages']
  isRunning: boolean
  title: string
}

interface MissionHistoryStore {
  missions: HistoricalMission[]
  activeSession: ActiveSession | null
  saveMission: (mission: HistoricalMission) => void
  setActiveSession: (session: ActiveSession | null) => void
  clearHistory: () => void
}

export const useMissionHistoryStore = create<MissionHistoryStore>()(
  persist(
    (set) => ({
      missions: [],
      activeSession: null,
      saveMission: (mission) => set((s) => ({
        missions: [mission, ...s.missions].slice(0, 50),
        activeSession: null,
      })),
      setActiveSession: (session) => set({ activeSession: session }),
      clearHistory: () => set({ missions: [], activeSession: null }),
    }),
    { name: 'the-colony-mission-history' }
  )
)
