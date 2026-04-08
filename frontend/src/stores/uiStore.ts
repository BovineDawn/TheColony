import { create } from 'zustand'

export type ActivePanel = 'none' | 'agent-profile' | 'org-chart' | 'audit-log' | 'hiring'
export type ActiveView = 'dashboard' | 'colony-map' | 'mission-control' | 'org-chart' | 'hiring' | 'inbox' | 'settings'

interface UIStore {
  activeView: ActiveView
  activePanel: ActivePanel
  selectedAgentId: string | null
  sidebarCollapsed: boolean
  setActiveView: (view: ActiveView) => void
  setActivePanel: (panel: ActivePanel) => void
  setSelectedAgent: (id: string | null) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIStore>()((set) => ({
  activeView: 'dashboard',
  activePanel: 'none',
  selectedAgentId: null,
  sidebarCollapsed: false,

  setActiveView: (activeView) => set({ activeView }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setSelectedAgent: (selectedAgentId) => set({ selectedAgentId }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
