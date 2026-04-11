'use client'

/**
 * Contact Mobile Card
 * =====================
 * Mobile-optimized card view for CRM contacts.
 */

import React from 'react'
import { Phone, Mail, Star, ChevronRight } from 'lucide-react'
import type { Contact } from '../_lib/types'
import { getCfg, getActivityInfo } from '../_lib/constants'

export const ContactCard = React.memo(function ContactCard({ contact, onRowClick, fmt }: {
  contact: Contact
  onRowClick: (c: Contact) => void
  fmt: (n: number) => string
}) {
  const cfg = getCfg(contact.type)
  const bal = Number(contact.balance || 0)
  const act = getActivityInfo(contact)

  return (
    <div className="app-card app-card-hover" style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => onRowClick(contact)}>
      <div className="flex items-start gap-3">
        <div style={{
          width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
          background: cfg.bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <cfg.icon size={15} style={{ color: cfg.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex justify-between items-start">
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                fontWeight: 700, fontSize: '0.875rem', color: 'var(--app-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {contact.name}
              </h3>
              {contact.company_name && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)', marginTop: '0.0625rem' }}>
                  {contact.company_name}
                </p>
              )}
            </div>
            <span style={{
              fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0, marginLeft: '0.5rem',
              color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
            }}>
              {fmt(Math.abs(bal))}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.1875rem', marginTop: '0.3125rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
              fontSize: '0.5rem', fontWeight: 700,
              textTransform: 'uppercase', background: cfg.bg, color: cfg.color,
            }}>
              {contact.type === 'BOTH' ? 'CLIENT+SUPPLIER' : contact.type}
            </span>
            {contact.customer_tier && contact.customer_tier !== 'STANDARD' && (
              <span style={{ padding: '0.0625rem 0.3125rem', borderRadius: '99px', fontSize: '0.5rem', fontWeight: 700, background: '#FEF3C7', color: '#B45309' }}>
                {contact.customer_tier === 'VIP' && '⭐ '}{contact.customer_tier}
              </span>
            )}
            {act.hasActivity && (
              <span style={{ padding: '0.0625rem 0.3125rem', borderRadius: '99px', fontSize: '0.5rem', fontWeight: 600, color: act.recencyColor, background: act.recencyColor + '15' }}>
                {act.orders} orders • {act.recency}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.3125rem', flexWrap: 'wrap' }}>
            {contact.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                <Phone size={9} /> {contact.phone}
              </span>
            )}
            {contact.email && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                <Mail size={9} /> {contact.email}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--app-text-faint)', flexShrink: 0, marginTop: '0.5rem' }} />
      </div>
    </div>
  )
})
