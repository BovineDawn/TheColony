import { useState, useEffect } from 'react'
import { useColonyStore } from '../../stores/colonyStore'
import { useActivityStore } from '../../stores/activityStore'
import { useMissionHistoryStore } from '../../stores/missionHistoryStore'
import { Settings, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'

const DEPARTMENTS = ['engineering', 'research', 'writing', 'legal', 'ld', 'executive'] as const
type Department = typeof DEPARTMENTS[number]

const DEPT_LABELS: Record<Department, string> = {
  engineering: 'Engineering',
  research:    'Research',
  writing:     'Writing',
  legal:       'Legal',
  ld:          'Learning & Development',
  executive:   'Executive',
}

const MODELS = ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro'] as const
type AIModel = typeof MODELS[number]

const MODEL_LABELS: Record<AIModel, string> = {
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'gpt-4o':            'GPT-4o',
  'gemini-1.5-pro':    'Gemini 1.5 Pro',
}

const PREF_KEY = 'the-colony-model-prefs'

function loadPrefs(): Record<string, AIModel> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
  } catch {
    return {}
  }
}

export function SettingsPanel() {
  const { colony, agents, updateColony, updateAgent, reset } = useColonyStore()
  const { clearEvents } = useActivityStore()
  const { clearHistory } = useMissionHistoryStore()

  const founder = agents.find(a => a.isFounder)

  const [colonyName, setColonyName] = useState(colony?.name || '')
  const [founderName, setFounderName] = useState(founder?.name || '')
  const [modelPrefs, setModelPrefs] = useState<Record<string, AIModel>>(loadPrefs)

  useEffect(() => {
    setColonyName(colony?.name || '')
  }, [colony?.name])

  useEffect(() => {
    setFounderName(founder?.name || '')
  }, [founder?.name])

  const saveColonyName = () => {
    if (colonyName.trim()) updateColony({ name: colonyName.trim() })
  }

  const saveFounderName = () => {
    if (founder && founderName.trim()) {
      updateAgent(founder.id, { name: founderName.trim() })
    }
  }

  const setModelPref = (dept: Department, model: AIModel) => {
    const next = { ...modelPrefs, [dept]: model }
    setModelPrefs(next)
    localStorage.setItem(PREF_KEY, JSON.stringify(next))

    // Update all existing agents in this department
    const deptAgents = agents.filter(a => a.department === dept && !a.isFounder)
    deptAgents.forEach(agent => {
      updateAgent(agent.id, { model })
      api.patch(`/api/agents/${agent.id}`, { model }).catch(() => {/* backend offline */})
    })
  }

  const handleReset = () => {
    if (window.confirm('Reset the entire colony? This cannot be undone.')) {
      // Clear every persisted store so the app boots fresh from the intro screen
      const STORE_KEYS = [
        'the-colony-store',
        'the-colony-hr-store',
        'the-colony-activity',
        'the-colony-ld',
        'the-colony-mission-history',
        'the-colony-training',
        PREF_KEY,
      ]
      STORE_KEYS.forEach(k => localStorage.removeItem(k))

      // Also reset backend DB if reachable
      api.post('/api/agents/reset').catch(() => {/* backend offline */})

      window.location.reload()
    }
  }

  const sectionHeader = (label: string) => (
    <div className="flex items-center gap-3 mb-4">
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
        letterSpacing: '0.2em',
        color: 'var(--color-amber)',
        fontWeight: 700,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: 'hsl(42 65% 52% / 0.2)' }} />
    </div>
  )

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    outline: 'none',
  }

  const labelStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: 6,
  }

  const saveBtn = (onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px',
        backgroundColor: 'hsl(42 65% 52% / 0.1)',
        border: '1px solid hsl(42 65% 52% / 0.3)',
        borderRadius: 4,
        color: 'var(--color-amber)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        cursor: 'pointer',
        letterSpacing: '0.05em',
        marginTop: 8,
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.2)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'hsl(42 65% 52% / 0.1)'}
    >
      {label}
    </button>
  )

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 40px' }}>

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Settings size={14} style={{ color: 'var(--color-amber)' }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--color-text-muted)',
            }}>
              CONFIGURATION
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.05em',
          }}>
            Colony Settings
          </h1>
        </div>

        {/* SECTION 1: COLONY IDENTITY */}
        <div className="mb-8" style={{
          padding: '20px 24px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
        }}>
          {sectionHeader('COLONY IDENTITY')}

          <div className="flex flex-col gap-4">
            <div>
              <label style={labelStyle}>Colony Name</label>
              <input
                value={colonyName}
                onChange={e => setColonyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveColonyName()}
                style={inputStyle}
                placeholder="e.g. NEXUS PRIME"
                onFocus={e => e.currentTarget.style.borderColor = 'var(--color-amber)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
              {saveBtn(saveColonyName, 'SAVE NAME')}
            </div>

            <div style={{ height: 1, backgroundColor: 'var(--color-border)' }} />

            <div>
              <label style={labelStyle}>Founder Name</label>
              <input
                value={founderName}
                onChange={e => setFounderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveFounderName()}
                style={inputStyle}
                placeholder="Your name"
                onFocus={e => e.currentTarget.style.borderColor = 'var(--color-amber)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
              {saveBtn(saveFounderName, 'SAVE NAME')}
            </div>
          </div>
        </div>

        {/* SECTION 2: AI CONFIGURATION */}
        <div className="mb-8" style={{
          padding: '20px 24px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
        }}>
          {sectionHeader('AI CONFIGURATION')}

          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            marginBottom: 16,
            letterSpacing: '0.03em',
          }}>
            Updates all existing agents in each department and sets the default for new hires.
          </p>

          <div className="flex flex-col gap-3">
            {DEPARTMENTS.map(dept => (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  width: 180,
                  flexShrink: 0,
                }}>
                  {DEPT_LABELS[dept]}
                </span>
                <select
                  value={modelPrefs[dept] || 'gpt-4o'}
                  onChange={e => setModelPref(dept, e.target.value as AIModel)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {MODELS.map(m => (
                    <option key={m} value={m}>{MODEL_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: DANGER ZONE */}
        <div style={{
          padding: '20px 24px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid hsl(0 72% 51% / 0.3)',
          borderRadius: 10,
        }}>
          {sectionHeader('DANGER ZONE')}

          <div className="flex flex-col gap-3">
            {[
              {
                label: 'Clear Activity Log',
                desc: 'Remove all activity events from the feed.',
                action: () => clearEvents(),
                danger: false,
              },
              {
                label: 'Clear Mission History',
                desc: 'Remove all saved mission transcripts.',
                action: () => clearHistory(),
                danger: false,
              },
              {
                label: 'Reset Colony',
                desc: 'Delete all agents, missions, and colony data. This cannot be undone.',
                action: handleReset,
                danger: true,
              },
            ].map(({ label, desc, action, danger }) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface-raised)',
                border: `1px solid ${danger ? 'hsl(0 72% 51% / 0.25)' : 'var(--color-border)'}`,
                borderRadius: 6,
                gap: 12,
              }}>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: danger ? 'var(--color-danger)' : 'var(--color-text-primary)',
                    marginBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    {danger && <AlertTriangle size={12} />}
                    {label}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                  }}>
                    {desc}
                  </p>
                </div>
                <button
                  onClick={action}
                  style={{
                    padding: '6px 14px',
                    flexShrink: 0,
                    backgroundColor: danger ? 'hsl(0 72% 51% / 0.1)' : 'var(--color-surface)',
                    border: `1px solid ${danger ? 'hsl(0 72% 51% / 0.4)' : 'var(--color-border)'}`,
                    borderRadius: 4,
                    color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = danger ? 'hsl(0 72% 51% / 0.2)' : 'hsl(215 14% 14%)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = danger ? 'hsl(0 72% 51% / 0.1)' : 'var(--color-surface)'}
                >
                  {label.toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
