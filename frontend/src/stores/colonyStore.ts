import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Colony } from '../types/colony'
import type { Agent } from '../types/agent'
import type { Mission } from '../types/mission'

interface ColonyStore {
  colony: Colony | null
  agents: Agent[]
  missions: Mission[]
  setColony: (colony: Colony) => void
  updateColony: (updates: Partial<Colony>) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  removeAgent: (id: string) => void
  addMission: (mission: Mission) => void
  updateMission: (id: string, updates: Partial<Mission>) => void
  reset: () => void
}

export const useColonyStore = create<ColonyStore>()(
  persist(
    (set) => ({
      colony: null,
      agents: [],
      missions: [],

      setColony: (colony) => set({ colony }),

      updateColony: (updates) =>
        set((s) => ({ colony: s.colony ? { ...s.colony, ...updates } : null })),

      addAgent: (agent) =>
        set((s) => ({ agents: [...s.agents, agent] })),

      updateAgent: (id, updates) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      removeAgent: (id) =>
        set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),

      addMission: (mission) =>
        set((s) => ({ missions: [...s.missions, mission] })),

      updateMission: (id, updates) =>
        set((s) => ({
          missions: s.missions.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      reset: () => set({ colony: null, agents: [], missions: [] }),
    }),
    { name: 'the-colony-store' }
  )
)
