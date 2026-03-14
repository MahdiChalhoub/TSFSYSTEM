'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import {
    Save, Shield, Monitor, Users, Key, CreditCard, Banknote, Smartphone,
    Truck, Wallet, Loader2, Hash, Check, Eye, EyeOff, Phone, Zap, X,
    TestTube, AlertTriangle,
} from 'lucide-react'

/* ── Shared Types ── */
export type Reg = {
    id: number; name: string; siteId: number; siteName: string;
    warehouseId?: number; cashAccountId?: number; cashAccountName?: string;
    accountBookId?: number; accountBookName?: string; allowedAccounts: any[];
    authorizedUsers: any[]; openingMode: string; paymentMethods: any[];
    registerRulesOverride: Record<string, any>; isOpen: boolean;
    isConfigComplete: boolean; missingCashAccount: boolean; missingAccountBook: boolean;
}
export type FA = { id: number; name: string; type: string; currency: string }
export type UD = { id: number; username: string; first_name: string; last_name: string; pos_pin?: boolean; has_override_pin?: boolean; role_name?: string }
export type Site = { id: number; name: string; code: string; registers: Reg[] }

/* ═══════════════════════════════════════════════════════════════
   REGISTER CONFIG PANEL — expands below the selected register row
   ═══════════════════════════════════════════════════════════════ */
export function RegisterConfigPanel({ reg, accounts, warehouses, users, onRefresh, onClose }: {
    reg: Reg; accounts: FA[]; warehouses: any[]; users: UD[];
    onRefresh: () => void; onClose: () => void;
}) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        name: reg.name, warehouseId: reg.warehouseId || 0, cashAccountId: reg.cashAccountId || 0,
        enableAccountBook: !!(reg.accountBookId), openingMode: reg.openingMode || 'standard',
        allowedAccountIds: reg.allowedAccounts.map((a: any) => a.id) as number[],
        authorizedUserIds: reg.authorizedUsers.map((u: any) => u.id) as number[],
        paymentMethods: reg.paymentMethods || [],
        rulesOverride: reg.registerRulesOverride || {},
    })
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const toggleId = (arr: number[], id: number) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]

    const handleSave = async () => {
        if (!form.cashAccountId) { toast.error('Cash Account is required'); return }
        setSaving(true)
        try {
            await erpFetch('pos-registers/update-register/', {
                method: 'POST', body: JSON.stringify({
                    id: reg.id, name: form.name, warehouse_id: form.warehouseId || null,
                    cash_account_id: form.cashAccountId || null,
                    account_book_id: form.enableAccountBook && form.cashAccountId ? form.cashAccountId : null,
                    opening_mode: form.openingMode.toUpperCase(),
                    allowed_account_ids: form.allowedAccountIds,
                    authorized_user_ids: form.authorizedUserIds,
                    payment_methods: form.paymentMethods,
                    register_rules_override: form.rulesOverride,
                })
            })
            toast.success('Register saved!')
            onRefresh()
        } catch (e: any) { toast.error(e?.message || 'Failed to save') }
        setSaving(false)
    }

    const ICONS: Record<string, any> = { CASH: Banknote, CARD: CreditCard, WALLET: Wallet, OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck }
    const OVERRIDE_RULES = [
        { key: 'requireCountOnClose', label: 'Require Cash Count on Close' },
        { key: 'lockRegisterOnClose', label: 'Lock Register on Close' },
        { key: 'printReceiptOnClose', label: 'Print Z-Report on Close' },
        { key: 'allowNegativeStock', label: 'Allow Negative Stock Sales' },
    ]

    return (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-5 space-y-5"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderTop: '2px solid var(--app-primary)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: reg.isOpen ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: reg.isOpen ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                        <Monitor size={14} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-app-text">{reg.name}</h3>
                        <p className="text-[10px] text-app-text-faint">{reg.siteName} · Register #{reg.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-text-muted hover:text-app-text transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Incomplete warning */}
            {!reg.isConfigComplete && (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] font-black" style={{ color: 'var(--app-error)' }}>Register is not operational</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'color-mix(in srgb, var(--app-error) 60%, transparent)' }}>
                            {reg.missingCashAccount && '⚠ No Cash Account. '}{reg.missingAccountBook && '⚠ No Account Book.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Config grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Core config */}
                <div className="space-y-3">
                    <p className="text-[10px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-2">
                        <Monitor size={10} style={{ color: 'var(--app-primary)' }} /> Register Info
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Name</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none focus:border-app-primary/50" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Opening Mode</label>
                            <select value={form.openingMode} onChange={e => set('openingMode', e.target.value)}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                <option value="standard">Standard</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Cash Account *</label>
                            <select value={form.cashAccountId} onChange={e => set('cashAccountId', +e.target.value)}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                <option value={0}>⚠ Select…</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Warehouse</label>
                            <select value={form.warehouseId} onChange={e => set('warehouseId', +e.target.value)}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                <option value={0}>-- none --</option>
                                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.parent ? `↳ ${w.name}` : w.name}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Account Book toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-app-border/30">
                        <div>
                            <p className="text-[11px] font-bold text-app-text">Account Book</p>
                            <p className="text-[9px] text-app-text-faint">{form.enableAccountBook ? 'Linked to cash account' : 'Disabled'}</p>
                        </div>
                        <button onClick={() => set('enableAccountBook', !form.enableAccountBook)}
                            className={`w-9 h-5 rounded-full relative transition-all shrink-0 ${form.enableAccountBook ? 'bg-app-primary' : 'bg-app-surface'}`}>
                            <span className={`w-3.5 h-3.5 rounded-full bg-white shadow absolute top-[3px] transition-all ${form.enableAccountBook ? 'left-[18px]' : 'left-[3px]'}`} />
                        </button>
                    </div>
                </div>

                {/* Right: Payment Methods + Rules */}
                <div className="space-y-3">
                    <p className="text-[10px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-2">
                        <Banknote size={10} style={{ color: 'var(--app-primary)' }} /> Payment Methods
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'DELIVERY', 'CREDIT', 'CHECK'].map(key => {
                            const active = form.paymentMethods.some((m: any) => m.key === key)
                            const Icon = ICONS[key] || CreditCard
                            return (
                                <button key={key} onClick={() => set('paymentMethods', active ? form.paymentMethods.filter((m: any) => m.key !== key) : [...form.paymentMethods, { key, label: key, accountId: null }])}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${active
                                        ? 'border-app-primary/20 text-app-primary'
                                        : 'border-app-border/50 text-app-text-muted hover:bg-app-surface'}`}
                                    style={active ? { background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)' } : {}}>
                                    <Icon size={11} /> {key}
                                </button>
                            )
                        })}
                    </div>

                    <p className="text-[10px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-2 pt-2">
                        <Shield size={10} className="text-amber-400" /> Rules Override
                    </p>
                    {OVERRIDE_RULES.map(rule => {
                        const val = form.rulesOverride[rule.key]
                        const isSet = val !== undefined
                        return (
                            <div key={rule.key} className="flex items-center justify-between py-1.5 border-b border-app-border/20 last:border-0">
                                <p className="text-[11px] font-bold text-app-text">{rule.label}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isSet && <button onClick={() => { const r = { ...form.rulesOverride }; delete r[rule.key]; set('rulesOverride', r) }}
                                        className="text-[8px] text-app-text-muted hover:text-red-400 transition-all">reset</button>}
                                    <button onClick={() => set('rulesOverride', { ...form.rulesOverride, [rule.key]: !val })}
                                        className={`w-8 h-4 rounded-full relative transition-all ${isSet ? (val ? 'bg-amber-500' : 'bg-app-surface') : 'bg-app-surface opacity-40'}`}>
                                        <span className={`w-3 h-3 rounded-full bg-white shadow absolute top-[2px] transition-all ${val && isSet ? 'left-[18px]' : 'left-[2px]'}`} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Bottom: Accounts + Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-app-border/30 pt-4">
                <div>
                    <p className="text-[10px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-2 mb-2">
                        <CreditCard size={10} className="text-emerald-400" /> Allowed Payment Accounts
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                        {accounts.map(a => {
                            const on = form.allowedAccountIds.includes(a.id)
                            return (
                                <button key={a.id} onClick={() => set('allowedAccountIds', toggleId(form.allowedAccountIds, a.id))}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all text-[11px] ${on
                                        ? 'border-emerald-500/20 text-emerald-400'
                                        : 'border-app-border/30 text-app-text-muted hover:bg-app-surface'}`}
                                    style={on ? { background: 'color-mix(in srgb, #10b981 5%, transparent)' } : {}}>
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-400' : 'border-app-border'}`}>
                                        {on && <Check size={8} className="text-white" />}
                                    </div>
                                    <span className="flex-1 truncate font-medium">{a.name}</span>
                                    <span className="text-[8px] opacity-50">{a.type}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div>
                    <p className="text-[10px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-2 mb-2">
                        <Users size={10} className="text-blue-400" /> Authorized Cashiers
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                        {users.map(u => {
                            const on = form.authorizedUserIds.includes(u.id)
                            const name = `${u.first_name} ${u.last_name}`.trim() || u.username
                            return (
                                <button key={u.id} onClick={() => set('authorizedUserIds', toggleId(form.authorizedUserIds, u.id))}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all text-[11px] ${on
                                        ? 'border-blue-500/20 text-blue-400'
                                        : 'border-app-border/30 text-app-text-muted hover:bg-app-surface'}`}
                                    style={on ? { background: 'color-mix(in srgb, #3b82f6 5%, transparent)' } : {}}>
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-blue-500 border-blue-400' : 'border-app-border'}`}>
                                        {on && <Check size={8} className="text-white" />}
                                    </div>
                                    <span className="flex-1 truncate font-medium">{name}</span>
                                    {!u.pos_pin && <span className="text-[8px] text-red-400/70 font-black">NO PIN</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════ */
export function GlobalSettingsPanel({ onClose }: { onClose: () => void }) {
    const [rules, setRules] = useState<Record<string, any>>({
        requirePinForLogin: true, allowCashierSwitch: true, autoLockIdleMinutes: 15,
        requireManagerForVoid: true, requireManagerForDiscount: false, requireManagerForPriceOverride: true,
        requireManagerForRefund: true, requireManagerForClearCart: false, requireManagerForDeleteItem: false,
        maxDiscountPercent: 20, lockRegisterOnClose: false, printReceiptOnClose: true,
        requireCountOnClose: true, allowNegativeStock: false, enableReconciliation: true,
        controlledAccountsAreTruth: true, autoCalibrateToClose: true, requireStatementOnClose: true,
        enableAccountBook: true, autoTransferExcessToReserve: false, autoDeductShortageFromCashier: false,
        restrict_unique_cash_account: true, pos_offline_enabled: true,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [section, setSection] = useState<'security' | 'delivery'>('security')

    useEffect(() => {
        Promise.all([
            erpFetch('pos/pos-settings/').catch(() => ({})),
            erpFetch('pos-registers/pos-settings/').catch(() => ({})),
        ]).then(([sec, reg]) => { setRules(r => ({ ...r, ...sec, ...reg })) }).finally(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await Promise.all([
                erpFetch('pos/pos-settings/', { method: 'PATCH', body: JSON.stringify(rules) }),
                erpFetch('pos-registers/pos-settings/', { method: 'PATCH', body: JSON.stringify({ restrict_unique_cash_account: rules.restrict_unique_cash_account }) }),
            ])
            toast.success('Settings saved!')
        } catch { toast.error('Failed to save') }
        setSaving(false)
    }

    const set = (k: string, v: any) => setRules(r => ({ ...r, [k]: v }))

    function TRow({ label, desc, k }: { label: string; desc: string; k: string }) {
        return (
            <div className="flex items-center justify-between py-2 border-b border-app-border/20 last:border-0">
                <div><p className="text-[11px] font-bold text-app-text">{label}</p><p className="text-[9px] text-app-text-faint">{desc}</p></div>
                <button onClick={() => set(k, !rules[k])} className={`w-9 h-5 rounded-full relative transition-all ml-3 shrink-0 ${rules[k] ? 'bg-app-primary' : 'bg-app-surface'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full bg-white shadow absolute top-[3px] transition-all ${rules[k] ? 'left-[18px]' : 'left-[3px]'}`} />
                </button>
            </div>
        )
    }
    function NRow({ label, k, suffix }: { label: string; k: string; suffix: string }) {
        return (
            <div className="flex items-center justify-between py-2 border-b border-app-border/20 last:border-0">
                <p className="text-[11px] font-bold text-app-text">{label}</p>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                    <input type="number" value={rules[k] || 0} onChange={e => set(k, +e.target.value)}
                        className="w-14 px-2 py-1 bg-app-bg border border-app-border rounded-lg text-app-text text-[11px] font-bold text-center outline-none" />
                    <span className="text-[9px] text-app-text-muted font-bold">{suffix}</span>
                </div>
            </div>
        )
    }

    /* Delivery sub-section */
    const [ds, setDs] = useState<Record<string, any>>({ delivery_code_mode: 'auto', delivery_code_digits: 6, delivery_code_expiry_hours: 72, sms_provider: 'none' })
    const [dLoading, setDLoading] = useState(true)
    useEffect(() => { erpFetch('pos/pos-settings/').then((d: any) => { if (d) setDs(x => ({ ...x, ...d })) }).catch(() => { }).finally(() => setDLoading(false)) }, [])

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-app-text-muted" /></div>

    const SECTIONS = [
        { id: 'security' as const, label: 'Security', icon: Shield, color: '#f59e0b' },
        { id: 'delivery' as const, label: 'Delivery', icon: Truck, color: '#ef4444' },
    ]

    const RULE_GROUPS = [
        {
            title: 'Connectivity', color: '#06b6d4', icon: Zap, rows: [
                <TRow key="offline" label="POS Offline Mode" desc="Queue orders offline and sync later" k="pos_offline_enabled" />,
            ]
        },
        {
            title: 'Authentication', color: 'var(--app-primary)', icon: Key, rows: [
                <TRow key="a" label="Require PIN" desc="PIN to access POS" k="requirePinForLogin" />,
                <TRow key="b" label="Cashier Switching" desc="Switch without closing" k="allowCashierSwitch" />,
                <NRow key="c" label="Auto-Lock Idle" k="autoLockIdleMinutes" suffix="min" />,
            ]
        },
        {
            title: 'Manager Overrides', color: '#ef4444', icon: Shield, rows: [
                <TRow key="a" label="Void Order" desc="Manager PIN to void" k="requireManagerForVoid" />,
                <TRow key="b" label="Discount" desc="Manager PIN for discounts" k="requireManagerForDiscount" />,
                <TRow key="c" label="Price Override" desc="Manager PIN to change price" k="requireManagerForPriceOverride" />,
                <TRow key="d" label="Refund" desc="Manager PIN for refunds" k="requireManagerForRefund" />,
                <NRow key="g" label="Max Discount" k="maxDiscountPercent" suffix="%" />,
            ]
        },
        {
            title: 'Register Close', color: '#f59e0b', icon: Monitor, rows: [
                <TRow key="a" label="Lock on Close" desc="Prevent access after closing" k="lockRegisterOnClose" />,
                <TRow key="b" label="Z-Report" desc="Auto-print on close" k="printReceiptOnClose" />,
                <TRow key="c" label="Cash Count" desc="Count cash on close" k="requireCountOnClose" />,
            ]
        },
        {
            title: 'Reconciliation', color: '#3b82f6', icon: Zap, rows: [
                <TRow key="a" label="Enable" desc="Full reconciliation on close" k="enableReconciliation" />,
                <TRow key="b" label="Controlled = Truth" desc="Wave/OM/Bank are always correct" k="controlledAccountsAreTruth" />,
                <TRow key="c" label="Auto-Calibrate" desc="Mismatch adjusts cash" k="autoCalibrateToClose" />,
                <TRow key="d" label="Account Book" desc="Livre de Caisse" k="enableAccountBook" />,
                <TRow key="e" label="Unique Cash" desc="Isolated cash per register" k="restrict_unique_cash_account" />,
            ]
        },
    ]

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-app-bg border-l border-app-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-app-primary flex items-center justify-center">
                        <Shield size={14} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-app-text">Global Settings</h2>
                        <p className="text-[9px] text-app-text-faint">Applies to all registers</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50">
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-text-muted"><X size={14} /></button>
                </div>
            </div>

            {/* Section tabs */}
            <div className="flex gap-1 px-5 pt-3 pb-2">
                {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setSection(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${section === s.id
                            ? 'bg-app-surface border border-app-border text-app-text'
                            : 'text-app-text-muted hover:text-app-text'}`}>
                        <s.icon size={12} style={section === s.id ? { color: s.color } : { opacity: 0.5 }} /> {s.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3 custom-scrollbar">
                {section === 'security' && RULE_GROUPS.map(g => (
                    <div key={g.title} className="p-3 bg-app-surface/30 border border-app-border/50 rounded-xl">
                        <p className="text-[9px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-1.5 mb-1">
                            <g.icon size={9} style={{ color: g.color }} /> {g.title}
                        </p>
                        {g.rows}
                    </div>
                ))}
                {section === 'delivery' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-app-surface/30 border border-app-border/50 rounded-xl">
                            <p className="text-[9px] text-app-text-muted uppercase tracking-widest font-black flex items-center gap-1.5 mb-2">
                                <Hash size={9} style={{ color: 'var(--app-primary)' }} /> Delivery Codes
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[8px] font-black text-app-text-faint uppercase mb-1 block">Mode</label>
                                    <select value={ds.delivery_code_mode} onChange={e => setDs(x => ({ ...x, delivery_code_mode: e.target.value }))}
                                        className="w-full text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-text outline-none">
                                        <option value="auto">Auto</option><option value="manual">Manual</option><option value="disabled">Off</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-app-text-faint uppercase mb-1 block">Digits</label>
                                    <input type="number" min={4} max={8} value={ds.delivery_code_digits}
                                        onChange={e => setDs(x => ({ ...x, delivery_code_digits: +e.target.value }))}
                                        className="w-full text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-text outline-none text-center" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-app-text-faint uppercase mb-1 block">Expiry (h)</label>
                                    <input type="number" value={ds.delivery_code_expiry_hours}
                                        onChange={e => setDs(x => ({ ...x, delivery_code_expiry_hours: +e.target.value }))}
                                        className="w-full text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-text outline-none text-center" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   USERS & PINs PANEL — slide-in from right
   ═══════════════════════════════════════════════════════════════ */
export function UsersPinsPanel({ users, onRefresh, onClose }: { users: UD[]; onRefresh: () => void; onClose: () => void }) {
    const [pinFor, setPinFor] = useState<number | null>(null)
    const [pinVal, setPinVal] = useState('')
    const [overrideFor, setOverrideFor] = useState<number | null>(null)
    const [overrideVal, setOverrideVal] = useState('')
    const [saving, setSaving] = useState(false)
    const [show, setShow] = useState(false)
    const [filter, setFilter] = useState('')

    const setPin = async (uid: number) => {
        if (!pinVal || pinVal.length < 4) { toast.error('PIN must be 4+ digits'); return }
        setSaving(true)
        try { await erpFetch('pos-registers/set-pin/', { method: 'POST', body: JSON.stringify({ user_id: uid, pin: pinVal }) }); toast.success('PIN set!'); setPinFor(null); setPinVal(''); onRefresh() } catch (e: any) { toast.error(e?.message || 'Failed') }
        setSaving(false)
    }
    const setOverride = async (uid: number) => {
        if (!overrideVal || overrideVal.length < 4) { toast.error('Override PIN must be 4+ digits'); return }
        setSaving(true)
        try { await erpFetch('pos-registers/set-override-pin/', { method: 'POST', body: JSON.stringify({ user_id: uid, pin: overrideVal }) }); toast.success('Override PIN set!'); setOverrideFor(null); setOverrideVal(''); onRefresh() } catch (e: any) { toast.error(e?.message || 'Failed') }
        setSaving(false)
    }

    const filtered = users.filter(u => { const q = filter.toLowerCase(); return !q || u.username?.toLowerCase().includes(q) || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q) })

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-app-bg border-l border-app-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #3b82f6 12%, transparent)', color: '#3b82f6' }}>
                        <Key size={14} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-app-text">Users & PINs</h2>
                        <p className="text-[9px] text-app-text-faint">{users.length} users</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-text-muted"><X size={14} /></button>
            </div>
            <div className="px-5 py-3">
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search users…"
                    className="w-full text-[12px] pl-3 pr-3 py-2 bg-app-surface/50 border border-app-border/50 rounded-xl text-app-text placeholder:text-app-text-faint outline-none" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 custom-scrollbar">
                {filtered.map(u => {
                    const name = `${u.first_name} ${u.last_name}`.trim() || u.username
                    return (
                        <div key={u.id} className="p-3 bg-app-surface/30 border border-app-border/50 rounded-xl">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                                    style={{ background: 'color-mix(in srgb, #3b82f6 10%, transparent)', color: '#3b82f6' }}>
                                    {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-app-text truncate">{name}</p>
                                    <p className="text-[9px] text-app-text-faint">{u.role_name || 'Staff'}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${u.pos_pin ? 'text-emerald-400' : 'text-red-400'}`}
                                        style={{ background: u.pos_pin ? 'color-mix(in srgb, #10b981 10%, transparent)' : 'color-mix(in srgb, #ef4444 10%, transparent)' }}>
                                        {u.pos_pin ? '● PIN' : '○ No PIN'}
                                    </span>
                                    <button onClick={() => { setPinFor(pinFor === u.id ? null : u.id); setPinVal('') }}
                                        className="p-1 rounded-lg hover:bg-blue-500/10 text-blue-400/40 hover:text-blue-400 transition-all"><Key size={11} /></button>
                                    <button onClick={() => { setOverrideFor(overrideFor === u.id ? null : u.id); setOverrideVal('') }}
                                        className="p-1 rounded-lg hover:bg-amber-500/10 text-amber-400/40 hover:text-amber-400 transition-all"><Shield size={11} /></button>
                                </div>
                            </div>
                            {pinFor === u.id && (
                                <div className="mt-2 flex items-center gap-1.5">
                                    <input type={show ? 'text' : 'password'} placeholder="PIN (4-6)" value={pinVal}
                                        onChange={e => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="flex-1 text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-text outline-none" />
                                    <button onClick={() => setShow(v => !v)} className="p-1 text-app-text-muted">{show ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                                    <button onClick={() => setPin(u.id)} disabled={saving}
                                        className="text-[9px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg disabled:opacity-50">Set</button>
                                </div>
                            )}
                            {overrideFor === u.id && (
                                <div className="mt-2 flex items-center gap-1.5">
                                    <input type="password" placeholder="Override PIN" value={overrideVal}
                                        onChange={e => setOverrideVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="flex-1 text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-text outline-none" />
                                    <button onClick={() => setOverride(u.id)} disabled={saving}
                                        className="text-[9px] font-bold px-2 py-1.5 rounded-lg disabled:opacity-50"
                                        style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)', color: '#f59e0b' }}>Set</button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
