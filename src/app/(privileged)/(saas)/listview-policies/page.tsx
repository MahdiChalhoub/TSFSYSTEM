'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Shield, Plus, Pencil, Trash2, EyeOff, Lock,
    Filter, ChevronDown, ChevronUp,
    Building2, Globe, Search, AlertTriangle, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { listAllPolicies, deleteListViewPolicy } from '@/app/actions/listview-policies'

/* ═══════════════════════════════════════════════════════
   List View Governance — Policy List Page
   ═══════════════════════════════════════════════════════ */

type Policy = {
    id: number
    organization: string | null
    organization_name: string
    view_key: string
    config: {
        hidden_columns?: string[]
        hidden_filters?: string[]
        forced_columns?: string[]
        max_page_size?: number | null
        locked_sort?: { key: string; dir: string } | null
    }
    is_active: boolean
    notes: string
    created_at: string
    updated_at: string
}

export default function ListViewPoliciesPage() {
    const router = useRouter()
    const [policies, setPolicies] = useState<Policy[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expandedId, setExpandedId] = useState<number | null>(null)

    const fetchPolicies = useCallback(async () => {
        setLoading(true)
        try {
            const data = await listAllPolicies()
            setPolicies(Array.isArray(data) ? data : data?.results || [])
        } catch {
            toast.error('Failed to load policies')
        }
        setLoading(false)
    }, [])

    useEffect(() => { fetchPolicies() }, [fetchPolicies])

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this policy? Organizations will revert to default visibility.')) return
        try {
            await deleteListViewPolicy(id)
            toast.success('Policy deleted')
            fetchPolicies()
        } catch {
            toast.error('Failed to delete')
        }
    }

    const filtered = policies.filter(p => {
        if (!search) return true
        const s = search.toLowerCase()
        return p.view_key.toLowerCase().includes(s) ||
            p.organization_name?.toLowerCase().includes(s) ||
            p.notes?.toLowerCase().includes(s)
    })

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* ── Header ─── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                        background: 'var(--app-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 14px var(--app-primary-glow, rgba(99,102,241,0.3))'
                    }}>
                        <Shield className="w-5 h-5" style={{ color: '#fff' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--app-text)', margin: 0 }}>
                            List View Governance
                        </h1>
                        <p style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', margin: 0 }}>
                            Control which columns and filters each organization can see
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/listview-policies/edit')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.625rem 1.25rem', borderRadius: '0.75rem',
                        fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer',
                        background: 'var(--app-primary)', color: '#fff',
                        boxShadow: '0 4px 14px var(--app-primary-glow, rgba(99,102,241,0.3))',
                    }}
                >
                    <Plus size={16} /> New Policy
                </button>
            </div>

            {/* ── Info Banner ─── */}
            <div style={{
                padding: '1rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.25rem',
                background: 'var(--app-primary-light, rgba(99,102,241,0.08))',
                border: '1px solid var(--app-primary, #6366f1)',
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
            }}>
                <AlertTriangle size={18} style={{ color: 'var(--app-primary)', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--app-text)', lineHeight: 1.6 }}>
                    <strong>How it works:</strong> Select a list view → see all fields →
                    toggle columns as <strong>Hidden</strong> or <strong>Forced</strong>,
                    toggle filters as <strong>Blocked</strong>.
                    Hidden items are physically removed from org users&apos; UI.
                </div>
            </div>

            {/* ── Search ─── */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <Search size={16} style={{
                    position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--app-text-muted)'
                }} />
                <input
                    placeholder="Search policies..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                        borderRadius: '0.75rem', border: '1px solid var(--app-border)',
                        background: 'var(--app-surface)', color: 'var(--app-text)',
                        fontSize: '0.85rem', outline: 'none',
                    }}
                />
            </div>

            {/* ── Policy Cards ─── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-text-muted)' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    Loading...
                </div>
            ) : filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '3rem', borderRadius: '0.75rem',
                    border: '1px dashed var(--app-border)', color: 'var(--app-text-muted)',
                }}>
                    <Shield size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 600 }}>No policies yet</p>
                    <p>Click &quot;New Policy&quot; to control what organizations see.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(p => (
                        <PolicyCard key={p.id} policy={p}
                            expanded={expandedId === p.id}
                            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                            onEdit={() => router.push(`/listview-policies/edit?id=${p.id}`)}
                            onDelete={() => handleDelete(p.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ── Policy Card ───────────────────────────── */
function PolicyCard({ policy, expanded, onToggle, onEdit, onDelete }: {
    policy: Policy, expanded: boolean, onToggle: () => void,
    onEdit: () => void, onDelete: () => void
}) {
    const hc = policy.config.hidden_columns?.length || 0
    const fc = policy.config.forced_columns?.length || 0
    const hf = policy.config.hidden_filters?.length || 0

    return (
        <div style={{
            overflow: 'hidden', border: '1px solid var(--app-border)',
            borderRadius: '0.75rem', background: 'var(--app-surface)',
        }}>
            <div onClick={onToggle} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem', cursor: 'pointer',
            }}>
                <div style={{
                    width: '2rem', height: '2rem', borderRadius: '0.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: policy.organization ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                    flexShrink: 0,
                }}>
                    {policy.organization
                        ? <Building2 size={14} style={{ color: 'var(--app-info)' }} />
                        : <Globe size={14} style={{ color: '#eab308' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--app-text)' }}>
                            {policy.view_key === '*' ? '🌐 Global Policy' : policy.view_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span style={{
                            fontSize: '0.65rem', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontWeight: 700,
                            background: policy.organization ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                            color: policy.organization ? 'var(--app-info)' : '#eab308',
                        }}>
                            {policy.organization_name || 'ALL ORGS'}
                        </span>
                    </div>
                    {policy.notes && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--app-text-muted)', margin: '0.15rem 0 0' }}>{policy.notes}</p>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                    {hc > 0 && <StatBadge icon={<EyeOff size={11} />} label={`${hc} hidden`} color="var(--app-error)" />}
                    {fc > 0 && <StatBadge icon={<Lock size={11} />} label={`${fc} forced`} color="var(--app-success)" />}
                    {hf > 0 && <StatBadge icon={<Filter size={11} />} label={`${hf} filters`} color="var(--app-warning)" />}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); onEdit() }}
                        title="Edit" style={iconBtnStyle}><Pencil size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); onDelete() }}
                        title="Delete" style={{ ...iconBtnStyle, color: 'var(--app-error)' }}><Trash2 size={14} /></button>
                </div>
                {expanded
                    ? <ChevronUp size={16} style={{ color: 'var(--app-text-muted)' }} />
                    : <ChevronDown size={16} style={{ color: 'var(--app-text-muted)' }} />}
            </div>
            {expanded && (
                <div style={{
                    padding: '0.75rem 1rem 1rem', borderTop: '1px solid var(--app-border)',
                    background: 'var(--app-surface-2, rgba(0,0,0,0.02))',
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
                        <TagGroup title="Hidden Columns" items={policy.config.hidden_columns} color="var(--app-error)" />
                        <TagGroup title="Forced Columns" items={policy.config.forced_columns} color="var(--app-success)" />
                        <TagGroup title="Hidden Filters" items={policy.config.hidden_filters} color="var(--app-warning)" />
                    </div>
                </div>
            )}
        </div>
    )
}

function StatBadge({ icon, label, color }: { icon: React.ReactNode, label: string, color: string }) {
    return <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', fontWeight: 700, color }}>{icon} {label}</span>
}

function TagGroup({ title, items, color }: { title: string, items?: string[], color: string }) {
    if (!items?.length) return null
    return (
        <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: '0.3rem' }}>{title}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {items.map(i => (
                    <span key={i} style={{
                        fontSize: '0.65rem', padding: '0.12rem 0.4rem', borderRadius: '0.25rem',
                        background: 'var(--app-surface)', border: '1px solid var(--app-border)',
                        fontFamily: 'monospace', color: 'var(--app-text)',
                    }}>{i}</span>
                ))}
            </div>
        </div>
    )
}

const iconBtnStyle: React.CSSProperties = {
    padding: '0.375rem', borderRadius: '0.375rem', border: 'none',
    background: 'transparent', cursor: 'pointer', color: 'var(--app-text-muted)',
}
