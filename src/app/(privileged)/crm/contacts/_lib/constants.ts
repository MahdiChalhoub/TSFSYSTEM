/**
 * CRM Contacts — Constants & Helpers
 * =====================================
 */

import {
  User, Briefcase, RefreshCw, TrendingUp, BookUser, Wrench, TrendingDown, Users,
} from 'lucide-react'
import type { Contact } from './types'

/* ─── Type chips ─────────────────────────────────── */
export const TYPES = [
  { key: 'ALL', label: 'All', shortLabel: 'All', icon: Users, color: 'var(--app-foreground)', bg: 'var(--app-surface-2)' },
  { key: 'CUSTOMER', label: 'Customers', shortLabel: 'Clients', icon: User, color: 'var(--app-info)', bg: 'var(--app-info-bg)' },
  { key: 'SUPPLIER', label: 'Suppliers', shortLabel: 'Suppliers', icon: Briefcase, color: 'var(--app-warning)', bg: 'var(--app-warning-bg)' },
  { key: 'BOTH', label: 'Client + Supplier', shortLabel: 'Both', icon: RefreshCw, color: '#D946EF', bg: 'rgba(217,70,239,0.08)' },
  { key: 'LEAD', label: 'Leads', shortLabel: 'Leads', icon: TrendingUp, color: 'var(--app-success)', bg: 'var(--app-success-bg)' },
  { key: 'CONTACT', label: 'Address Book', shortLabel: 'Contacts', icon: BookUser, color: 'var(--app-primary)', bg: 'var(--app-primary-light)' },
  { key: 'SERVICE', label: 'Service Providers', shortLabel: 'Services', icon: Wrench, color: 'var(--app-accent)', bg: 'rgba(139,92,246,0.08)' },
  { key: 'CREDITOR', label: 'Creditors', shortLabel: 'Creditors', icon: TrendingDown, color: 'var(--app-error)', bg: 'rgba(239,68,68,0.08)' },
  { key: 'DEBTOR', label: 'Debtors', shortLabel: 'Debtors', icon: TrendingUp, color: 'var(--app-warning)', bg: 'rgba(245,158,11,0.08)' },
] as const

export const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.key, t]))
export const getCfg = (type: string) => TYPE_MAP[type] || TYPE_MAP.ALL

/* ─── Tier config ─────────────────────────────────── */
export const TIERS = [
  { value: '', label: 'All Tiers' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'VIP', label: 'VIP' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'RETAIL', label: 'Retail' },
]

export const SUPPLIER_CATS = [
  { value: '', label: 'All Categories' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'DEPOT_VENTE', label: 'Consignment' },
  { value: 'MIXED', label: 'Mixed' },
]

/* ─── Activity helpers ──────────────────────────────── */
export function getActivityInfo(c: Contact) {
  const orders = Number(c.total_orders || 0) + Number(c.supplier_total_orders || 0)
  const lastDate = c.last_purchase_date
  const hasActivity = orders > 0 || !!lastDate
  let recency = 'never'; let recencyColor = 'var(--app-muted-foreground)'
  if (lastDate) {
    const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
    if (days <= 7) { recency = 'this week'; recencyColor = 'var(--app-success)' }
    else if (days <= 30) { recency = 'this month'; recencyColor = 'var(--app-info)' }
    else if (days <= 90) { recency = `${Math.floor(days / 30)}mo ago`; recencyColor = 'var(--app-warning)' }
    else { recency = `${Math.floor(days / 30)}mo ago` }
  }
  return { orders, hasActivity, recency, recencyColor }
}

export function formatRelDate(d: string | null | undefined): string {
  if (!d) return ''
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days <= 7) return `${days}d ago`
  if (days <= 30) return `${Math.floor(days / 7)}w ago`
  if (days <= 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
