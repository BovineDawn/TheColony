import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ActivityEventType =
  | 'mission_complete' | 'mission_start' | 'agent_hired'
  | 'strike_issued' | 'reward_granted' | 'training_start' | 'promotion'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  message: string
  agentName?: string
  timestamp: string
}

interface ActivityStore {
  events: ActivityEvent[]
  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void
  clearEvents: () => void
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      events: [],
      addEvent: (event) => set((s) => ({
        events: [{
          ...event,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        }, ...s.events].slice(0, 100),
      })),
      clearEvents: () => set({ events: [] }),
    }),
    { name: 'the-colony-activity' }
  )
)
