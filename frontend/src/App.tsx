import { useState } from 'react'
import { useColonyStore } from './stores/colonyStore'
import { IntroScreen } from './components/onboarding/IntroScreen'
import { FoundingWizard } from './components/onboarding/FoundingWizard'
import { DepartmentSelector } from './components/onboarding/DepartmentSelector'
import { OnboardingFlow } from './components/onboarding/OnboardingFlow'
import { AppShell } from './components/layout/AppShell'
import type { DeptSelection } from './components/onboarding/DepartmentSelector'

type AppPhase = 'intro' | 'founding' | 'dept-select' | 'onboarding' | 'active'

export default function App() {
  const { colony } = useColonyStore()

  const [phase, setPhase] = useState<AppPhase>(() => {
    if (!colony) return 'intro'
    if (colony.phase === 'onboarding') return 'onboarding'
    return 'active'
  })

  const [selectedDepts, setSelectedDepts] = useState<DeptSelection[]>([])

  const handleDeptsChosen = (depts: DeptSelection[]) => {
    setSelectedDepts(depts)
    setPhase('onboarding')
  }

  return (
    <>
      {phase === 'intro'        && <IntroScreen        onComplete={() => setPhase('founding')}        />}
      {phase === 'founding'     && <FoundingWizard     onComplete={() => setPhase('dept-select')}     />}
      {phase === 'dept-select'  && <DepartmentSelector onComplete={handleDeptsChosen}                 />}
      {phase === 'onboarding'   && <OnboardingFlow     selectedDepartments={selectedDepts} onComplete={() => setPhase('active')} />}
      {phase === 'active'       && <AppShell />}
    </>
  )
}
