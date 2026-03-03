'use client'

import { useState, useTransition } from 'react'
import { CartPromotion, PromotionPayload, RULE_TYPE_LABELS, RuleType } from '@/app/actions/ecommerce/promotions-types'
import { createPromotion, deletePromotion, togglePromotion } from '@/app/actions/ecommerce/promotions'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Star, Layers } from 'lucide-react'

interface Props { initialPromotions: CartPromotion[] }

const RULE_COLORS: Record<RuleType, string> = {
    SPEND_THRESHOLD: '#10b981',
    BOGO: '#f59e0b',
    BUNDLE: '#06b6d4',
    MIN_QUANTITY: '#8b5cf6',
}

const defaultForm: PromotionPayload = {
    name: '', rule_type: 'SPEND_THRESHOLD',
    conditions: {}, reward: {}, priority: 0,
    stackable: false, is_active: true, max_uses: null,
}

function JsonField({ label, id, value, onChange }: { label: string; id: string; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
    const [raw, setRaw] = useState(JSON.stringify(value, null, 2))
    const [err, setErr] = useState('')
    return (
        <div>
            <label className="app-label">{label}</label>
            <textarea id={id} className="app-input font-mono text-xs" rows={4}
                value={raw}
                onChange={e => setRaw(e.target.value)}
                onBlur={() => { try { onChange(JSON.parse(raw)); setErr('') } catch { setErr('Invalid JSON') } }} />
            {err && <p className="text-rose-400 text-xs mt-1">{err}</p>}
        </div>
    )
}

export default function PromotionsClient({ initialPromotions }: Props) {
    const [promos, setPromos] = useState(initialPromotions)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState<PromotionPayload>(defaultForm)
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleCreate = () => {
        setError('')
        startTransition(async () => {
            const res = await createPromotion(form)
            if (!res.ok) { setError(res.error ?? 'Failed'); return }
            setPromos(prev => [res.promotion!, ...prev])
            setShowModal(false)
            setForm(defaultForm)
        })
    }

    const handleToggle = (id: number, current: boolean) => {
        startTransition(async () => {
            await togglePromotion(id, !current)
            setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm('Delete this promotion?')) return
        startTransition(async () => {
            await deletePromotion(id)
            setPromos(prev => prev.filter(p => p.id !== id))
        })
    }

    const active = promos.filter(p => p.is_active).length

    return (
        <div className="app-page">
            {/* Header */}
            <div className="app-page-header">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: '#f59e0b', opacity: 0.9 }}>
                        <Zap size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="app-page-title">Promotions</h1>
                        <p className="app-page-subtitle">Cart rules and automatic discount campaigns</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="app-btn app-btn-primary" id="create-promo-btn">
                    <Plus size={15} /> New Promotion
                </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Rules', value: promos.length, icon: Layers, color: '#8b5cf6' },
                    { label: 'Active', value: active, icon: ToggleRight, color: '#10b981' },
                    { label: 'Paused', value: promos.length - active, icon: ToggleLeft, color: '#64748b' },
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

            {/* List */}
            <div className="app-card p-0 overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--app-border)]">
                    <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">
                        {promos.length} promotion{promos.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {promos.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#f59e0b18' }}>
                            <Zap size={22} style={{ color: '#f59e0b' }} />
                        </div>
                        <p className="font-semibold text-[var(--app-text)]">No promotions yet</p>
                        <p className="text-xs text-[var(--app-text-muted)]">Create automatic cart discount rules</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--app-border)]">
                        {promos.map(p => {
                            const color = RULE_COLORS[p.rule_type] ?? 'var(--app-accent)'
                            return (
                                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--app-surface-hover)] transition-colors">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: `${color}18` }}>
                                        <Star size={14} style={{ color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm text-[var(--app-text)]">{p.name}</span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium border"
                                                style={{ background: `${color}18`, color, borderColor: `${color}30` }}>
                                                {RULE_TYPE_LABELS[p.rule_type]}
                                            </span>
                                            {p.stackable && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)]">
                                                    Stackable
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                                            Priority: {p.priority} · Uses: {p.used_count}{p.max_uses ? `/${p.max_uses}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => handleToggle(p.id, p.is_active)} id={`toggle-promo-${p.id}`}
                                            className="transition-opacity hover:opacity-80">
                                            {p.is_active
                                                ? <ToggleRight size={22} className="text-emerald-400" />
                                                : <ToggleLeft size={22} className="text-[var(--app-text-muted)]" />}
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} id={`delete-promo-${p.id}`}
                                            className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="app-card w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f59e0b' }}>
                                <Zap size={16} color="#fff" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-[var(--app-text)]">New Promotion</h2>
                                <p className="text-xs text-[var(--app-text-muted)]">Automatic cart discount rule</p>
                            </div>
                        </div>
                        {error && <p className="text-rose-400 text-sm bg-rose-500/10 px-3 py-2 rounded-lg">{error}</p>}
                        <div className="space-y-3">
                            <div>
                                <label className="app-label">Name</label>
                                <input id="promo-name" className="app-input" placeholder="Summer Sale"
                                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Rule Type</label>
                                    <select id="promo-rule-type" className="app-input" value={form.rule_type}
                                        onChange={e => setForm(p => ({ ...p, rule_type: e.target.value as RuleType }))}>
                                        {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="app-label">Priority</label>
                                    <input id="promo-priority" type="number" className="app-input" value={form.priority}
                                        onChange={e => setForm(p => ({ ...p, priority: +e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Max Uses</label>
                                    <input id="promo-max-uses" type="number" className="app-input" placeholder="Unlimited"
                                        onChange={e => setForm(p => ({ ...p, max_uses: e.target.value ? +e.target.value : null }))} />
                                </div>
                                <div className="flex items-center gap-3 pt-6">
                                    <input id="promo-stackable" type="checkbox" checked={form.stackable}
                                        onChange={e => setForm(p => ({ ...p, stackable: e.target.checked }))} />
                                    <label htmlFor="promo-stackable" className="text-sm text-[var(--app-text)]">Stackable with other rules</label>
                                </div>
                            </div>
                            <JsonField label="Conditions (JSON)" id="promo-conditions" value={form.conditions}
                                onChange={v => setForm(p => ({ ...p, conditions: v }))} />
                            <JsonField label="Reward (JSON)" id="promo-reward" value={form.reward}
                                onChange={v => setForm(p => ({ ...p, reward: v }))} />
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setShowModal(false)} className="app-btn app-btn-ghost flex-1">Cancel</button>
                            <button id="promo-submit" onClick={handleCreate} disabled={isPending} className="app-btn app-btn-primary flex-1">
                                {isPending ? 'Creating…' : 'Create Promotion'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
