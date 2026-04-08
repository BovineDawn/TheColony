import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LDLogEntry {
  id: string
  type: 'start' | 'reviewing' | 'reviewed' | 'skill_update' | 'complete' | 'error'
  message: string
  agentName?: string
  timestamp: string
}

interface LDStore {
  isRunning: boolean
  lastRun: string | null
  lastSummary: string | null
  currentAgent: string | null
  logs: LDLogEntry[]
  stats: { reviewed: number; trainingPlans: number; skillUpdates: number }
  setRunning: (v: boolean) => void
  setLastRun: (timestamp: string, summary: string) => void
  setCurrentAgent: (name: string | null) => void
  addLog: (log: Omit<LDLogEntry, 'id'>) => void
  resetStats: () => void
  incrementStat: (key: 'reviewed' | 'trainingPlans' | 'skillUpdates') => void
}

export const useLDStore = create<LDStore>()(
  persist(
    (set) => ({
      isRunning: false,
      lastRun: null,
      lastSummary: null,
      currentAgent: null,
      logs: [],
      stats: { reviewed: 0, trainingPlans: 0, skillUpdates: 0 },
      setRunning: (v) => set({ isRunning: v }),
      setLastRun: (timestamp, summary) => set({ lastRun: timestamp, lastSummary: summary }),
      setCurrentAgent: (name) => set({ currentAgent: name }),
      addLog: (log) => set((s) => ({
        logs: [{ ...log, id: crypto.randomUUID() }, ...s.logs].slice(0, 200),
      })),
      resetStats: () => set({ stats: { reviewed: 0, trainingPlans: 0, skillUpdates: 0 } }),
      incrementStat: (key) => set((s) => ({
        stats: { ...s.stats, [key]: s.stats[key] + 1 },
      })),
    }),
    { name: 'the-colony-ld' }
  )
)
