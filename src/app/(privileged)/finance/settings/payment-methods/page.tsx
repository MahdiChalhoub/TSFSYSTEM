'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import {
    Plus, Pencil, Trash2, Save, X, Loader2, GripVertical,
    Banknote, CreditCard, Smartphone, Truck, Wallet, Phone, Zap, Hash, Shield, Key,
    Lock, ToggleLeft, ToggleRight,
} from 'lucide-react'

type PaymentMethod = {
    id: number; name: string; code: string; icon: string; color: string;
    is_system: boolean; is_active: boolean; sort_order: number;
}

const ICON_OPTIONS = [
    { value: 'banknote', label: 'Banknote', Icon: Banknote },
    { value: 'credit-card', label: 'Card', Icon: CreditCard },
    { value: 'wallet', label: 'Wallet', Icon: Wallet },
    { value: 'smartphone', label: 'Phone', Icon: Smartphone },
    { value: 'truck', label: 'Truck', Icon: Truck },
    { value: 'zap', label: 'Zap', Icon: Zap },
    { value: 'hash', label: 'Hash', Icon: Hash },
    { value: 'key', label: 'Key', Icon: Key },
    { value: 'shield', label: 'Shield', Icon: Shield },
]

const ICON_MAP: Record<string, any> = Object.fromEntries(ICON_OPTIONS.map(o => [o.value, o.Icon]))

const COLOR_OPTIONS = [
    'var(--app-primary)', 'var(--app-info)', 'var(--app-warning)', 'var(--app-error)', 'var(--app-accent)',
    '#ec4899', 'var(--app-accent-cyan)', 'var(--app-warning)', '#84cc16', '#14b8a6',
]

export default function PaymentMethodsPage() {
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<PaymentMethod | null>(null)
    const [isNew, setIsNew] = useState(false)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await erpFetch('finance/payment-methods/')
            setMethods(Array.isArray(data) ? data : data?.results || [])
        } catch { toast.error('Failed to load payment methods') }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!editing) return
        if (!editing.name.trim() || !editing.code.trim()) {
            toast.error('Name and Code are required'); return
        }
        setSaving(true)
        try {
            if (isNew) {
                await erpFetch('finance/payment-methods/', {
                    method: 'POST',
                    body: JSON.stringify(editing),
                })
                toast.success(`Created "${editing.name}"`)
            } else {
                await erpFetch(`finance/payment-methods/${editing.id}/`, {
                    method: 'PATCH',
                    body: JSON.stringify(editing),
                })
                toast.success(`Updated "${editing.name}"`)
            }
            setEditing(null); setIsNew(false); load()
        } catch (e: any) { toast.error(e?.message || 'Save failed') }
        setSaving(false)
    }

    const handleDelete = async (m: PaymentMethod) => {
        if (m.is_system) { toast.error('System methods cannot be deleted. Deactivate instead.'); return }
        if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return
        try {
            await erpFetch(`finance/payment-methods/${m.id}/`, { method: 'DELETE' })
            toast.success(`Deleted "${m.name}"`)
            load()
        } catch (e: any) { toast.error(e?.message || 'Delete failed') }
    }

    const handleToggle = async (m: PaymentMethod) => {
        try {
            await erpFetch(`finance/payment-methods/${m.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !m.is_active }),
            })
            toast.success(`${m.name} ${m.is_active ? 'deactivated' : 'activated'}`)
            load()
        } catch (e: any) { toast.error(e?.message || 'Toggle failed') }
    }

    const resolveIcon = (iconName: string) => ICON_MAP[iconName] || CreditCard

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden gap-4"
            style={{ height: 'calc(100dvh - 6rem)' }}>
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                        <CreditCard size={18} />
                    </div>
                    <div>
                        <h1>Payment Methods</h1>
                        <p className="text-[10px] text-app-muted-foreground">Manage your organization&apos;s accepted payment methods</p>
                    </div>
                </div>
                <button onClick={() => {
                    setEditing({ id: 0, name: '', code: '', icon: 'banknote', color: 'var(--app-primary)', is_system: false, is_active: true, sort_order: methods.length })
                    setIsNew(true)
                }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--app-primary)' }}>
                    <Plus size={13} /> New Method
                </button>
            </div>

            {/* ─── Methods List ─── */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-app-muted-foreground" />
                </div>
            ) : methods.length === 0 ? (
                <div className="text-center py-16">
                    <CreditCard size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold text-app-muted-foreground">No payment methods</p>
                    <p className="text-[10px] text-app-muted-foreground/60 mt-1">Create your first payment method to get started</p>
                </div>
            ) : (
                <div className="rounded-xl border border-app-border/50 overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
                    {/* Table header */}
                    <div className="grid grid-cols-[40px_1fr_100px_80px_80px_100px] gap-3 px-4 py-2.5 border-b border-app-border/50 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">
                        <span></span><span>Method</span><span>Code</span><span>Icon</span><span>Status</span><span className="text-right">Actions</span>
                    </div>
                    {methods.map((m, idx) => {
                        const Icon = resolveIcon(m.icon)
                        return (
                            <div key={m.id}
                                className={`grid grid-cols-[40px_1fr_100px_80px_80px_100px] gap-3 px-4 py-3 items-center transition-all hover:bg-app-surface/50 ${idx < methods.length - 1 ? 'border-b border-app-border/30' : ''}`}>
                                {/* Sort grip */}
                                <div className="flex items-center justify-center">
                                    <GripVertical size={12} className="text-app-muted-foreground/60 opacity-30" />
                                </div>
                                {/* Name + color badge */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: `color-mix(in srgb, ${m.color || 'var(--app-primary)'} 12%, transparent)`, color: m.color || 'var(--app-primary)' }}>
                                        <Icon size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-app-foreground truncate">{m.name}</p>
                                        {m.is_system && (
                                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>SYSTEM</span>
                                        )}
                                    </div>
                                </div>
                                {/* Code */}
                                <span className="text-[11px] font-mono font-bold text-app-muted-foreground">{m.code}</span>
                                {/* Icon name */}
                                <span className="text-[10px] text-app-muted-foreground/60">{m.icon || '—'}</span>
                                {/* Status toggle */}
                                <button onClick={() => handleToggle(m)}
                                    className="flex items-center gap-1" title={m.is_active ? 'Active – click to deactivate' : 'Inactive – click to activate'}>
                                    {m.is_active
                                        ? <ToggleRight size={18} className="text-app-success" />
                                        : <ToggleLeft size={18} className="text-app-muted-foreground/60" />}
                                </button>
                                {/* Actions */}
                                <div className="flex items-center gap-1 justify-end">
                                    <button onClick={() => { setEditing({ ...m }); setIsNew(false) }}
                                        className="p-1.5 rounded-lg hover:bg-app-surface transition-colors" title="Edit">
                                        <Pencil size={12} className="text-app-muted-foreground" />
                                    </button>
                                    {!m.is_system && (
                                        <button onClick={() => handleDelete(m)}
                                            className="p-1.5 rounded-lg hover:bg-app-error/10 transition-colors" title="Delete">
                                            <Trash2 size={12} className="text-app-error" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ─── Edit/Create Modal ─── */}
            {editing && (
                <>
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 animate-in fade-in duration-200" onClick={() => { setEditing(null); setIsNew(false) }} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-app-surface border border-app-border/50 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200"
                        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border/50">
                            <h2>{isNew ? 'New Payment Method' : `Edit "${editing.name}"`}</h2>
                            <button onClick={() => { setEditing(null); setIsNew(false) }} className="p-1.5 rounded-lg hover:bg-app-surface transition-colors">
                                <X size={14} className="text-app-muted-foreground" />
                            </button>
                        </div>
                        {/* Form */}
                        <div className="px-5 py-4 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Name</label>
                                <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-surface border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary/50 transition-colors"
                                    placeholder="e.g. Cash, Orange Money, Wave..." />
                            </div>
                            {/* Code */}
                            <div>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Code</label>
                                <input type="text" value={editing.code}
                                    onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                                    className="w-full text-[12px] font-bold font-mono px-3 py-2.5 bg-app-surface border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary/50 transition-colors"
                                    placeholder="e.g. CASH, OM, WAVE..."
                                    disabled={editing.is_system} />
                                {editing.is_system && <p className="text-[8px] text-app-muted-foreground/60 mt-1 flex items-center gap-1"><Lock size={8} /> System codes cannot be changed</p>}
                            </div>
                            {/* Icon picker */}
                            <div>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Icon</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {ICON_OPTIONS.map(opt => (
                                        <button key={opt.value} onClick={() => setEditing({ ...editing, icon: opt.value })}
                                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${editing.icon === opt.value
                                                ? 'ring-2 ring-app-primary ring-offset-1 ring-offset-app-surface' : 'border border-app-border/50 hover:bg-app-surface'}`}
                                            style={editing.icon === opt.value ? { background: `color-mix(in srgb, ${editing.color || 'var(--app-primary)'} 12%, transparent)`, color: editing.color || 'var(--app-primary)' } : {}}
                                            title={opt.label}>
                                            <opt.Icon size={14} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Color picker */}
                            <div>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Color</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {COLOR_OPTIONS.map(c => (
                                        <button key={c} onClick={() => setEditing({ ...editing, color: c })}
                                            className={`w-7 h-7 rounded-lg transition-all ${editing.color === c ? 'ring-2 ring-offset-1 ring-offset-app-surface scale-110' : 'hover:scale-105'}`}
                                            style={{ background: c, ...(editing.color === c ? { ringColor: c } : {}) }} />
                                    ))}
                                </div>
                            </div>
                            {/* Preview */}
                            <div className="p-3 rounded-xl border border-app-border/50 flex items-center gap-2.5"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${editing.color || 'var(--app-primary)'} 12%, transparent)`, color: editing.color || 'var(--app-primary)' }}>
                                    {(() => { const I = resolveIcon(editing.icon); return <I size={14} /> })()}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-app-foreground">{editing.name || 'Method Name'}</p>
                                    <p className="text-[8px] font-mono text-app-muted-foreground/60">{editing.code || 'CODE'}</p>
                                </div>
                                <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-foreground) 5%, transparent)', color: 'var(--app-muted-foreground)' }}>Preview</span>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border/50">
                            <button onClick={() => { setEditing(null); setIsNew(false) }}
                                className="px-3.5 py-2 rounded-xl text-[11px] font-bold text-app-muted-foreground hover:bg-app-surface transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                style={{ background: 'var(--app-primary)' }}>
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {isNew ? 'Create' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
