import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

export interface DeptSelection {
  department: string   // slugified key, e.g. 'engineering' or 'marketing'
  label: string        // ALL-CAPS display name
  role: string         // e.g. 'Head of Engineering'
  color: string        // CSS color
  isCustom: boolean
  description?: string // job duties / skills context for AI generation
}

// ── Preset departments ────────────────────────────────────────────────────────

const PRESET_DEPTS: DeptSelection[] = [
  {
    department: 'engineering',
    label: 'ENGINEERING',
    role: 'Head of Engineering',
    color: 'hsl(199 89% 48%)',
    isCustom: false,
  },
  {
    department: 'research',
    label: 'RESEARCH',
    role: 'Head of Research',
    color: 'hsl(262 52% 47%)',
    isCustom: false,
  },
  {
    department: 'writing',
    label: 'WRITING',
    role: 'Head of Writing',
    color: 'hsl(145 63% 42%)',
    isCustom: false,
  },
  {
    department: 'legal',
    label: 'LEGAL',
    role: 'Head of Legal',
    color: 'hsl(24 100% 50%)',
    isCustom: false,
  },
  {
    department: 'ld',
    label: 'L&D',
    role: 'Head of Learning & Development',
    color: 'hsl(330 65% 52%)',
    isCustom: false,
  },
]

const CUSTOM_COLORS = [
  'hsl(0 72% 55%)',
  'hsl(48 96% 50%)',
  'hsl(180 100% 38%)',
  'hsl(300 70% 52%)',
  'hsl(220 90% 60%)',
  'hsl(90 65% 45%)',
  'hsl(15 90% 55%)',
  'hsl(160 70% 45%)',
]

// ── Component ─────────────────────────────────────────────────────────────────

interface DepartmentSelectorProps {
  onComplete: (selectedDepts: DeptSelection[]) => void
}

export function DepartmentSelector({ onComplete }: DepartmentSelectorProps) {
  // Which preset dept keys are active
  const [activePresets, setActivePresets] = useState<Set<string>>(
    new Set(PRESET_DEPTS.map(d => d.department))
  )
  // Custom departments added by the user
  const [customDepts, setCustomDepts] = useState<DeptSelection[]>([])
  // Inline form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newRoleTitle, setNewRoleTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const togglePreset = (dept: string) => {
    setActivePresets(prev => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  const addCustomDept = () => {
    const name = newDeptName.trim()
    if (!name) return

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const role = newRoleTitle.trim() || `Head of ${name}`
    const colorIndex = customDepts.length % CUSTOM_COLORS.length

    const newDept: DeptSelection = {
      department: slug,
      label: name.toUpperCase(),
      role,
      color: CUSTOM_COLORS[colorIndex],
      isCustom: true,
      description: newDescription.trim() || undefined,
    }

    setCustomDepts(prev => [...prev, newDept])
    setNewDeptName('')
    setNewRoleTitle('')
    setNewDescription('')
    setShowAddForm(false)
  }

  const removeCustom = (dept: string) => {
    setCustomDepts(prev => prev.filter(d => d.department !== dept))
  }

  const handleContinue = () => {
    const selectedPresets = PRESET_DEPTS.filter(d => activePresets.has(d.department))
    onComplete([
      { department: 'executive', label: 'EXECUTIVE', role: 'Sr. Executive', color: 'hsl(42 65% 52%)', isCustom: false },
      ...selectedPresets,
      ...customDepts,
    ])
  }

  const totalCount = 1 + activePresets.size + customDepts.length
  const amber = 'var(--color-amber)'
  const amberBorder = 'hsl(42 65% 52% / 0.25)'

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)', overflow: 'hidden' }}>

      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
        zIndex: 50,
      }} />
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(hsl(42 65% 52% / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(42 65% 52% / 0.04) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full"
        style={{ maxWidth: 560, padding: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 14, height: 14,
              border: `2px solid ${amber}`,
              transform: 'rotate(45deg)',
              boxShadow: '0 0 10px hsl(42 65% 52% / 0.5)',
            }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              letterSpacing: '0.35em',
              color: amber,
              fontWeight: 700,
            }}>
              DEPARTMENT AUTHORIZATION
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            color: 'var(--color-text-primary)',
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}>
            Build Your Command Structure
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'hsl(42 65% 52% / 0.45)',
            marginTop: 8,
            letterSpacing: '0.1em',
          }}>
            Select presets or define your own departments. Each will field one founding head.
          </p>
        </div>

        {/* Executive — always required */}
        <div style={{
          padding: '12px 16px',
          marginBottom: 6,
          border: `1px solid hsl(42 65% 52% / 0.35)`,
          backgroundColor: 'hsl(42 65% 52% / 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, backgroundColor: amber, boxShadow: `0 0 8px ${amber}`, flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.15em', color: amber }}>
                  EXECUTIVE
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  color: 'hsl(42 65% 52% / 0.5)', letterSpacing: '0.1em',
                  padding: '1px 5px', border: `1px solid hsl(42 65% 52% / 0.2)`,
                }}>REQUIRED</span>
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'hsl(215 14% 45%)', marginTop: 2 }}>
                Sr. Executive · Mission routing, delegation, final reports
              </p>
            </div>
          </div>
          <CheckMark color={amber} />
        </div>

        {/* Preset departments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
          {PRESET_DEPTS.map((dept, i) => {
            const on = activePresets.has(dept.department)
            return (
              <motion.button
                key={dept.department}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => togglePreset(dept.department)}
                style={{
                  padding: '11px 16px',
                  border: `1px solid ${on ? `${dept.color}55` : 'hsl(42 65% 52% / 0.1)'}`,
                  backgroundColor: on ? `${dept.color}0D` : 'var(--color-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 8, height: 8, flexShrink: 0,
                    backgroundColor: on ? dept.color : 'hsl(42 65% 52% / 0.12)',
                    boxShadow: on ? `0 0 8px ${dept.color}` : 'none',
                    transition: 'all 0.15s',
                  }} />
                  <div>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
                      letterSpacing: '0.15em',
                      color: on ? dept.color : 'hsl(215 14% 40%)',
                      transition: 'color 0.15s',
                    }}>
                      {dept.label}
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      color: on ? 'hsl(215 14% 52%)' : 'hsl(215 14% 30%)',
                      marginTop: 2, transition: 'color 0.15s',
                    }}>
                      {dept.role}
                    </p>
                  </div>
                </div>
                <CheckMark color={dept.color} checked={on} />
              </motion.button>
            )
          })}
        </div>

        {/* Custom departments */}
        <AnimatePresence>
          {customDepts.map((dept) => (
            <motion.div
              key={dept.department}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 5, overflow: 'hidden' }}
            >
              <div style={{
                padding: '11px 16px',
                border: `1px solid ${dept.color}55`,
                backgroundColor: `${dept.color}0D`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, backgroundColor: dept.color, boxShadow: `0 0 8px ${dept.color}`, flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.15em', color: dept.color }}>
                        {dept.label}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                        color: `${dept.color}88`, letterSpacing: '0.1em',
                        padding: '1px 5px', border: `1px solid ${dept.color}33`,
                      }}>CUSTOM</span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'hsl(215 14% 50%)', marginTop: 2 }}>
                      {dept.role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeCustom(dept.department)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: '16px',
                    color: 'hsl(215 14% 35%)', lineHeight: 1, padding: '2px 6px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'hsl(0 72% 55%)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'hsl(215 14% 35%)'}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add custom department */}
        <div style={{ marginBottom: 20 }}>
          <AnimatePresence mode="wait">
            {!showAddForm ? (
              <motion.button
                key="add-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddForm(true)}
                style={{
                  width: '100%', padding: '10px 16px',
                  border: `1px dashed hsl(42 65% 52% / 0.2)`,
                  backgroundColor: 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(42 65% 52% / 0.4)'
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'hsl(42 65% 52% / 0.04)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(42 65% 52% / 0.2)'
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'hsl(42 65% 52% / 0.4)', lineHeight: 1 }}>+</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.2em', color: 'hsl(42 65% 52% / 0.4)' }}>
                  ADD CUSTOM DEPARTMENT
                </span>
              </motion.button>
            ) : (
              <motion.div
                key="add-form"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  padding: '14px 16px',
                  border: `1px solid hsl(42 65% 52% / 0.25)`,
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.25em', color: 'hsl(42 65% 52% / 0.5)' }}>
                  NEW DEPARTMENT
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomDept(); if (e.key === 'Escape') setShowAddForm(false) }}
                    placeholder="Department name (e.g. Marketing)"
                    style={{
                      flex: 1, padding: '8px 12px',
                      backgroundColor: 'var(--color-surface-raised)',
                      border: `1px solid hsl(42 65% 52% / 0.2)`,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                      outline: 'none',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.5)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.2)'}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newRoleTitle}
                    onChange={e => setNewRoleTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setShowAddForm(false) }}
                    placeholder={`Role title (default: Head of ${newDeptName || '…'})`}
                    style={{
                      flex: 1, padding: '8px 12px',
                      backgroundColor: 'var(--color-surface-raised)',
                      border: `1px solid hsl(42 65% 52% / 0.2)`,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                      outline: 'none',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.5)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.2)'}
                  />
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                    letterSpacing: '0.2em', color: 'hsl(42 65% 52% / 0.4)',
                    marginBottom: 4,
                  }}>
                    JOB DUTIES &amp; SKILLS NEEDED — AI will generate tailored skills from this
                  </div>
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setShowAddForm(false) }}
                    placeholder={`e.g. Responsible for brand strategy, social media campaigns, customer acquisition, SEO, and paid advertising. Should have strong copywriting, analytics, and growth hacking skills.`}
                    rows={3}
                    style={{
                      width: '100%', padding: '8px 12px',
                      backgroundColor: 'var(--color-surface-raised)',
                      border: `1px solid hsl(42 65% 52% / 0.2)`,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                      outline: 'none', resize: 'vertical',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.5)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.2)'}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setShowAddForm(false); setNewDeptName(''); setNewRoleTitle(''); setNewDescription('') }}
                    style={{
                      padding: '7px 14px', background: 'none',
                      border: `1px solid hsl(42 65% 52% / 0.15)`,
                      color: 'hsl(42 65% 52% / 0.4)', fontFamily: 'var(--font-mono)',
                      fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer',
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={addCustomDept}
                    disabled={!newDeptName.trim()}
                    style={{
                      padding: '7px 20px',
                      backgroundColor: newDeptName.trim() ? 'hsl(42 65% 52% / 0.15)' : 'transparent',
                      border: `1px solid hsl(42 65% 52% / ${newDeptName.trim() ? '0.4' : '0.15'})`,
                      color: newDeptName.trim() ? 'var(--color-amber)' : 'hsl(42 65% 52% / 0.3)',
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      letterSpacing: '0.15em', cursor: newDeptName.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ADD
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status + Continue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'hsl(42 65% 52% / 0.4)', letterSpacing: '0.1em', flex: 1,
          }}>
            {totalCount} DEPT{totalCount !== 1 ? 'S' : ''} · {totalCount} FOUNDING HEAD{totalCount !== 1 ? 'S' : ''}
          </span>
          <button
            onClick={handleContinue}
            style={{
              padding: '12px 32px',
              backgroundColor: amber,
              border: 'none',
              color: 'var(--color-background)',
              fontFamily: 'var(--font-display)', fontSize: '13px',
              fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 0 25px hsl(42 65% 52% / 0.4)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'hsl(42 65% 60%)'
              e.currentTarget.style.boxShadow = '0 0 40px hsl(42 65% 52% / 0.6)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = amber
              e.currentTarget.style.boxShadow = '0 0 25px hsl(42 65% 52% / 0.4)'
            }}
          >
            Begin Founding Review
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Small reusable checkbox ───────────────────────────────────────────────────

function CheckMark({ color, checked = true }: { color: string; checked?: boolean }) {
  return (
    <div style={{
      width: 20, height: 20, flexShrink: 0,
      border: `2px solid ${checked ? color : 'hsl(42 65% 52% / 0.2)'}`,
      backgroundColor: checked ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>
      {checked && <span style={{ color: 'var(--color-background)', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  )
}
