'use client'

import { useState, useTransition } from 'react'
import { Coupon, CouponPayload, createCoupon, deleteCoupon, toggleCoupon } from '@/app/actions/ecommerce/coupons'
import { Percent, Plus, Trash2, Tag, Clock, Users, ToggleLeft, ToggleRight } from 'lucide-react'

interface Props { initialCoupons: Coupon[] }

const defaultForm: CouponPayload = {
    code: '', discount_type: 'PERCENT', value: '', min_order_amount: '0',
    max_uses: null, valid_from: null, valid_until: null, is_active: true,
}

export default function CouponsClient({ initialCoupons }: Props) {
    const [coupons, setCoupons] = useState(initialCoupons)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState<CouponPayload>(defaultForm)
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleCreate = () => {
        setError('')
        startTransition(async () => {
            const res = await createCoupon(form)
            if (!res.ok) { setError(res.error ?? 'Failed'); return }
            setCoupons(prev => [res.coupon!, ...prev])
            setShowModal(false)
            setForm(defaultForm)
        })
    }

    const handleToggle = (id: number, current: boolean) => {
        startTransition(async () => {
            await toggleCoupon(id, !current)
            setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c))
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm('Delete this coupon?')) return
        startTransition(async () => {
            await deleteCoupon(id)
            setCoupons(prev => prev.filter(c => c.id !== id))
        })
    }

    const active = coupons.filter(c => c.is_active).length
    const expired = coupons.filter(c => c.valid_until && new Date(c.valid_until) < new Date()).length

    return (
        <div className="app-page">
            {/* Header */}
            <div className="app-page-header">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--app-accent)', opacity: 0.9 }}>
                        <Percent size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="app-page-title">Coupons</h1>
                        <p className="app-page-subtitle">Discount codes applied at checkout</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="app-btn app-btn-primary flex items-center gap-1.5" id="create-coupon-btn">
                    <Plus size={15} /> New Coupon
                </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Codes', value: coupons.length, icon: Tag, color: 'var(--app-accent)' },
                    { label: 'Active', value: active, icon: ToggleRight, color: '#10b981' },
                    { label: 'Expired', value: expired, icon: Clock, color: '#f59e0b' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="app-card flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `${color}18` }}>
                            <Icon size={18} style={{ color }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--app-text)]">{value}</p>
                            <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="app-card p-0 overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--app-border)] flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">
                        {coupons.length} coupon{coupons.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--app-border)]">
                            {['Code', 'Type', 'Value', 'Min Order', 'Uses', 'Expires', 'Active', ''].map(h => (
                                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {coupons.length === 0 && (
                            <tr><td colSpan={8} className="py-16 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--app-accent)15' }}>
                                        <Tag size={22} style={{ color: 'var(--app-accent)' }} />
                                    </div>
                                    <p className="font-semibold text-[var(--app-text)]">No coupons yet</p>
                                    <p className="text-xs text-[var(--app-text-muted)]">Create your first discount code</p>
                                </div>
                            </td></tr>
                        )}
                        {coupons.map(c => (
                            <tr key={c.id} className="border-b border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] transition-colors">
                                <td className="px-4 py-3">
                                    <span className="font-mono font-bold text-[var(--app-text)] bg-[var(--app-accent)]/10 text-[var(--app-accent)] px-2 py-0.5 rounded text-xs tracking-widest">
                                        {c.code}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.discount_type === 'PERCENT'
                                        ? 'bg-violet-500/15 text-app-accent border border-violet-400/20'
                                        : 'bg-sky-500/15 text-app-info border border-sky-400/20'}`}>
                                        {c.discount_type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-[var(--app-text)]">
                                    {c.discount_type === 'PERCENT' ? `${c.value}%` : c.value}
                                </td>
                                <td className="px-4 py-3 text-[var(--app-text-muted)]">{c.min_order_amount}</td>
                                <td className="px-4 py-3 text-[var(--app-text-muted)]">
                                    <span className={c.max_uses && c.used_count >= c.max_uses ? 'text-app-error' : ''}>
                                        {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-[var(--app-text-muted)]">
                                    {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <button onClick={() => handleToggle(c.id, c.is_active)}
                                        id={`toggle-coupon-${c.id}`}
                                        className="transition-opacity hover:opacity-80">
                                        {c.is_active
                                            ? <ToggleRight size={22} className="text-app-success" />
                                            : <ToggleLeft size={22} className="text-[var(--app-text-muted)]" />}
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <button onClick={() => handleDelete(c.id)} id={`delete-coupon-${c.id}`}
                                        className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-app-error hover:bg-rose-500/10 transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="app-card w-full max-w-md space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'var(--app-accent)', opacity: 0.9 }}>
                                <Percent size={16} color="#fff" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-[var(--app-text)]">New Coupon</h2>
                                <p className="text-xs text-[var(--app-text-muted)]">Create a discount code</p>
                            </div>
                        </div>
                        {error && <p className="text-app-error text-sm bg-rose-500/10 px-3 py-2 rounded-lg">{error}</p>}
                        <div className="space-y-3">
                            <div>
                                <label className="app-label">Code</label>
                                <input id="coupon-code" className="app-input uppercase" placeholder="SUMMER20"
                                    value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Type</label>
                                    <select id="coupon-type" className="app-input" value={form.discount_type}
                                        onChange={e => setForm(p => ({ ...p, discount_type: e.target.value as 'PERCENT' | 'FIXED' }))}>
                                        <option value="PERCENT">Percent (%)</option>
                                        <option value="FIXED">Fixed Amount</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="app-label">Value</label>
                                    <input id="coupon-value" type="number" className="app-input" placeholder="10"
                                        value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Min Order</label>
                                    <input id="coupon-min" type="number" className="app-input" value={form.min_order_amount ?? '0'}
                                        onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="app-label">Max Uses</label>
                                    <input id="coupon-max-uses" type="number" className="app-input" placeholder="Unlimited"
                                        onChange={e => setForm(p => ({ ...p, max_uses: e.target.value ? +e.target.value : null }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Valid From</label>
                                    <input id="coupon-from" type="date" className="app-input"
                                        onChange={e => setForm(p => ({ ...p, valid_from: e.target.value || null }))} />
                                </div>
                                <div>
                                    <label className="app-label">Valid Until</label>
                                    <input id="coupon-until" type="date" className="app-input"
                                        onChange={e => setForm(p => ({ ...p, valid_until: e.target.value || null }))} />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setShowModal(false)} className="app-btn app-btn-ghost flex-1">Cancel</button>
                            <button id="coupon-submit" onClick={handleCreate} disabled={isPending} className="app-btn app-btn-primary flex-1">
                                {isPending ? 'Creating…' : 'Create Coupon'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
