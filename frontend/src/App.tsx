import { useState } from 'react'
import { useColonyStore } from './stores/colonyStore'
import { IntroScreen } from './components/onboarding/IntroScreen'
import { FoundingWizard } from './components/onboarding/FoundingWizard'
import { OnboardingFlow } from './components/onboarding/OnboardingFlow'
import { AppShell } from './components/layout/AppShell'

type AppPhase = 'intro' | 'founding' | 'onboarding' | 'active'

export default function App() {
  const { colony } = useColonyStore()

  const [phase, setPhase] = useState<AppPhase>(() => {
    if (!colony) return 'intro'
    if (colony.phase === 'onboarding') return 'onboarding'
    return 'active'
  })

  return (
    <>
      {phase === 'intro'       && <IntroScreen      onComplete={() => setPhase('founding')}   />}
      {phase === 'founding'    && <FoundingWizard   onComplete={() => setPhase('onboarding')} />}
      {phase === 'onboarding'  && <OnboardingFlow   onComplete={() => setPhase('active')}     />}
      {phase === 'active'      && <AppShell />}
    </>
  )
}
