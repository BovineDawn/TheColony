import { useEffect, useRef, useState, useCallback } from 'react'
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js'
import { Camera } from 'lucide-react'
import { useColonyStore } from '../../stores/colonyStore'
import { useUIStore } from '../../stores/uiStore'
import { departmentColors } from '../../lib/departments'
import { LDActivityOverlay } from '../ld/LDActivityOverlay'
import type { Agent, Department } from '../../types/agent'

const TILE = 130
const COLS = 14
const ROWS = 11

// Amber hex — matches the ID card reference
const AMBER = 0xB8922A

const ZONES: Array<{ dept: Department; label: string; x: number; y: number; w: number; h: number }> = [
  { dept: 'executive',   label: 'EXECUTIVE',   x: 4,  y: 0, w: 6,  h: 2 },
  { dept: 'engineering', label: 'ENGINEERING', x: 0,  y: 3, w: 4,  h: 4 },
  { dept: 'research',    label: 'RESEARCH',    x: 5,  y: 3, w: 4,  h: 4 },
  { dept: 'writing',     label: 'WRITING',     x: 10, y: 3, w: 4,  h: 4 },
  { dept: 'legal',       label: 'LEGAL',       x: 0,  y: 8, w: 4,  h: 3 },
  { dept: 'ld',          label: 'L&D',         x: 10, y: 8, w: 4,  h: 3 },
]

const STATUS_COLORS: Record<string, number> = {
  idle:       0x374151,
  thinking:   0xF59E0B,
  working:    0x10B981,
  chatting:   0x00D4FF,
  training:   0xEC4899,
  terminated: 0xEF4444,
}

export function ColonyMap() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const appRef        = useRef<Application | null>(null)
  const agentLayerRef = useRef<Container | null>(null)
  const [appReady, setAppReady] = useState(false)

  const { agents } = useColonyStore()
  const { setSelectedAgent, setActivePanel } = useUIStore()

  const handleExport = useCallback(() => {
    const app = appRef.current
    if (!app) return
    const url = (app.canvas as HTMLCanvasElement).toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `the-colony-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  // ── Initialize Pixi once ──
  useEffect(() => {
    if (!containerRef.current || appRef.current) return

    const app = new Application()
    let mounted = true

    app.init({
      width:                COLS * TILE,
      height:               ROWS * TILE,
      background:           0x090D16,
      antialias:            true,
      resolution:           window.devicePixelRatio || 1,
      autoDensity:          true,
      preserveDrawingBuffer: true,  // enables canvas.toDataURL() for PNG export
    }).then(() => {
      if (!mounted || !containerRef.current) return

      containerRef.current.appendChild(app.canvas)
      appRef.current = app

      // ── Dot grid ──
      const grid = new Graphics()
      for (let x = 0; x <= COLS; x++) {
        grid.moveTo(x * TILE, 0).lineTo(x * TILE, ROWS * TILE)
        grid.stroke({ width: 1, color: 0x151D2E, alpha: 0.8 })
      }
      for (let y = 0; y <= ROWS; y++) {
        grid.moveTo(0, y * TILE).lineTo(COLS * TILE, y * TILE)
        grid.stroke({ width: 1, color: 0x151D2E, alpha: 0.8 })
      }
      app.stage.addChild(grid)

      // ── Department zones ──
      ZONES.forEach(({ dept, label, x, y, w, h }) => {
        const hexColor = parseInt(departmentColors[dept].replace('#', ''), 16)

        // Zone fill
        const zone = new Graphics()
        zone.roundRect(x * TILE + 5, y * TILE + 5, w * TILE - 10, h * TILE - 10, 8)
        zone.fill({ color: hexColor, alpha: 0.03 })
        zone.stroke({ color: hexColor, alpha: 0.22, width: 1 })
        app.stage.addChild(zone)

        // Corner accent marks
        const corners = new Graphics()
        const cx = x * TILE + 5
        const cy = y * TILE + 5
        const cw = w * TILE - 10
        const ch = h * TILE - 10
        const CS = 14 // corner size
        corners.moveTo(cx, cy + CS).lineTo(cx, cy).lineTo(cx + CS, cy)
        corners.moveTo(cx + cw - CS, cy).lineTo(cx + cw, cy).lineTo(cx + cw, cy + CS)
        corners.moveTo(cx, cy + ch - CS).lineTo(cx, cy + ch).lineTo(cx + CS, cy + ch)
        corners.moveTo(cx + cw - CS, cy + ch).lineTo(cx + cw, cy + ch).lineTo(cx + cw, cy + ch - CS)
        corners.stroke({ color: hexColor, alpha: 0.55, width: 1.5 })
        app.stage.addChild(corners)

        // Zone label
        const lbl = new Text({
          text: label,
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fill: hexColor,
            letterSpacing: 4,
          }),
        })
        lbl.alpha = 0.4
        lbl.x = x * TILE + 14
        lbl.y = y * TILE + 13
        app.stage.addChild(lbl)
      })

      // ── Agent layer ──
      const agentLayer = new Container()
      app.stage.addChild(agentLayer)
      agentLayerRef.current = agentLayer

      setAppReady(true)
    })

    return () => {
      mounted = false
      app.destroy()
      appRef.current = null
      agentLayerRef.current = null
      setAppReady(false)
    }
  }, [])

  // ── Re-render agents on change ──
  useEffect(() => {
    const layer = agentLayerRef.current
    const app   = appRef.current
    if (!layer || !appReady || !app) return

    layer.removeChildren()
    agents.forEach(agent => {
      const tile = buildAgentTile(agent, () => {
        setSelectedAgent(agent.id)
        setActivePanel('agent-profile')
      })
      layer.addChild(tile)
    })
  }, [agents, appReady, setSelectedAgent, setActivePanel])

  // ── Ticker: animate status dots + border glow ──
  useEffect(() => {
    const app = appRef.current
    if (!app || !appReady) return

    const tick = (ticker: { lastTime: number }) => {
      const layer = agentLayerRef.current
      if (!layer) return
      const t = ticker.lastTime / 1000

      layer.children.forEach((child: any) => {
        const ud     = child.userData as Record<string, any> | undefined
        if (!ud) return
        const { dot, border, status, isFounder, moodGlow } = ud

        // Animate mood glow ring independently of status
        if (moodGlow) {
          moodGlow.alpha = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.2))
        }

        if (status === 'working') {
          const p = 0.5 + 0.5 * Math.sin(t * 3.5)
          if (dot)    dot.alpha    = 0.65 + 0.35 * p
          if (border) border.alpha = 0.55 + 0.45 * p
        } else if (status === 'thinking') {
          const p = 0.5 + 0.5 * Math.sin(t * 2.2)
          if (dot)    dot.alpha    = 0.55 + 0.35 * p
          if (border) border.alpha = 0.4  + 0.35 * p
        } else if (status === 'training') {
          const p = 0.5 + 0.5 * Math.sin(t * 1.8)
          if (dot)    dot.alpha    = 0.55 + 0.4  * p
        } else if (status === 'chatting') {
          const p = 0.5 + 0.5 * Math.sin(t * 4.0)
          if (dot)    dot.alpha    = 0.6  + 0.4  * p
        } else {
          // idle — slow breathe
          const p = 0.5 + 0.5 * Math.sin(t * 0.9)
          if (dot)    dot.alpha    = 0.45 + 0.25 * p
          if (border) border.alpha = isFounder ? 0.7 + 0.2 * p : 0.35 + 0.2 * p
        }
      })
    }

    app.ticker.add(tick)
    return () => { app.ticker.remove(tick) }
  }, [appReady])

  return (
    <div className="w-full h-full overflow-auto" style={{ backgroundColor: '#090D16', position: 'relative' }}>
      <div ref={containerRef} style={{ display: 'inline-block', minWidth: 'max-content' }} />
      {!appReady && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#5A6A7A', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
          letterSpacing: '0.15em',
        }}>
          INITIALIZING COLONY MAP...
        </div>
      )}
      {appReady && (
        <button
          onClick={handleExport}
          title="Export colony map as PNG"
          style={{
            position: 'absolute', top: 12, right: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px',
            backgroundColor: 'hsl(215 22% 6% / 0.85)',
            border: '1px solid hsl(215 22% 20%)',
            borderRadius: 6,
            color: '#5A6A7A',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#B8922A'
            e.currentTarget.style.borderColor = 'hsl(42 65% 52% / 0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#5A6A7A'
            e.currentTarget.style.borderColor = 'hsl(215 22% 20%)'
          }}
        >
          <Camera size={12} />
          EXPORT
        </button>
      )}
      <LDActivityOverlay />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Mood glow — driven by quality score + strike count
// ══════════════════════════════════════════════════════════
function getMoodGlow(agent: Agent): { color: number; alpha: number } | null {
  const strikes = agent.strikes?.length ?? 0
  const quality = agent.qualityScore ?? 100

  if (strikes >= 3)   return { color: 0xEF4444, alpha: 0.55 }  // danger — escalation threshold
  if (strikes >= 1)   return { color: 0xF59E0B, alpha: 0.45 }  // warning — on record
  if (quality < 60)   return { color: 0xF97316, alpha: 0.40 }  // poor quality
  if (quality >= 90)  return { color: 0x10B981, alpha: 0.22 }  // high performer
  return null
}

// ══════════════════════════════════════════════════════════
//  buildAgentTile — Rimworld ID card style
// ══════════════════════════════════════════════════════════
function buildAgentTile(agent: Agent, onClick: () => void): Container {
  const c = new Container()
  c.x = agent.tilePosition.x * TILE
  c.y = agent.tilePosition.y * TILE
  c.interactive = true
  c.cursor = 'pointer'

  const deptHex   = parseInt(departmentColors[agent.department].replace('#', ''), 16)
  const isFounder = agent.isFounder
  const borderCol = isFounder ? AMBER : deptHex
  const borderAlpha = isFounder ? 1.0 : 0.6
  const bgCol     = 0x0E1220  // dark charcoal card

  // ── Background ──
  const bg = new Graphics()
  bg.roundRect(10, 10, TILE - 20, TILE - 20, 4)
  bg.fill({ color: bgCol })
  c.addChild(bg)

  // ── Outer border ──
  const border = new Graphics()
  border.roundRect(10, 10, TILE - 20, TILE - 20, 4)
  border.stroke({ color: borderCol, alpha: borderAlpha, width: isFounder ? 1.5 : 1 })
  c.addChild(border)

  // ── Mood glow ring ──
  const mood = getMoodGlow(agent)
  let moodGlow: Graphics | null = null
  if (mood) {
    moodGlow = new Graphics()
    moodGlow.roundRect(7, 7, TILE - 14, TILE - 14, 6)
    moodGlow.stroke({ color: mood.color, alpha: mood.alpha, width: 1.5 })
    moodGlow.alpha = mood.alpha
    c.addChild(moodGlow)
  }

  // Tag userData for the ticker to animate
  ;(c as any).userData = { status: agent.status, isFounder, dot: null as any, border, moodGlow }

  // ── Top dept color stripe ──
  const stripe = new Graphics()
  stripe.rect(10, 10, TILE - 20, 3)
  stripe.fill({ color: deptHex, alpha: 0.85 })
  c.addChild(stripe)

  // ── Inner subtle frame line (double-border effect) ──
  const innerBorder = new Graphics()
  innerBorder.roundRect(13, 15, TILE - 26, TILE - 28, 2)
  innerBorder.stroke({ color: borderCol, alpha: 0.12, width: 0.5 })
  c.addChild(innerBorder)

  // ── Employee ID ──
  const empId = new Text({
    text: `#${String(agent.employeeId).padStart(4, '0')}`,
    style: new TextStyle({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 8,
      fill: isFounder ? AMBER : deptHex,
      letterSpacing: 1,
    }),
  })
  empId.alpha = 0.9
  empId.x = 16
  empId.y = 17
  c.addChild(empId)

  // ── Status dot ──
  const statusHex = STATUS_COLORS[agent.status] || 0x374151
  const dot = new Graphics()
  dot.circle(TILE - 18, 21, 4)
  dot.fill({ color: statusHex })
  c.addChild(dot)
  // Wire dot into userData for ticker
  ;(c as any).userData.dot = dot

  // ── Founder star ──
  if (isFounder) {
    const starLabel = new Text({
      text: '★',
      style: new TextStyle({ fontFamily: 'JetBrains Mono', fontSize: 8, fill: AMBER }),
    })
    starLabel.alpha = 0.85
    starLabel.x = TILE - 28
    starLabel.y = 15
    c.addChild(starLabel)
  }

  // ── Name ──
  const nameText = new Text({
    text: agent.name.toUpperCase(),
    style: new TextStyle({
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: isFounder ? 11 : 10,
      fontWeight: isFounder ? '700' : '600',
      fill: 0xEDE8DC,   // warm white
      wordWrap: true,
      wordWrapWidth: TILE - 28,
      letterSpacing: 0.5,
    }),
  })
  nameText.x = 16
  nameText.y = 40
  c.addChild(nameText)

  // ── Role ──
  const roleText = new Text({
    text: agent.role.toUpperCase(),
    style: new TextStyle({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 7,
      fill: deptHex,
      wordWrap: true,
      wordWrapWidth: TILE - 28,
      letterSpacing: 0.5,
    }),
  })
  roleText.alpha = 0.85
  roleText.x = 16
  roleText.y = 57
  c.addChild(roleText)

  // ── Separator ──
  const sep = new Graphics()
  sep.moveTo(16, 74).lineTo(TILE - 16, 74)
  sep.stroke({ color: borderCol, alpha: 0.18, width: 0.75 })
  c.addChild(sep)

  // ── Mini barcode ──
  const barWidths = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2]
  let bx = 16
  barWidths.forEach((w, i) => {
    if (i % 2 === 0) {
      const bar = new Graphics()
      bar.rect(bx, 80, w, 10)
      bar.fill({ color: deptHex, alpha: 0.3 })
      c.addChild(bar)
    }
    bx += barWidths[i] + 1
  })

  // ── Strike indicator ──
  if (agent.strikes && agent.strikes.length > 0) {
    const strikeLbl = new Text({
      text: `▲${agent.strikes.length}`,
      style: new TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 8, fill: 0xEF4444,
      }),
    })
    strikeLbl.x = TILE - 30
    strikeLbl.y = 80
    c.addChild(strikeLbl)
  }

  // ── Hover state ──
  c.on('pointerover', () => {
    border.stroke({ color: borderCol, alpha: 1.0, width: isFounder ? 2 : 1.5 })
    bg.fill({ color: 0x131828 })
  })
  c.on('pointerout', () => {
    border.stroke({ color: borderCol, alpha: borderAlpha, width: isFounder ? 1.5 : 1 })
    bg.fill({ color: bgCol })
  })
  c.on('pointerdown', onClick)

  return c
}
