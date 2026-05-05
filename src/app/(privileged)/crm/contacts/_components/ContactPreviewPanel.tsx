'use client'

/**
 * Contact Preview Panel — Wide-screen sidebar
 * ===============================================
 * Quick intelligence summary for a selected contact.
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Mail, MapPin, Users, ArrowRight } from 'lucide-react'
import type { Contact } from '../_lib/types'
import { getCfg, getActivityInfo } from '../_lib/constants'

export function ContactPreviewPanel({ contact, onClose, fmt, deliveryZones }: {
  contact: Contact | null
  onClose: () => void
  fmt: (n: number) => string
  deliveryZones: Record<string, any>[]
}) {
  const router = useRouter()

  if (!contact) {
    return (
      <div className="app-card p-10 flex flex-col items-center justify-center text-center opacity-60 border-dashed border-2 bg-app-surface-2/30 h-64">
        <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center mb-4">
          <Users size={32} className="text-app-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-app-foreground">Select a contact</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mt-1 px-4">
          to view intelligence summary & quick actions
        </p>
      </div>
    )
  }

  const cfg = getCfg(contact.type)
  const bal = Number(contact.balance || 0)

  return (
    <div className="app-card p-6 space-y-6 animate-in slide-in-from-right-4 duration-300 relative overflow-hidden">
      <div
        style={{
          position: 'absolute', top: 0, right: 0, width: '8rem', height: '8rem',
          background: cfg.color, opacity: 0.05, borderRadius: '0 0 0 100%',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
            background: cfg.bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            {React.createElement(cfg.icon, { size: 24, style: { color: cfg.color } })}
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--app-foreground)', lineHeight: 1.1 }}>
              {contact.name}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)', marginTop: '0.25rem' }}>
              {contact.company_name || 'Individual Contact'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-app-surface-2/50 p-3 rounded-xl border border-app-border/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Balance</p>
            <p style={{
              fontSize: '1rem', fontWeight: 800,
              color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-foreground)',
            }}>
              {fmt(Math.abs(bal))}
            </p>
          </div>
          <div className="bg-app-surface-2/50 p-3 rounded-xl border border-app-border/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Orders</p>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--app-foreground)' }}>
              {getActivityInfo(contact).orders}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-app-surface-2 flex items-center justify-center shrink-0">
              <Phone size={14} className="text-app-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-app-muted-foreground">Phone</p>
              <p className="text-sm font-bold">{contact.phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-app-surface-2 flex items-center justify-center shrink-0">
              <Mail size={14} className="text-app-muted-foreground" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="text-[10px] font-black uppercase text-app-muted-foreground">Email</p>
              <p className="text-sm font-bold truncate">{contact.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-app-surface-2 flex items-center justify-center shrink-0">
              <MapPin size={14} className="text-app-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-app-muted-foreground">Location</p>
              <p className="text-sm font-bold">
                {typeof contact.home_zone === 'object' ? contact.home_zone.name :
                  deliveryZones.find(z => z.id === contact.home_zone)?.name || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => router.push(`/crm/contacts/${contact.id}`)}
            className="w-full h-12 bg-app-primary text-white font-black uppercase text-[11px] tracking-widest rounded-xl hover:shadow-lg hover:shadow-app-primary-glow/30 transition-all flex items-center justify-center gap-2 group"
          >
            View Full Profile <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={onClose}
            className="w-full h-10 bg-app-surface-2 text-app-muted-foreground font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-app-border/30 transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}
