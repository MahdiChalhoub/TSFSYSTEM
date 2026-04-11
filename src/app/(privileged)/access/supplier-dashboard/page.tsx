'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
    Truck, FileText, Package, DollarSign, Loader2,
    Clock, User, ChevronRight
} from 'lucide-react'

type ProfileData = {
    user: { id: number; email: string; first_name: string; last_name: string }
    contact: { id: number; name: string; email: string; phone: string; type: string }
    access: {
        id: number; portal_type: string; status: string;
        relationship_role: string; last_portal_login: string | null
    }
}

type InvoiceSummary = {
    id: number; invoice_number: string; status: string;
    total_amount: number; created_at: string; payment_status: string
}

type ProductSummary = {
    id: number; name: string; sku: string; price: number; stock_quantity: number
}

type ContextItem = {
    access_id: number; contact_id: number; contact_name: string;
    is_primary: boolean; is_current: boolean
}

export default function SupplierDashboardPage() {
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
    const [products, setProducts] = useState<ProductSummary[]>([])
    const [contexts, setContexts] = useState<ContextItem[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [prof, inv, prods, ctx] = await Promise.all([
                erpFetch('supplier-gate/me/').catch(() => null),
                erpFetch('supplier-gate/me/invoices/').catch(() => ({ invoices: [] })),
                erpFetch('supplier-gate/me/products/').catch(() => ({ products: [] })),
                erpFetch('supplier-gate/me/contexts/').catch(() => ({ contexts: [] })),
            ])
            if (prof) setProfile(prof)
            setInvoices(inv?.invoices || [])
            setProducts(prods?.products || [])
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
                background: 'linear-gradient(135deg, #f59e0b, color-mix(in srgb, #f59e0b 70%, #ef4444))',
                borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '2rem', color: 'white',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Supplier Portal — Admin Preview</h1>
                        <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0.25rem 0 0' }}>
                            You are viewing this as an admin. You do not have a supplier portal access record.
                        </p>
                    </div>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <a href="/access/supplier-access" style={{
                    padding: '1.5rem', borderRadius: 12, background: 'var(--app-card)', border: '1px solid var(--app-border)',
                    display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'var(--app-foreground)',
                }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'color-mix(in srgb, #f59e0b 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={22} color="#f59e0b" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>Manage Supplier Access</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>Grant, revoke, or modify supplier portal access</div>
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
    const totalInvoiceValue = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0)

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Welcome Banner */}
            <div style={{
                background: 'linear-gradient(135deg, var(--app-warning), color-mix(in srgb, var(--app-warning) 70%, var(--app-danger)))',
                borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '2rem', color: 'white',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: 'rgba(255,255,255,0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Truck size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                            {contact.name}
                        </h1>
                        <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '0.25rem 0 0' }}>
                            {user.first_name} {user.last_name} · {access.relationship_role === 'SELF' ? 'Primary Contact' : access.relationship_role}
                        </p>
                    </div>
                </div>

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
                <div style={{
                    padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)',
                    border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Package size={22} color="var(--app-primary)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>
                            {products.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>Products Supplied</div>
                    </div>
                </div>

                <div style={{
                    padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)',
                    border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FileText size={22} color="var(--app-warning)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>
                            {invoices.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>Purchase Invoices</div>
                    </div>
                </div>

                <div style={{
                    padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)',
                    border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: 'color-mix(in srgb, var(--app-success) 15%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <DollarSign size={22} color="var(--app-success)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>
                            ${totalInvoiceValue.toFixed(0)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>Total Invoice Value</div>
                    </div>
                </div>
            </div>

            {/* Two-column: Products + Invoices */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Products */}
                <div style={{
                    borderRadius: 12, background: 'var(--app-card)',
                    border: '1px solid var(--app-border)', overflow: 'hidden',
                }}>
                    <div style={{
                        padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--app-foreground)', margin: 0 }}>
                            Your Products
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>
                            {products.length} items
                        </span>
                    </div>
                    {products.length === 0 ? (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--app-muted-foreground)' }}>
                            <Package size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>No products linked</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                            {products.slice(0, 20).map(p => (
                                <div key={p.id} style={{
                                    padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--app-border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--app-foreground)' }}>{p.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)', fontFamily: 'monospace' }}>{p.sku}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--app-foreground)' }}>
                                            ${Number(p.price || 0).toFixed(2)}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>
                                            Stock: {p.stock_quantity ?? '—'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Invoices */}
                <div style={{
                    borderRadius: 12, background: 'var(--app-card)',
                    border: '1px solid var(--app-border)', overflow: 'hidden',
                }}>
                    <div style={{
                        padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--app-foreground)', margin: 0 }}>
                            Recent Invoices
                        </h2>
                    </div>
                    {invoices.length === 0 ? (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--app-muted-foreground)' }}>
                            <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>No invoices yet</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                            {invoices.slice(0, 15).map(i => (
                                <div key={i.id} style={{
                                    padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--app-border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--app-foreground)' }}>
                                            {i.invoice_number || `#${i.id}`}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>
                                            {i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--app-foreground)' }}>
                                            ${Number(i.total_amount || 0).toFixed(2)}
                                        </div>
                                        <span style={{
                                            padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.65rem', fontWeight: 500,
                                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>{i.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
