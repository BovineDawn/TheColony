import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HistoricalMission {
  id: string
  title: string
  completedAt: string
  messages: Array<{
    id: string
    role: 'founder' | 'executive' | 'system'
    content: string
    name?: string
    timestamp: string
  }>
}

interface MissionHistoryStore {
  missions: HistoricalMission[]
  saveMission: (mission: HistoricalMission) => void
  clearHistory: () => void
}

export const useMissionHistoryStore = create<MissionHistoryStore>()(
  persist(
    (set) => ({
      missions: [],
      saveMission: (mission) => set((s) => ({
        missions: [mission, ...s.missions].slice(0, 50),
      })),
      clearHistory: () => set({ missions: [] }),
    }),
    { name: 'the-colony-mission-history' }
  )
)
