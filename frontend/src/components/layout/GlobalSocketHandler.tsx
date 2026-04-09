import { useEffect, useRef } from 'react'
import { connectSocket } from '../../lib/api'
import { useColonyStore } from '../../stores/colonyStore'
import { useLDStore } from '../../stores/ldStore'
import { useActivityStore } from '../../stores/activityStore'

export function GlobalSocketHandler() {
  const updateAgent = useColonyStore((s) => s.updateAgent)
  const ldStore = useLDStore()
  const addEvent = useActivityStore((s) => s.addEvent)
  // Guard: suppress 'working' status updates for a few seconds after cancellation
  const cancelledAt = useRef<number>(0)

  useEffect(() => {
    const socket = connectSocket()

    const handler = (event: Record<string, any>) => {
      const now = new Date().toISOString()

      switch (event.type) {
        case 'status':
          // A new mission routing message means a mission is starting — clear cancel guard
          cancelledAt.current = 0
          break

        case 'ld_cycle_start':
          ldStore.setRunning(true)
          ldStore.resetStats()
          ldStore.addLog({
            type: 'start',
            message: event.text || 'L&D cycle started',
            timestamp: event.timestamp || now,
          })
          if (event.agent_id) {
            updateAgent(event.agent_id, { status: 'working' })
          }
          break

        case 'ld_reviewing':
          ldStore.setCurrentAgent(event.agent_name || null)
          ldStore.addLog({
            type: 'reviewing',
            message: event.text || `Reviewing ${event.agent_name || 'agent'}`,
            agentName: event.agent_name,
            timestamp: event.timestamp || now,
          })
          break

        case 'ld_agent_reviewed':
          ldStore.incrementStat('reviewed')
          if (event.training_needed) {
            ldStore.incrementStat('trainingPlans')
          }
          ldStore.setCurrentAgent(null)
          ldStore.addLog({
            type: 'reviewed',
            message: event.text || '',
            agentName: event.agent_name,
            timestamp: event.timestamp || now,
          })
          break

        case 'ld_skill_update':
          ldStore.incrementStat('skillUpdates')
          ldStore.addLog({
            type: 'skill_update',
            message: event.text || `Skills updated`,
            agentName: event.agent_name,
            timestamp: event.timestamp || now,
          })
          if (event.agent_id && event.new_skills) {
            updateAgent(event.agent_id, { skills: event.new_skills })
          }
          break

        case 'ld_cycle_complete':
          ldStore.setRunning(false)
          ldStore.setLastRun(event.timestamp || now, event.text || '')
          ldStore.setCurrentAgent(null)
          ldStore.addLog({
            type: 'complete',
            message: event.text || 'L&D cycle complete',
            timestamp: event.timestamp || now,
          })
          addEvent({
            type: 'training_start',
            message: `L&D cycle complete: ${event.colonists_reviewed ?? 0} reviewed, ${event.skill_updates ?? 0} skills updated`,
          })
          break

        case 'ld_status_update':
          if (event.agent_id) {
            updateAgent(event.agent_id, { status: event.status })
          }
          break

        case 'status_update': {
          if (event.agent_id) {
            // Suppress 'working' events that arrive after a cancellation (stale network buffer)
            const isStaleWorking = event.status === 'working' && (Date.now() - cancelledAt.current < 5000)
            if (!isStaleWorking) {
              updateAgent(event.agent_id, { status: event.status })
            }
          }
          break
        }

        // ── New-hire onboarding events ─────────────────────────────────────
        case 'ld_onboarding_start':
          ldStore.addLog({
            type: 'reviewing',
            message: event.text || `Onboarding ${event.agent_name}`,
            agentName: event.agent_name,
            timestamp: event.timestamp || now,
          })
          // Set L&D head to working
          if (event.agent_id) {
            // The ld_status_update event follows immediately from the service
          }
          break

        case 'ld_onboarding_complete':
          ldStore.addLog({
            type: 'complete',
            message: event.text || `${event.agent_name} onboarding complete`,
            agentName: event.agent_name,
            timestamp: event.timestamp || now,
          })
          // Apply the upgraded skill set to Zustand
          if (event.agent_id && event.new_skills) {
            updateAgent(event.agent_id, { skills: event.new_skills })
          }
          addEvent({
            type: 'training_start',
            message: `${event.agent_name} completed onboarding training`,
            agentName: event.agent_name,
          })
          break

        case 'mission_cancelled': {
          cancelledAt.current = Date.now()
          const liveAgents = useColonyStore.getState().agents
          liveAgents
            .filter(a => ['working', 'thinking', 'chatting'].includes(a.status))
            .forEach(a => updateAgent(a.id, { status: 'idle' }))
          break
        }

        default:
          break
      }
    }

    socket.on('colony_event', handler)
    return () => {
      socket.off('colony_event', handler)
    }
  }, [updateAgent, ldStore, addEvent])

  return null
}
