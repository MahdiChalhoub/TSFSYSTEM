'use client'

/**
 * Contact Table Row — Desktop
 * =============================
 * Single row in the desktop table view with type badge, contact info, tags, activity, and balance.
 */

import React from 'react'
import {
  Phone, Mail, Star, TrendingUp, TrendingDown,
  ChevronRight, CircleDot,
} from 'lucide-react'
import type { Contact } from '../_lib/types'
import { getCfg, getActivityInfo, formatRelDate } from '../_lib/constants'

export const ContactTableRow = React.memo(function ContactTableRow({ contact, onRowClick, fmt }: {
  contact: Contact
  onRowClick: (c: Contact) => void
  fmt: (n: number) => string
}) {
  const cfg = getCfg(contact.type)
  const bal = Number(contact.balance || 0)
  const act = getActivityInfo(contact)

  return (
    <tr className="app-table-row" style={{ cursor: 'pointer' }} onClick={() => onRowClick(contact)}>
      {/* Name */}
      <td className="app-td">
        <div className="flex items-center gap-2.5">
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '0.5rem',
            background: cfg.bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <cfg.icon size={13} style={{ color: cfg.color }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: '0.8125rem', color: 'var(--app-text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '14rem',
            }}>
              {contact.name}
            </div>
            {contact.company_name && (
              <div style={{
                fontSize: '0.6875rem', color: 'var(--app-text-muted)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '14rem',
              }}>
                {contact.company_name}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Type + Tier */}
      <td className="app-td">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1875rem', alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.125rem',
            padding: '0.0625rem 0.375rem', borderRadius: '99px',
            fontSize: '0.5625rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.03em',
            background: cfg.bg, color: cfg.color,
          }}>
            {contact.type === 'BOTH' ? 'CLIENT+SUPPLIER' : contact.type}
          </span>
          {contact.customer_tier && contact.customer_tier !== 'STANDARD' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.125rem',
              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
              fontSize: '0.5rem', fontWeight: 700,
              background: contact.customer_tier === 'VIP' ? '#FEF3C7' : 'var(--app-surface-2)',
              color: contact.customer_tier === 'VIP' ? '#B45309' : 'var(--app-text-muted)',
            }}>
              {contact.customer_tier === 'VIP' && <Star size={7} style={{ fill: '#EAB308' }} />}
              {contact.customer_tier}
            </span>
          )}
          {contact.supplier_category && contact.supplier_category !== 'REGULAR' && (
            <span style={{
              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
              fontSize: '0.5rem', fontWeight: 700,
              background: 'var(--app-warning-bg)', color: 'var(--app-warning)',
            }}>
              {contact.supplier_category === 'DEPOT_VENTE' ? 'CONSIGN' : contact.supplier_category}
            </span>
          )}
        </div>
      </td>

      {/* Phone/Email */}
      <td className="app-td">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.0625rem' }}>
          {contact.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', fontSize: '0.75rem', color: 'var(--app-text)' }}>
              <Phone size={10} style={{ color: 'var(--app-text-faint)' }} /> {contact.phone}
            </span>
          )}
          {contact.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
              <Mail size={9} style={{ color: 'var(--app-text-faint)' }} /> {contact.email}
            </span>
          )}
          {!contact.phone && !contact.email && <span style={{ color: 'var(--app-text-faint)', fontSize: '0.6875rem' }}>—</span>}
        </div>
      </td>

      {/* Tags */}
      <td className="app-td">
        <div style={{ display: 'flex', gap: '0.1875rem', flexWrap: 'wrap' }}>
          {(contact.tagNames || contact.tag_names || []).slice(0, 2).map((t: any) => (
            <span key={t.id || t.name} style={{
              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
              fontSize: '0.5rem', fontWeight: 600,
              background: (t.color || '#6366F1') + '18',
              color: t.color || '#6366F1',
            }}>
              {t.name}
            </span>
          ))}
          {(contact.tagNames || contact.tag_names || []).length > 2 && (
            <span style={{ fontSize: '0.5rem', color: 'var(--app-text-faint)' }}>+{(contact.tagNames || contact.tag_names).length - 2}</span>
          )}
        </div>
      </td>

      {/* Activity */}
      <td className="app-td" style={{ textAlign: 'center' }}>
        {act.hasActivity ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.1875rem',
              fontSize: '0.6875rem', fontWeight: 700, color: act.recencyColor,
            }}>
              <CircleDot size={7} />
              {act.orders}
            </span>
            {contact.last_purchase_date && (
              <span style={{ fontSize: '0.5rem', color: 'var(--app-text-faint)' }}>
                {formatRelDate(contact.last_purchase_date)}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)', fontStyle: 'italic' }}>—</span>
        )}
      </td>

      {/* Balance */}
      <td className="app-td" style={{ textAlign: 'right' }}>
        <span style={{
          fontWeight: 700, fontSize: '0.8125rem',
          color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
          display: 'inline-flex', alignItems: 'center', gap: '0.1875rem',
        }}>
          {bal > 0 && <TrendingUp size={11} />}
          {bal < 0 && <TrendingDown size={11} />}
          {fmt(Math.abs(bal))}
        </span>
      </td>

      {/* Arrow */}
      <td className="app-td" style={{ textAlign: 'center' }}>
        <ChevronRight size={14} style={{ color: 'var(--app-text-faint)' }} />
      </td>
    </tr>
  )
})
