/**
 * Demo playback — simulates a full mission without a backend.
 * Fires realistic colony events with natural timing so first-time visitors
 * can experience the full flow before adding API keys.
 */

export interface DemoEvent {
  type: string
  [key: string]: any
}

type OnEvent = (event: DemoEvent) => void

// ── Founding team IDs (match OnboardingFlow defaults) ──────────────────────
const EXEC  = { id: 'agent-0002', name: 'ARIA',  role: 'Sr. Executive'      }
const LYRA  = { id: 'agent-0004', name: 'LYRA',  role: 'Head of Research'    }
const FORGE = { id: 'agent-0003', name: 'FORGE', role: 'Head of Engineering' }

// ── Demo mission ────────────────────────────────────────────────────────────
export const DEMO_PROMPT = 'Research our top 3 competitors and summarize their strengths'
export const DEMO_TITLE  = 'Competitive Intelligence Sweep'

const PLAN_TEXT =
`ACKNOWLEDGMENT: Competitive intelligence request confirmed — routing to Research and Engineering.

DEPARTMENTS INVOLVED: Research, Engineering

ACTION PLAN:
- Research: Deep-dive on the top 3 competitors — product positioning, pricing model, and market share signals
- Engineering: Technical stack analysis via public signals and architecture footprints

TIMELINE: Full compiled report delivered within this session`

const REPORT_TEXT =
`EXECUTIVE SUMMARY

Competitive sweep complete across Research and Engineering. Three primary competitors identified and profiled. Findings are consolidated below for Founder review.

───────────────────────────────
KEY FINDINGS
───────────────────────────────

Research Department (LYRA):
Competitor A dominates enterprise with an estimated 40% mid-market share, a deep integration ecosystem, and premium pricing — their moat is distribution, not product. Competitor B is undercutting at 30% below market rate, targeting SMBs with a stripped-down feature set and aggressive outbound. Competitor C leads on user experience — consistently highest satisfaction scores, strong retention, but slower on feature velocity.

Engineering Department (FORGE):
Competitor A runs a heavy AWS microservices stack — high reliability, high operational cost, difficult to iterate quickly. Competitor B's codebase signals a monolith-to-SOA transition: fast shipping cycles, visible technical debt, likely to stumble at scale. Competitor C's frontend is React-heavy with significant performance optimization investment — their UX lead is structural, not cosmetic, which means it compounds.

───────────────────────────────
RECOMMENDATIONS
───────────────────────────────
1. Prioritize UX investment — Competitor C's advantage is architectural and will widen if left unaddressed
2. Evaluate a focused SMB pricing tier to compete with Competitor B without commoditizing the core product
3. Accelerate the integrations roadmap to close Competitor A's enterprise distribution moat

No items require immediate Founder decision. Full analysis available on request.`

// ── Helpers ─────────────────────────────────────────────────────────────────

function words(text: string): string[] {
  // Chunk into 2-4 word groups for natural-feeling stream
  const ws = text.split(/(?<=\s)/)
  const out: string[] = []
  let buf = ''
  ws.forEach((w, i) => {
    buf += w
    const size = 2 + (i % 3)
    if (buf.split(/\s+/).filter(Boolean).length >= size || i === ws.length - 1) {
      if (buf) out.push(buf)
      buf = ''
    }
  })
  if (buf) out.push(buf)
  return out
}

// ── Main export ─────────────────────────────────────────────────────────────

export function playDemo(onEvent: OnEvent): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []
  let cursor = 0

  const fire = (delay: number, event: DemoEvent) => {
    cursor += delay
    timers.push(setTimeout(() => onEvent({ ...event, timestamp: new Date().toISOString() }), cursor))
  }

  const streamText = (text: string, streamId: string, from: typeof EXEC, msgType: string, missionTitle?: string) => {
    fire(300, { type: 'agent_stream_start', stream_id: streamId, from_id: from.id, from_name: from.name, from_role: from.role, to_id: 'founder-0001', msg_type: msgType })
    words(text).forEach(chunk => fire(48, { type: 'agent_stream_chunk', stream_id: streamId, chunk }))
    fire(120, { type: 'agent_stream_end', stream_id: streamId, from_id: from.id, from_name: from.name, from_role: from.role, to_id: 'founder-0001', content: text, msg_type: msgType, mission_title: missionTitle })
  }

  const working = (agent: typeof EXEC) => fire(0, { type: 'status_update', agent_id: agent.id, agent_name: agent.name, status: 'working' })
  const idle    = (agent: typeof EXEC) => fire(0, { type: 'status_update', agent_id: agent.id, agent_name: agent.name, status: 'idle'    })

  // ── Timeline ──────────────────────────────────────────────────────────────

  fire(400, { type: 'status', text: `Mission received. Routing to ${EXEC.name}…` })

  working(EXEC)
  streamText(PLAN_TEXT, 'demo-plan', EXEC, 'update')
  idle(EXEC)

  // Internal delegations (audit only)
  fire(400, { type: 'agent_message', from_id: EXEC.id, from_name: EXEC.name, from_role: EXEC.role, to_id: LYRA.id, content: `[Delegating research sub-task to ${LYRA.name}]`, msg_type: 'internal' })
  fire(80,  { type: 'agent_message', from_id: EXEC.id, from_name: EXEC.name, from_role: EXEC.role, to_id: FORGE.id, content: `[Delegating engineering sub-task to ${FORGE.name}]`, msg_type: 'internal' })

  working(LYRA)
  fire(200, {})  // small gap
  working(FORGE)

  // Departments work silently for a beat
  fire(2600, {})  // passage of time
  idle(LYRA)
  fire(400, {})
  idle(FORGE)

  // Quality scores
  fire(300, { type: 'quality_score', agent_name: LYRA.name,  score: 93 })
  fire(120, { type: 'quality_score', agent_name: FORGE.name, score: 89 })

  // Exec compiles final report
  fire(500, {})
  working(EXEC)
  streamText(REPORT_TEXT, 'demo-report', EXEC, 'formal_report', DEMO_TITLE)
  idle(EXEC)

  fire(300, { type: 'mission_complete', mission_id: 'demo-mission' })

  return () => timers.forEach(clearTimeout)
}
