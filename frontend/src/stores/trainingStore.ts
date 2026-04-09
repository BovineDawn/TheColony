import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TrainingSession {
  id: string
  agentId: string
  agentName: string
  timestamp: string
  founderMessage: string
  novaResponse: string
}

interface TrainingStore {
  sessions: TrainingSession[]
  addSession: (session: Omit<TrainingSession, 'id'>) => void
  getSessionsForAgent: (agentId: string) => TrainingSession[]
  clearAgentHistory: (agentId: string) => void
}

export const useTrainingStore = create<TrainingStore>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (session) =>
        set((s) => ({
          sessions: [
            { ...session, id: `${session.agentId}-${Date.now()}` },
            ...s.sessions,
          ].slice(0, 200), // cap at 200 total across all agents
        })),

      getSessionsForAgent: (agentId) =>
        get().sessions.filter((s) => s.agentId === agentId),

      clearAgentHistory: (agentId) =>
        set((s) => ({ sessions: s.sessions.filter((x) => x.agentId !== agentId) })),
    }),
    { name: 'the-colony-training' }
  )
)
