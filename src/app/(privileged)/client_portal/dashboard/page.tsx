'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
  User, ShoppingBag, CreditCard, Star, Loader2,
  ChevronRight, ArrowRight, Package, ArrowUpDown
} from 'lucide-react'

type ProfileData = {
  user: { id: number; email: string; first_name: string; last_name: string }
  contact: { id: number; name: string; email: string; phone: string; type: string }
  access: {
    id: number; portal_type: string; status: string;
    relationship_role: string; can_access_ecommerce: boolean; last_portal_login: string | null
  }
}

type OrderSummary = {
  id: number; order_number: string; status: string;
  total_amount: number; created_at: string; payment_status: string
}

type ContextItem = {
  access_id: number; contact_id: number; contact_name: string;
  is_primary: boolean; is_current: boolean
}

export default function ClientDashboardPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [contexts, setContexts] = useState<ContextItem[]>([])
  const [points, setPoints] = useState<{ points_balance: number; tier_name: string | null }>({ points_balance: 0, tier_name: null })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prof, ord, pts, ctx] = await Promise.all([
        erpFetch('client-gate/me/').catch(() => null),
        erpFetch('client-gate/me/orders/').catch(() => ({ orders: [] })),
        erpFetch('client-gate/me/points/').catch(() => ({ points_balance: 0, tier_name: null })),
        erpFetch('client-gate/me/contexts/').catch(() => ({ contexts: [] })),
      ])
      if (prof) setProfile(prof)
      setOrders(ord?.orders || [])
      setPoints(pts)
      setContexts(ctx?.contexts || [])
    } catch { toast.error('Failed to load dashboard') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--app-muted-foreground)' }}>
      <Loader2 size={32} className="animate-spin" />
    </div>
  )

  if (!profile) return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Admin Preview Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-success)))',
        borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '2rem', color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Client Portal — Admin Preview</h1>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0.25rem 0 0' }}>
              You are viewing this as an admin. You do not have a client portal access record.
            </p>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <a href="/access/client-access" style={{
          padding: '1.5rem', borderRadius: 12, background: 'var(--app-card)', border: '1px solid var(--app-border)',
          display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'var(--app-foreground)',
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={22} color="var(--app-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>Manage Client Access</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>Grant, revoke, or modify client portal access</div>
          </div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--app-muted-foreground)' }} />
        </a>
        <a href="/access/users" style={{
          padding: '1.5rem', borderRadius: 12, background: 'var(--app-card)', border: '1px solid var(--app-border)',
          display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'var(--app-foreground)',
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={22} color="var(--app-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>User Management</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>Create users, assign roles, reset passwords</div>
          </div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--app-muted-foreground)' }} />
        </a>
      </div>
    </div>
  )

  const { user, contact, access } = profile

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-success)))',
        borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '2rem', color: 'white',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Welcome back, {user.first_name || contact.name}
        </h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0.5rem 0 0' }}>
          {contact.name} · {access.relationship_role === 'SELF' ? 'Personal Account' : access.relationship_role}
        </p>

        {/* Context Switcher */}
        {contexts.length > 1 && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {contexts.map(c => (
              <span key={c.access_id} style={{
                padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.75rem',
                background: c.is_current ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                cursor: 'pointer', fontWeight: c.is_current ? 600 : 400,
              }}>
                {c.contact_name} {c.is_current && '✓'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {/* Orders Count */}
        <div style={{
          padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)',
          border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShoppingBag size={22} color="var(--app-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>
              {orders.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>Orders</div>
          </div>
        </div>

        {/* Loyalty Points */}
        <div style={{
          padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)',
          border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'color-mix(in srgb, var(--app-success) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Star size={22} color="var(--app-success)" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>
              {points.points_balance}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>
              {points.tier_name || 'Loyalty Points'}
            </div>
          </div>
        </div>

        {/* Portal Access */}
        <div style={{
          padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)',
          border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={22} color="var(--app-warning)" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--app-foreground)' }}>
              {access.can_access_ecommerce ? 'Full Access' : 'Portal Only'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>
              {access.can_access_ecommerce ? 'Portal + eCommerce' : 'Client Portal'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div style={{
        borderRadius: 12, background: 'var(--app-card)',
        border: '1px solid var(--app-border)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--app-foreground)', margin: 0 }}>
            Recent Orders
          </h2>
        </div>
        {orders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--app-muted-foreground)' }}>
            <Package size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p style={{ margin: 0 }}>No orders yet</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--app-muted)' }}>
                {['Order #', 'Date', 'Status', 'Total'].map(h => (
                  <th key={h} style={{
                    padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.7rem',
                    fontWeight: 600, color: 'var(--app-muted-foreground)', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.875rem', color: 'var(--app-foreground)' }}>
                    {o.order_number || `#${o.id}`}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 500,
                      background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                      color: 'var(--app-primary)',
                    }}>{o.status}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--app-foreground)' }}>
                    {typeof o.total_amount === 'number' ? `$${o.total_amount.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
