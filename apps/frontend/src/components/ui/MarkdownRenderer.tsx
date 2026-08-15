import React from 'react'
import { ChevronRight } from 'lucide-react'

interface Props {
  content: string
  style?: React.CSSProperties
}

export default function MarkdownRenderer({ content, style }: Props) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Table détection
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<MarkdownTable key={i} lines={tableLines} />)
      continue
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{
          fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)',
          color: 'var(--text)', margin: '24px 0 12px',
          letterSpacing: '-.3px',
          paddingBottom: 10,
          borderBottom: '2px solid rgba(108,71,255,.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {renderInline(line.slice(2))}
        </h1>
      )
      i++; continue
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{
          fontSize: 17, fontWeight: 'var(--fw-bold)',
          color: 'var(--p3)', margin: '20px 0 8px',
          display: 'flex', alignItems: 'center', gap: 8,
          letterSpacing: '-.2px',
        }}>
          {renderInline(line.slice(3))}
        </h2>
      )
      i++; continue
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{
          fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)',
          color: 'var(--acc)', margin: '16px 0 6px',
        }}>
          {renderInline(line.slice(4))}
        </h3>
      )
      i++; continue
    }

    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{
          borderLeft: '3px solid var(--p)',
          paddingLeft: 14, margin: '10px 0',
          color: 'var(--text2)',
          fontSize: 'var(--fs-sm)', fontStyle: 'italic',
        }}>
          {renderInline(line.slice(2))}
        </blockquote>
      )
      i++; continue
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={i} style={{
          background: 'var(--bg4)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 16px',
          fontSize: 'var(--fs-label)', fontFamily: 'var(--mono)',
          color: 'var(--acc2)', overflow: 'auto',
          margin: '10px 0', lineHeight: 1.6,
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      i++; continue
    }

    if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
      elements.push(
        <hr key={i} style={{
          border: 'none', height: 1,
          background: 'linear-gradient(90deg,transparent,var(--border),transparent)',
          margin: '16px 0',
        }} />
      )
      i++; continue
    }

    if (line.match(/^[-*•]\s/)) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
        listItems.push(lines[i].replace(/^[-*•]\s/, ''))
        i++
      }
      elements.push(
        <ul key={i} style={{
          margin: '8px 0', paddingLeft: 0,
          listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          {listItems.map((item, j) => (
            <li key={j} style={{
              display: 'flex', gap: 8,
              alignItems: 'flex-start', fontSize: 'var(--fs-sm)',
            }}>
              <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--p2)', flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: 'var(--text2)', lineHeight: 1.6 }}>
                {renderInline(item)}
              </span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (line.match(/^\d+\.\s/)) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={i} style={{
          margin: '8px 0', paddingLeft: 0,
          listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {listItems.map((item, j) => (
            <li key={j} style={{
              display: 'flex', gap: 10,
              alignItems: 'flex-start', fontSize: 'var(--fs-sm)',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--p)',
                color: '#fff', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
                marginTop: 1,
              }}>{j + 1}</span>
              <span style={{
                color: 'var(--text2)', lineHeight: 1.6,
                flex: 1,
              }}>
                {renderInline(item)}
              </span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    if (line.match(/^- \[[ xX]\]/)) {
      const items: { checked: boolean; text: string }[] = []
      while (i < lines.length && lines[i].match(/^- \[[ xX]\]/)) {
        items.push({
          checked: /\[x\]/i.test(lines[i]),
          text: lines[i].replace(/^- \[[ xX]\]\s*/, ''),
        })
        i++
      }
      elements.push(
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: 5,
          margin: '8px 0',
        }}>
          {items.map((item, j) => (
            <div key={j} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 'var(--fs-sm)',
            }}>
              <span style={{
                fontSize: 'var(--fs-md)',
                color: item.checked ? 'var(--acc2)' : 'var(--text3)',
              }}>
                {item.checked ? '☑' : '☐'}
              </span>
              <span style={{
                color: item.checked ? 'var(--text3)' : 'var(--text2)',
                textDecoration: item.checked ? 'line-through' : 'none',
              }}>
                {renderInline(item.text)}
              </span>
            </div>
          ))}
        </div>
      )
      continue
    }

    if (!line.trim()) {
      elements.push(<div key={i} style={{ height: 6 }} />)
      i++; continue
    }

    elements.push(
      <p key={i} style={{
        fontSize: 13.5, color: 'var(--text2)',
        lineHeight: 1.75, margin: '4px 0',
      }}>
        {renderInline(line)}
      </p>
    )
    i++
  }

  return (
    <div style={{ fontFamily: 'var(--font)', ...style }}>
      {elements}
    </div>
  )
}

function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null
  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean)
  const rows = lines.slice(2).map(l =>
    l.split('|').map(c => c.trim()).filter(Boolean)
  )

  return (
    <div style={{
      overflowX: 'auto', margin: '12px 0',
      borderRadius: 10, border: '1px solid var(--border)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg4)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '9px 12px', textAlign: 'left',
                fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
                textTransform: 'uppercase', letterSpacing: '.6px',
                color: 'var(--text3)',
                borderBottom: '1px solid var(--border)',
              }}>
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
            }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '8px 12px', fontSize: 'var(--fs-label)',
                  color: 'var(--text2)',
                  borderBottom: i < rows.length - 1
                    ? '1px solid var(--border)' : 'none',
                }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  if (!text) return null

  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      parts.push(
        <strong key={match.index} style={{ color: 'var(--text)', fontWeight: 'var(--fw-bold)' }}>
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <em key={match.index} style={{ color: 'var(--p3)', fontStyle: 'italic' }}>
          {match[3]}
        </em>
      )
    } else if (match[4]) {
      parts.push(
        <code key={match.index} style={{
          background: 'var(--bg4)',
          border: '1px solid var(--border)',
          borderRadius: 4, padding: '1px 6px',
          fontSize: 'var(--fs-label)', fontFamily: 'var(--mono)',
          color: 'var(--acc)', letterSpacing: 0,
        }}>
          {match[4]}
        </code>
      )
    } else if (match[5] && match[6]) {
      parts.push(
        <a key={match.index} href={match[6]}
          target="_blank" rel="noopener noreferrer"
          style={{
            color: 'var(--p3)', textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}>
          {match[5]}
        </a>
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}
