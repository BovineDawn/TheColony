/**
 * Lightweight markdown renderer for L&D reports.
 * Handles the specific subset of markdown our reports generate:
 * headings, tables, bold, lists, blockquotes, hr, code spans.
 * No external dependencies.
 */
import React from 'react'

function parseLine(line: string, key: number): React.ReactNode {
  // Replace **bold** and `code`
  const parts: React.ReactNode[] = []
  let remaining = line
  let i = 0

  while (remaining.length > 0) {
    const boldIdx  = remaining.indexOf('**')
    const codeIdx  = remaining.indexOf('`')
    const first    = Math.min(
      boldIdx  === -1 ? Infinity : boldIdx,
      codeIdx  === -1 ? Infinity : codeIdx,
    )

    if (first === Infinity) {
      parts.push(remaining)
      break
    }

    if (first > 0) parts.push(remaining.slice(0, first))

    if (boldIdx !== -1 && boldIdx === first) {
      const end = remaining.indexOf('**', boldIdx + 2)
      if (end === -1) { parts.push(remaining); break }
      parts.push(<strong key={`b${i++}`} style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{remaining.slice(boldIdx + 2, end)}</strong>)
      remaining = remaining.slice(end + 2)
    } else {
      const end = remaining.indexOf('`', codeIdx + 1)
      if (end === -1) { parts.push(remaining); break }
      parts.push(<code key={`c${i++}`} style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        backgroundColor: 'hsl(215 22% 12%)',
        border: '1px solid var(--color-border)',
        borderRadius: 3, padding: '1px 5px',
        color: 'var(--color-primary)',
      }}>{remaining.slice(codeIdx + 1, end)}</code>)
      remaining = remaining.slice(end + 1)
    }
  }

  return <React.Fragment key={key}>{parts}</React.Fragment>
}

function parseTable(lines: string[]): React.ReactNode {
  const rows = lines.map(l => l.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()))
  const [header, , ...body] = rows
  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        <thead>
          <tr>
            {header?.map((cell, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '6px 12px',
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                letterSpacing: '0.08em', fontWeight: 600,
                backgroundColor: 'hsl(215 22% 9%)',
              }}>
                {cell.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid hsl(215 22% 13%)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '6px 12px', color: 'var(--color-text-muted)' }}>
                  {parseLine(cell, ci)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MdRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // HR
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />)
      i++; continue
    }

    // H1
    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={i} style={{
          fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700,
          color: 'var(--color-text-primary)', letterSpacing: '0.04em',
          marginBottom: 12, marginTop: 4,
        }}>
          {parseLine(line.slice(2), i)}
        </h1>
      )
      i++; continue
    }

    // H2
    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.2em', color: 'var(--color-primary)',
          marginBottom: 10, marginTop: 20, textTransform: 'uppercase',
        }}>
          {line.slice(3)}
        </h2>
      )
      i++; continue
    }

    // H3
    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} style={{
          fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700,
          color: 'var(--color-text-primary)', letterSpacing: '0.03em',
          marginBottom: 6, marginTop: 16,
        }}>
          {parseLine(line.slice(4), i)}
        </h3>
      )
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} style={{
          borderLeft: '2px solid hsl(189 100% 50% / 0.4)',
          paddingLeft: 12, margin: '8px 0',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-body)', fontSize: '13px',
          fontStyle: 'italic',
        }}>
          {parseLine(line.slice(2), i)}
        </blockquote>
      )
      i++; continue
    }

    // Table: collect all consecutive table lines
    if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      nodes.push(<React.Fragment key={`table-${i}`}>{parseTable(tableLines)}</React.Fragment>)
      continue
    }

    // Unordered list item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: React.ReactNode[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(
          <li key={i} style={{ marginBottom: 3, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
            {parseLine(lines[i].slice(2), i)}
          </li>
        )
        i++
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 18, margin: '6px 0 10px' }}>
          {listItems}
        </ul>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: 6 }} />)
      i++; continue
    }

    // Regular paragraph
    nodes.push(
      <p key={i} style={{
        fontFamily: 'var(--font-body)', fontSize: '13px',
        color: 'var(--color-text-muted)', lineHeight: 1.6,
        marginBottom: 6,
      }}>
        {parseLine(line, i)}
      </p>
    )
    i++
  }

  return <div style={{ padding: '4px 0' }}>{nodes}</div>
}
