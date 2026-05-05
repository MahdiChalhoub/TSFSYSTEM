'use client'

import { useEffect, useState } from 'react'
import {
    listPriceApprovalPolicies,
    createPriceApprovalPolicy,
    updatePriceApprovalPolicy,
    deletePriceApprovalPolicy,
    togglePolicyActive,
} from '@/app/actions/inventory/price-governance'
import {
    Shield, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
    ArrowLeft, ChevronDown, ChevronUp, AlertTriangle,
    CheckCircle2, XCircle, ShieldCheck, Users, DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Action Badge Config ──
const ACTION_CONFIG: Record<string, { label: string; icon: any; bg: string; fg: string }> = {
    AUTO_APPROVE: { label: 'Auto-Approve', icon: CheckCircle2, bg: 'rgba(34,197,94,0.12)', fg: 'var(--app-success)' },
    AUTO_APPROVE_PENDING_VERIFY: { label: 'Approve + Verify', icon: ShieldCheck, bg: 'rgba(59,130,246,0.12)', fg: 'var(--app-info)' },
    BLOCK: { label: 'Block', icon: XCircle, bg: 'rgba(239,68,68,0.12)', fg: 'var(--app-danger, #ef4444)' },
}

interface Policy {
    id: number
    name: string
    is_active: boolean
    priority: number
    applies_to_role: string | null
    applies_to_user: number | null
    applies_to_user_name: string | null
    max_delta_pct: string | null
    min_margin_pct: string | null
    max_amount: string | null
    allow_group_changes: boolean
    action: string
    created_at: string
}

export default function PriceGovernancePage() {
    const [policies, setPolicies] = useState<Policy[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Policy | null>(null)
    const [form, setForm] = useState({
        name: '', priority: '10', applies_to_role: '', max_delta_pct: '',
        min_margin_pct: '', max_amount: '', allow_group_changes: false, action: 'BLOCK',
    })

    useEffect(() => { loadPolicies() }, [])

    async function loadPolicies() {
        try {
            setLoading(true)
            const data = await listPriceApprovalPolicies()
            setPolicies(Array.isArray(data) ? data : (data?.results || []))
        } catch (e: any) {
            toast.error(e.message || 'Failed to load policies')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setForm({
            name: '', priority: '10', applies_to_role: '', max_delta_pct: '',
            min_margin_pct: '', max_amount: '', allow_group_changes: false, action: 'BLOCK',
        })
        setEditing(null)
        setShowForm(false)
    }

    function startEdit(p: Policy) {
        setForm({
            name: p.name,
            priority: String(p.priority),
            applies_to_role: p.applies_to_role || '',
            max_delta_pct: p.max_delta_pct || '',
            min_margin_pct: p.min_margin_pct || '',
            max_amount: p.max_amount || '',
            allow_group_changes: p.allow_group_changes,
            action: p.action,
        })
        setEditing(p)
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.name.trim()) { toast.error('Name is required'); return }
        const payload: any = {
            name: form.name,
            priority: parseInt(form.priority) || 10,
            applies_to_role: form.applies_to_role || null,
            max_delta_pct: form.max_delta_pct ? parseFloat(form.max_delta_pct) : null,
            min_margin_pct: form.min_margin_pct ? parseFloat(form.min_margin_pct) : null,
            max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
            allow_group_changes: form.allow_group_changes,
            action: form.action,
        }
        try {
            if (editing) {
                await updatePriceApprovalPolicy(editing.id, payload)
                toast.success('Policy updated')
            } else {
                await createPriceApprovalPolicy(payload)
                toast.success('Policy created')
            }
            resetForm()
            loadPolicies()
        } catch (e: any) {
            toast.error(e.message || 'Failed to save policy')
        }
    }

    async function handleToggle(id: number) {
        try {
            await togglePolicyActive(id)
            loadPolicies()
        } catch (e: any) {
            toast.error(e.message || 'Failed to toggle policy')
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this approval policy?')) return
        try {
            await deletePriceApprovalPolicy(id)
            toast.success('Policy deleted')
            loadPolicies()
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete')
        }
    }

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                        background: 'var(--app-primary)', color: 'white',
                    }}>
                        <Shield size={20} />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-app-foreground">Price Governance</h1>
                        <p className="text-sm text-app-muted-foreground">
                            Approval policies for automated price change governance
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            }}>
                <AlertTriangle size={18} style={{ color: 'var(--app-info)', marginTop: 2 }} />
                <div className="text-xs" style={{ color: 'var(--app-info)' }}>
                    <strong>How policies work:</strong> When a price change request is created,
                    the system evaluates all active policies in priority order (lowest first).
                    The first matching policy determines whether the change is auto-approved,
                    requires verification, or is blocked for manual review.
                </div>
            </div>

            {/* Add Policy Button */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => { resetForm(); setShowForm(!showForm) }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                    style={{
                        background: showForm ? 'var(--app-muted)' : 'var(--app-primary)',
                        color: showForm ? 'var(--app-foreground)' : 'white',
                    }}
                >
                    {showForm ? <ChevronUp size={16} /> : <Plus size={16} />}
                    {showForm ? 'Cancel' : 'Add Policy'}
                </button>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="rounded-xl p-5 mb-6 space-y-4"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                >
                    <h3 className="text-sm font-bold text-app-foreground mb-3">
                        {editing ? `Edit: ${editing.name}` : 'New Approval Policy'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Name */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Name</label>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Small Price Adjustments"
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Priority (lower = first)</label>
                            <input
                                type="number"
                                value={form.priority}
                                onChange={e => setForm({ ...form, priority: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Applies to Role</label>
                            <input
                                value={form.applies_to_role}
                                onChange={e => setForm({ ...form, applies_to_role: e.target.value })}
                                placeholder="e.g. manager, admin (blank = all)"
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            />
                        </div>

                        {/* Max Delta % */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Max Price Δ %</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.max_delta_pct}
                                onChange={e => setForm({ ...form, max_delta_pct: e.target.value })}
                                placeholder="e.g. 5.00"
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            />
                        </div>

                        {/* Min Margin % */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Min Margin %</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.min_margin_pct}
                                onChange={e => setForm({ ...form, min_margin_pct: e.target.value })}
                                placeholder="e.g. 15.00"
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            />
                        </div>

                        {/* Max Amount */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Max Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.max_amount}
                                onChange={e => setForm({ ...form, max_amount: e.target.value })}
                                placeholder="e.g. 10000.00"
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Action */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">Action</label>
                            <select
                                value={form.action}
                                onChange={e => setForm({ ...form, action: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}
                            >
                                <option value="BLOCK">🛑 Block — require manual approval</option>
                                <option value="AUTO_APPROVE">✅ Auto-approve and apply</option>
                                <option value="AUTO_APPROVE_PENDING_VERIFY">🔍 Auto-approve, require verification</option>
                            </select>
                        </div>

                        {/* Allow Group Changes */}
                        <div className="flex items-center gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, allow_group_changes: !form.allow_group_changes })}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    background: form.allow_group_changes ? 'rgba(34,197,94,0.12)' : 'var(--app-muted)',
                                    color: form.allow_group_changes ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                    border: '1px solid var(--app-border)',
                                }}
                            >
                                {form.allow_group_changes ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                Allow Group Price Changes
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium text-app-muted-foreground" style={{ background: 'var(--app-muted)' }}>
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: 'var(--app-primary)' }}>
                            {editing ? 'Update Policy' : 'Create Policy'}
                        </button>
                    </div>
                </form>
            )}

            {/* Policy Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                </div>
            ) : policies.length === 0 ? (
                <div className="text-center py-20 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <Shield size={40} className="mx-auto mb-3 text-app-muted-foreground opacity-40" />
                    <p className="text-sm font-bold text-app-muted-foreground">No approval policies configured</p>
                    <p className="text-xs text-app-muted-foreground mt-1">
                        All price changes will require manual review until you create policies
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {policies.map((p) => {
                        const actionCfg = ACTION_CONFIG[p.action] || ACTION_CONFIG.BLOCK
                        const ActionIcon = actionCfg.icon
                        return (
                            <div
                                key={p.id}
                                className="rounded-xl p-4 transition-all"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                    opacity: p.is_active ? 1 : 0.5,
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Priority badge */}
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style={{
                                            background: 'var(--app-muted)',
                                            color: 'var(--app-foreground)',
                                        }}>
                                            #{p.priority}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-app-foreground">{p.name}</span>
                                                {!p.is_active && (
                                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{
                                                        background: 'rgba(107,114,128,0.12)', color: 'var(--app-muted-foreground)',
                                                    }}>
                                                        DISABLED
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                {/* Action badge */}
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                                                    background: actionCfg.bg, color: actionCfg.fg,
                                                }}>
                                                    <ActionIcon size={10} />
                                                    {actionCfg.label}
                                                </span>

                                                {/* Conditions chips */}
                                                {p.applies_to_role && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                                                        background: 'rgba(139,92,246,0.1)', color: 'var(--app-accent, #8b5cf6)',
                                                    }}>
                                                        <Users size={9} />
                                                        {p.applies_to_role}
                                                    </span>
                                                )}
                                                {p.max_delta_pct && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                                                        background: 'var(--app-muted)', color: 'var(--app-foreground)',
                                                    }}>
                                                        Δ ≤ {p.max_delta_pct}%
                                                    </span>
                                                )}
                                                {p.min_margin_pct && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                                                        background: 'var(--app-muted)', color: 'var(--app-foreground)',
                                                    }}>
                                                        Margin ≥ {p.min_margin_pct}%
                                                    </span>
                                                )}
                                                {p.max_amount && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                                                        background: 'var(--app-muted)', color: 'var(--app-foreground)',
                                                    }}>
                                                        <DollarSign size={9} />
                                                        ≤ {Number(p.max_amount).toLocaleString()}
                                                    </span>
                                                )}
                                                {p.allow_group_changes && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                                                        background: 'rgba(251,191,36,0.1)', color: 'var(--app-warning)',
                                                    }}>
                                                        Group ✓
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleToggle(p.id)}
                                            className="p-2 rounded-lg transition-all hover:scale-110"
                                            style={{ color: p.is_active ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}
                                            title={p.is_active ? 'Disable' : 'Enable'}
                                        >
                                            {p.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                        <button
                                            onClick={() => startEdit(p)}
                                            className="p-2 rounded-lg transition-all hover:scale-110 text-app-muted-foreground"
                                            title="Edit"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-2 rounded-lg transition-all hover:scale-110"
                                            style={{ color: 'var(--app-danger, #ef4444)' }}
                                            title="Delete"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
