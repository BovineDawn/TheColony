export type ColonyPhase = 'onboarding' | 'active'

export interface Colony {
  id: string
  name: string
  foundedAt: string
  phase: ColonyPhase
  nextEmployeeId: number
}
