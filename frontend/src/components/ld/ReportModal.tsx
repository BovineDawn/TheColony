import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, FileText, Download } from 'lucide-react'
import { api } from '../../lib/api'
import { MdRenderer } from './MdRenderer'

interface ReportModalProps {
  filename: string
  isOnboarding?: boolean
  title?: string
  onClose: () => void
}

export function ReportModal({ filename, isOnboarding = false, title, onClose }: ReportModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const path = isOnboarding
      ? `/api/ld/reports/onboarding/${filename}`
      : `/api/ld/reports/${filename}`

    api.get(path)
      .then((data: any) => setContent(data.content))
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false))
  }, [filename, isOnboarding])

  const handleDownload = () => {
    if (!content) return
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'hsl(215 22% 4% / 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 760, maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 4, flexShrink: 0,
              backgroundColor: 'hsl(262 80% 64% / 0.1)',
              border: '1px solid hsl(262 80% 64% / 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={14} style={{ color: 'hsl(262 80% 64%)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                letterSpacing: '0.18em', color: 'hsl(262 80% 64%)',
                marginBottom: 3,
              }}>
                {isOnboarding ? 'ONBOARDING REPORT' : 'L&D CYCLE REPORT'}
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '0.95rem',
                fontWeight: 700, color: 'var(--color-text-primary)',
                letterSpacing: '0.03em', lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {title || filename.replace('.md', '')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {content && (
                <button
                  onClick={handleDownload}
                  title="Download markdown"
                  style={{
                    width: 30, height: 30, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(262 80% 64% / 0.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <Download size={12} />
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)', cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-danger)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', justifyContent: 'center' }}>
                <Loader2 size={16} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>
                  LOADING REPORT…
                </span>
              </div>
            )}
            {error && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-danger)', padding: '40px 0', textAlign: 'center' }}>
                {error}
              </p>
            )}
            {content && <MdRenderer content={content} />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
