'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
    Landmark, ArrowLeft, Loader2, Edit, Trash2,
    DollarSign, Link as LinkIcon, Monitor, Power,
    FolderTree, Users, BookOpen, TrendingUp,
    Activity, Clock, ShieldCheck, Hash
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/* ── Info Row ── */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b last:border-0"
            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{label}</span>
            <span className={`text-[12px] font-bold text-app-foreground ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
        </div>
    )
}

/* ── Status Pill ── */
function StatusPill({ active, label }: { active: boolean; label: string }) {
    const color = active ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)'
    return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
        </span>
    )
}

export default function AccountDetailPage() {
    const router = useRouter()
    const { id } = useParams()
    const [item, setItem] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [deleteOpen, setDeleteOpen] = useState(false)

    useEffect(() => {
        erpFetch(`finance/accounts/${id}/`, { cache: 'no-store' })
            .then(setItem)
            .catch(() => toast.error('Failed to load account'))
            .finally(() => setLoading(false))
    }, [id])

    const handleDelete = async () => {
        try {
            await erpFetch(`finance/accounts/${id}/`, { method: 'DELETE' })
            toast.success('Account deleted')
            router.push('/finance/accounts')
        } catch { toast.error('Failed to delete account') }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-app-primary" />
        </div>
    )

    if (!item) return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
            <Landmark size={36} className="text-app-muted-foreground opacity-40" />
            <p className="text-sm font-bold text-app-muted-foreground">Account not found</p>
            <Link href="/finance/accounts">
                <button className="text-[11px] font-bold text-app-primary hover:underline">← Back to accounts</button>
            </Link>
        </div>
    )

    const cat = item.categoryData
    const coa = item.ledgerAccount
    const users = item.assignedUsers || []
    const isActive = item.is_active !== false
    const isPOS = item.is_pos_enabled === true
    const catColor = cat?.color || 'var(--app-primary)'

    const kpis = [
        { label: 'Balance', value: `${Number(item.balance || 0).toLocaleString('en', { minimumFractionDigits: 2 })} ${item.currency || ''}`, color: 'var(--app-success, #22c55e)', icon: <TrendingUp size={14} /> },
        { label: 'Currency', value: item.currency || 'USD', color: 'var(--app-info, #3b82f6)', icon: <DollarSign size={14} /> },
        { label: 'COA Code', value: coa?.code || '—', color: '#8b5cf6', icon: <LinkIcon size={14} /> },
        { label: 'Status', value: isActive ? 'Active' : 'Inactive', color: isActive ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)', icon: <Power size={14} /> },
        { label: 'POS', value: isPOS ? 'Enabled' : 'Disabled', color: isPOS ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)', icon: <Monitor size={14} /> },
    ]

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/finance/accounts">
                        <button className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <ArrowLeft size={13} /><span className="hidden sm:inline">Accounts</span>
                        </button>
                    </Link>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: `color-mix(in srgb, ${catColor} 12%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${catColor} 25%, transparent)` }}>
                        <Landmark size={20} style={{ color: catColor }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Finance · {cat?.name || item.type || 'Account'}
                        </p>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">{item.name}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <StatusPill active={isActive} label={isActive ? 'Active' : 'Inactive'} />
                    <Link href={`/finance/accounts/${id}/edit`}>
                        <button className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Edit size={13} /> Edit
                        </button>
                    </Link>
                    <button onClick={() => setDeleteOpen(true)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all"
                        style={{ color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 5%, transparent)' }}>
                        <Trash2 size={13} /> Delete
                    </button>
                </div>
            </div>

            {/* ── KPI Strip ── */}
            <div className="mb-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {kpis.map(s => (
                    <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Content Grid ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

                    {/* Card: Account Details */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                <Hash size={13} />
                            </div>
                            <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">Account Configuration</span>
                        </div>
                        <div className="px-4 py-1">
                            <InfoRow label="Name" value={item.name} />
                            <InfoRow label="Type" value={item.type} />
                            <InfoRow label="Currency" value={item.currency} mono />
                            <InfoRow label="Description" value={item.description} />
                            <InfoRow label="POS Enabled" value={isPOS ? '✓ Yes' : '✗ No'} />
                            <InfoRow label="Active" value={isActive ? '✓ Yes' : '✗ No'} />
                        </div>
                    </div>

                    {/* Card: COA Linkage */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', color: '#8b5cf6' }}>
                                <FolderTree size={13} />
                            </div>
                            <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">Chart of Accounts</span>
                        </div>
                        <div className="px-4 py-1">
                            {coa ? (
                                <>
                                    <InfoRow label="COA Code" value={coa.code} mono />
                                    <InfoRow label="COA Name" value={coa.name} />
                                    <InfoRow label="COA Type" value={coa.type} />
                                </>
                            ) : (
                                <div className="py-6 text-center">
                                    <LinkIcon size={20} className="mx-auto text-app-muted-foreground opacity-30 mb-2" />
                                    <p className="text-[11px] font-bold text-app-muted-foreground">No COA linkage</p>
                                </div>
                            )}
                        </div>

                        {/* Category Sub-section */}
                        <div className="px-4 py-2.5 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${catColor} 12%, transparent)`, color: catColor }}>
                                    <BookOpen size={11} />
                                </div>
                                <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Category</span>
                            </div>
                            {cat ? (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                    style={{ background: `color-mix(in srgb, ${catColor} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${catColor} 15%, transparent)` }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${catColor} 15%, transparent)`, color: catColor }}>
                                        <FolderTree size={13} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[12px] font-black text-app-foreground">{cat.name}</div>
                                        <div className="text-[9px] font-bold text-app-muted-foreground">{cat.code} · {cat.description || 'No description'}</div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] font-bold text-app-muted-foreground italic">Uncategorized</p>
                            )}
                        </div>
                    </div>

                    {/* Card: Assigned Users */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                    <Users size={13} />
                                </div>
                                <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">Assigned Users</span>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                {users.length}
                            </span>
                        </div>
                        <div className="px-4 py-3">
                            {users.length > 0 ? (
                                <div className="space-y-2">
                                    {users.map((u: any) => (
                                        <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                            style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                                {(u.name || '?')[0].toUpperCase()}
                                            </div>
                                            <span className="text-[12px] font-bold text-app-foreground">{u.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-4 text-center">
                                    <Users size={20} className="mx-auto text-app-muted-foreground opacity-30 mb-2" />
                                    <p className="text-[11px] font-bold text-app-muted-foreground">No users assigned</p>
                                    <p className="text-[9px] text-app-muted-foreground mt-0.5">Assign users in POS terminal settings</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card: Recent Activity */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                <Activity size={13} />
                            </div>
                            <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">Recent Activity</span>
                        </div>
                        <div className="px-4 py-6 text-center">
                            <Clock size={20} className="mx-auto text-app-muted-foreground opacity-30 mb-2" />
                            <p className="text-[11px] font-bold text-app-muted-foreground">Transaction history</p>
                            <p className="text-[9px] text-app-muted-foreground mt-0.5">Coming soon — ledger movements will appear here</p>
                        </div>
                    </div>

                    {/* Card: Security & Compliance */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                <ShieldCheck size={13} />
                            </div>
                            <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">Audit Trail</span>
                        </div>
                        <div className="px-4 py-1">
                            <InfoRow label="Account ID" value={`#${item.id}`} mono />
                            <InfoRow label="Created" value={item.created_at ? new Date(item.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} />
                            <InfoRow label="Last Modified" value={item.updated_at ? new Date(item.updated_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} />
                            <InfoRow label="Organization" value={item.organization ? `${String(item.organization).slice(0, 8)}…` : '—'} mono />
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen}
                onConfirm={handleDelete} title="Delete Financial Account?"
                description="If this account has transactions, it will be deactivated instead." variant="danger" />
        </div>
    )
}
