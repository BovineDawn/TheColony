import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useColonyStore } from '../../stores/colonyStore'
import { useUIStore } from '../../stores/uiStore'
import { departmentColors } from '../../lib/departments'
import type { Agent } from '../../types/agent'

const NODE_W = 156
const NODE_H = 80
const H_GAP = 20
const V_GAP = 72

interface TreeNode {
  agent: Agent
  x: number
  y: number
  children: TreeNode[]
}

function buildTree(agents: Agent[]): TreeNode | null {
  const founder = agents.find(a => a.isFounder)
  if (!founder) return null

  function buildNode(agent: Agent, depth: number): TreeNode {
    const children = agents
      .filter(a => a.managerId === agent.id)
      .map((child) => buildNode(child, depth + 1))

    // x will be calculated in layout pass
    return { agent, x: 0, y: depth * (NODE_H + V_GAP), children }
  }

  const root = buildNode(founder, 0)

  // Layout pass: assign x positions
  function layout(node: TreeNode, offsetX: number): number {
    if (node.children.length === 0) {
      node.x = offsetX
      return NODE_W
    }
    let cx = offsetX
    let totalWidth = 0
    for (const child of node.children) {
      const w = layout(child, cx)
      cx += w + H_GAP
      totalWidth += w + H_GAP
    }
    totalWidth -= H_GAP
    // Center parent over children
    const firstChild = node.children[0]
    const lastChild = node.children[node.children.length - 1]
    node.x = (firstChild.x + lastChild.x + NODE_W) / 2 - NODE_W / 2
    return totalWidth
  }

  layout(root, 0)
  return root
}

function collectNodes(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = []
  function walk(n: TreeNode) {
    result.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return result
}

function collectEdges(root: TreeNode): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  function walk(n: TreeNode) {
    n.children.forEach(child => {
      edges.push({
        x1: n.x + NODE_W / 2,
        y1: n.y + NODE_H,
        x2: child.x + NODE_W / 2,
        y2: child.y,
      })
      walk(child)
    })
  }
  walk(root)
  return edges
}

export function OrgChart() {
  const { agents } = useColonyStore()
  const { setSelectedAgent, setActivePanel } = useUIStore()

  const tree = useMemo(() => buildTree(agents), [agents])

  if (!tree) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No agents yet.
        </p>
      </div>
    )
  }

  const nodes = collectNodes(tree)
  const edges = collectEdges(tree)

  // Canvas dimensions
  const allX = nodes.map(n => n.x + NODE_W)
  const allY = nodes.map(n => n.y + NODE_H)
  const svgW = Math.max(...allX) + 60
  const svgH = Math.max(...allY) + 60

  return (
    <div className="h-full overflow-auto flex flex-col items-center py-10"
      style={{ backgroundColor: 'var(--color-background)' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.3rem', fontWeight: 700,
          letterSpacing: '0.14em', color: 'var(--color-amber)',
          textShadow: '0 0 16px hsl(42 65% 52% / 0.25)',
          marginBottom: 4,
        }}>
          THE COLONY
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '8px',
          letterSpacing: '0.2em', color: 'var(--color-text-dim)',
        }}>
          ORGANIZATIONAL HIERARCHY — {agents.length} COLONISTS
        </p>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', padding: '0 40px 40px' }}>
        <svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>

          {/* Connection lines */}
          {edges.map((e, i) => {
            const midY = (e.y1 + e.y2) / 2
            return (
              <motion.path
                key={i}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="hsl(215 14% 24%)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )
          })}

          {/* Agent nodes */}
          {nodes.map(({ agent, x, y }, i) => {
            const color    = departmentColors[agent.department]
            const isFounder = agent.isFounder
            const amberHex = '#B8922A'
            const borderColor = isFounder ? amberHex : color
            const statusColor =
              agent.status === 'working'  ? '#10B981'
            : agent.status === 'thinking' ? '#F59E0B'
            : agent.status === 'chatting' ? '#00D4FF'
            : agent.status === 'training' ? '#EC4899'
            : '#374151'

            return (
              <motion.g
                key={agent.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedAgent(agent.id)
                  setActivePanel('agent-profile')
                }}
              >
                {/* Outer amber glow for founder */}
                {isFounder && (
                  <rect x={x - 3} y={y - 3} width={NODE_W + 6} height={NODE_H + 6}
                    rx={5} fill="none"
                    stroke={amberHex} strokeWidth={1} strokeOpacity={0.18} />
                )}

                {/* Card background */}
                <rect
                  x={x} y={y} width={NODE_W} height={NODE_H} rx={4}
                  fill="hsl(215 20% 8%)"
                  stroke={borderColor}
                  strokeWidth={isFounder ? 1.5 : 1}
                  strokeOpacity={isFounder ? 0.9 : 0.5}
                />

                {/* Top dept stripe */}
                <rect x={x} y={y} width={NODE_W} height={3} rx={0} fill={color} opacity={0.8} />

                {/* Left inner accent */}
                <rect x={x + 1} y={y + 6} width={2} height={NODE_H - 12}
                  rx={1} fill={borderColor} opacity={isFounder ? 0.7 : 0.4} />

                {/* Employee ID */}
                <text x={x + 10} y={y + 18}
                  fontFamily="JetBrains Mono, monospace" fontSize={8}
                  fill={isFounder ? amberHex : color} opacity={0.85}>
                  #{String(agent.employeeId).padStart(4, '0')}
                </text>

                {/* Status dot */}
                <circle cx={x + NODE_W - 12} cy={y + 13} r={3.5} fill={statusColor} />

                {/* Name */}
                <text x={x + 10} y={y + 36}
                  fontFamily="Space Grotesk, sans-serif" fontSize={11}
                  fontWeight={isFounder ? '700' : '600'}
                  fill="hsl(42 12% 92%)">
                  {agent.name}
                </text>

                {/* Role */}
                <text x={x + 10} y={y + 51}
                  fontFamily="JetBrains Mono, monospace" fontSize={7.5}
                  fill={color} opacity={0.8} letterSpacing={0.5}>
                  {agent.role.length > 22 ? agent.role.slice(0, 21) + '…' : agent.role.toUpperCase()}
                </text>

                {/* Barcode decoration (bottom right) */}
                {[2,1,3,1,2,1,1,3].reduce((acc: { rects: any[]; x: number }, w, bi) => {
                  if (bi % 2 === 0) acc.rects.push(
                    <rect key={bi} x={x + NODE_W - 38 + acc.x} y={y + NODE_H - 11}
                      width={w} height={8} fill={color} opacity={0.2} />
                  )
                  acc.x += w + 1
                  return acc
                }, { rects: [], x: 0 }).rects}

                {/* Strike indicator */}
                {agent.strikes.length > 0 && (
                  <text x={x + 10} y={y + NODE_H - 5}
                    fontFamily="JetBrains Mono" fontSize={8} fill="#EF4444">
                    ▲{agent.strikes.length}
                  </text>
                )}
              </motion.g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
