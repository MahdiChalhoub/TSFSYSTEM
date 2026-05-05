'use client'

/**
 * Add Contact Dropdown
 * ======================
 * Fixed-position dropdown for choosing contact type before creation.
 */

import { TYPES } from '../_lib/constants'

export function AddContactDropdown({ menuPos, onClose, onSelect }: {
  menuPos: { top: number; right: number }
  onClose: () => void
  onSelect: (type: string) => void
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
      <div
        style={{
          position: 'fixed', top: menuPos.top, right: menuPos.right,
          background: 'var(--app-surface)', border: '1px solid var(--app-border)',
          borderRadius: 'var(--app-radius)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          minWidth: '13rem', zIndex: 100, padding: '0.25rem',
        }}
      >
        <div style={{ padding: '0.375rem 0.625rem', fontSize: '0.5625rem', fontWeight: 700, color: 'var(--app-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Choose Contact Type
        </div>
        {TYPES.filter(t => t.key !== 'ALL').map(cfg => (
          <button
            key={cfg.key}
            onClick={() => onSelect(cfg.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              width: '100%', padding: '0.4375rem 0.625rem',
              borderRadius: 'calc(var(--app-radius) - 0.375rem)',
              fontSize: '0.75rem', fontWeight: 600,
              background: 'transparent', color: 'var(--app-foreground)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseOver={e => e.currentTarget.style.background = cfg.bg}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: '1.375rem', height: '1.375rem', borderRadius: '0.3125rem',
              background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <cfg.icon size={11} style={{ color: cfg.color }} />
            </div>
            <span>{cfg.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
