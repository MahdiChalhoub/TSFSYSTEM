'use client'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import {
    Save, Shield, Monitor, Users, Key, CreditCard, Banknote, Smartphone,
    Truck, Wallet, Loader2, Hash, Check, Eye, EyeOff, Phone, Zap, X,
    TestTube, AlertTriangle, Settings2, ChevronRight, Lock, ArrowLeft,
} from 'lucide-react'

/* ── Shared Types ── */
export type RegisterMethod = {
    id?: number; methodId: number; code: string; name: string;
    icon: string; color: string; accountId: number | null;
    accountName: string | null; isActive: boolean; sortOrder: number;
}
export type Reg = {
    id: number; name: string; siteId: number; siteName: string;
    warehouseId?: number; cashAccountId?: number; cashAccountName?: string;
    accountBookId?: number; accountBookName?: string; allowedAccounts: any[];
    authorizedUsers: any[]; openingMode: string; paymentMethods: any[];
    registerMethods?: RegisterMethod[];
    registerRulesOverride: Record<string, any>; isOpen: boolean;
    isConfigComplete: boolean; missingCashAccount: boolean; missingAccountBook: boolean;
}
export type GlobalPaymentMethod = {
    id: number; name: string; code: string; icon: string; color: string;
    is_system: boolean; is_active: boolean; sort_order: number;
}
export type FA = { id: number; name: string; type: string; currency: string }
export type UD = { id: number; username: string; first_name: string; last_name: string; pos_pin?: boolean; has_override_pin?: boolean; role_name?: string }
export type Site = { id: number; name: string; code: string; registers: Reg[] }

/* ── Reusable toggle ── */
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
    return (
        <button onClick={onChange} disabled={disabled}
            className={`w-9 h-5 rounded-full relative transition-all shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${on ? 'bg-app-primary' : 'bg-app-surface border border-app-border/50'}`}>
            <span className={`w-3.5 h-3.5 rounded-full bg-app-surface shadow absolute top-[3px] transition-all ${on ? 'left-[18px]' : 'left-[3px]'}`} />
        </button>
    )
}

/* ── Section header ── */
function SectionLabel({ icon: Icon, label, color, count }: { icon: any; label: string; color: string; count?: number }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                <Icon size={12} style={{ color }} />
            </div>
            <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">{label}</span>
            {count !== undefined && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>{count}</span>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   REGISTER CONFIG PANEL — Premium slide-over drawer with tabs
   ═══════════════════════════════════════════════════════════════ */
export function RegisterConfigPanel({ reg, accounts, warehouses, users, onRefresh, onClose, onOpenUsers, onOpenSettings }: {
    reg: Reg; accounts: FA[]; warehouses: any[]; users: UD[];
    onRefresh: () => void; onClose: () => void;
    onOpenUsers?: (regId: number) => void; onOpenSettings?: (regId: number) => void;
}) {
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState<'general' | 'payments' | 'access' | 'rules'>('general')
    const [form, setForm] = useState({
        name: reg.name, warehouseId: reg.warehouseId || 0, cashAccountId: reg.cashAccountId || 0,
        enableAccountBook: !!(reg.accountBookId), openingMode: reg.openingMode || 'standard',
        allowedAccountIds: reg.allowedAccounts.map((a: any) => a.id) as number[],
        authorizedUserIds: reg.authorizedUsers.map((u: any) => u.id) as number[],
        paymentMethods: reg.paymentMethods || [],
        registerMethods: (reg.registerMethods || []) as RegisterMethod[],
        rulesOverride: reg.registerRulesOverride || {},
    })
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const toggleId = (arr: number[], id: number) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]

    /* ── Fetch global payment methods for dynamic payments tab ── */
    const [globalMethods, setGlobalMethods] = useState<GlobalPaymentMethod[]>([])
    const [methodsLoading, setMethodsLoading] = useState(false)
    useEffect(() => {
        if (tab === 'payments' && globalMethods.length === 0) {
            setMethodsLoading(true)
            erpFetch('finance/payment-methods/')
                .then((data: any) => {
                    const methods = Array.isArray(data) ? data : data?.results || []
                    setGlobalMethods(methods)
                })
                .catch(() => toast.error('Failed to load payment methods'))
                .finally(() => setMethodsLoading(false))
        }
    }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (form.cashAccountId && !form.paymentMethods.some((m: any) => m.key === 'CASH')) {
            setForm(f => ({ ...f, paymentMethods: [...f.paymentMethods, { key: 'CASH', label: 'CASH', accountId: f.cashAccountId }] }))
        }
    }, [form.cashAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

    const filteredWarehouses = useMemo(() => {
        if (!reg.siteId) return warehouses
        return warehouses.filter((w: any) => w.parent === reg.siteId || w.parent_id === reg.siteId)
    }, [warehouses, reg.siteId])

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
                    allowed_account_ids: [...new Set([...(form.cashAccountId ? [form.cashAccountId] : []), ...form.allowedAccountIds])],
                    authorized_user_ids: form.authorizedUserIds,
                    payment_methods: form.paymentMethods,
                    register_methods: form.registerMethods.map((rm, idx) => ({
                        methodId: rm.methodId,
                        accountId: rm.accountId || null,
                        isActive: rm.isActive,
                        sortOrder: idx,
                    })),
                    register_rules_override: form.rulesOverride,
                })
            })
            toast.success('Register saved!')
            onRefresh()
        } catch (e: any) { toast.error(e?.message || 'Failed to save') }
        setSaving(false)
    }

    const ICON_MAP: Record<string, any> = {
        banknote: Banknote, 'credit-card': CreditCard, wallet: Wallet,
        smartphone: Smartphone, truck: Truck, phone: Phone, zap: Zap,
        hash: Hash, shield: Shield, key: Key,
    }
    const FALLBACK_CODE_ICONS: Record<string, any> = {
        CASH: Banknote, CARD: CreditCard, WALLET: Wallet,
        OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck,
        CREDIT: CreditCard, CHECK: Hash,
    }
    const resolveIcon = (method: GlobalPaymentMethod) => {
        if (method.icon && ICON_MAP[method.icon]) return ICON_MAP[method.icon]
        return FALLBACK_CODE_ICONS[method.code] || CreditCard
    }
    const OVERRIDE_RULES = [
        { key: 'requireCountOnClose', label: 'Require Cash Count on Close', desc: 'Count cash before closing shift' },
        { key: 'lockRegisterOnClose', label: 'Lock Register on Close', desc: 'Prevent access after closing' },
        { key: 'printReceiptOnClose', label: 'Print Z-Report on Close', desc: 'Auto-print summary report' },
        { key: 'allowNegativeStock', label: 'Allow Negative Stock', desc: 'Sell even when stock is zero' },
    ]
    const TABS = [
        { id: 'general' as const, label: 'General', icon: Settings2, color: 'var(--app-primary)' },
        { id: 'payments' as const, label: 'Payments', icon: Banknote, color: 'var(--app-primary)' },
        { id: 'access' as const, label: 'Access', icon: Users, color: 'var(--app-info)' },
        { id: 'rules' as const, label: 'Rules', icon: Shield, color: 'var(--app-warning)' },
    ]

    return (
        <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full sm:w-[780px] bg-app-bg border-l border-app-border/50 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-250"
                style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>

                {/* ═══ HEADER ═══ */}
                <div className="flex-shrink-0 px-5 pt-4 pb-0 border-b border-app-border/40"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-bg))' }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{
                                    background: reg.isOpen
                                        ? 'linear-gradient(135deg, color-mix(in srgb, var(--app-success) 15%, transparent), color-mix(in srgb, var(--app-success) 5%, transparent))'
                                        : 'linear-gradient(135deg, color-mix(in srgb, var(--app-border) 30%, transparent), color-mix(in srgb, var(--app-border) 10%, transparent))',
                                    color: reg.isOpen ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                    border: `1px solid ${reg.isOpen ? 'color-mix(in srgb, var(--app-success) 20%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                }}>
                                <Monitor size={18} />
                            </div>
                            <div>
                                <h2>{reg.name}</h2>
                                <p className="text-[10px] text-app-muted-foreground">{reg.siteName} · #{reg.id}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black px-2 py-1 rounded-lg"
                                style={reg.isConfigComplete
                                    ? { color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 8%, transparent)' }
                                    : { color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}>
                                {reg.isConfigComplete ? '● READY' : '● SETUP NEEDED'}
                            </span>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-app-surface rounded-xl text-app-muted-foreground transition-colors"><X size={16} /></button>
                        </div>
                    </div>
                    <div className="flex gap-0.5 -mb-[1px]">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[10px] font-bold transition-all border-b-2 ${tab === t.id
                                    ? 'text-app-foreground border-current'
                                    : 'text-app-muted-foreground border-transparent hover:text-app-foreground'}`}
                                style={tab === t.id ? { borderColor: t.color, color: t.color } : {}}>
                                <t.icon size={12} /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ═══ CONTENT ═══ */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar">
                    {/* ── GENERAL ── */}
                    {tab === 'general' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            {!reg.isConfigComplete && (
                                <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                                    <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] font-black" style={{ color: 'var(--app-error)' }}>Register not operational</p>
                                        <p className="text-[10px] mt-0.5 text-app-muted-foreground">{reg.missingCashAccount && '⚠ Missing Cash Account. '}{reg.missingAccountBook && '⚠ Missing Account Book.'}</p>
                                    </div>
                                </div>
                            )}
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Monitor} label="Register Info" color="var(--app-primary)" />
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Name</label>
                                        <input value={form.name} onChange={e => set('name', e.target.value)}
                                            className="w-full text-[13px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary/40 transition-colors" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Cash Account *</label>
                                            <select value={form.cashAccountId} onChange={e => set('cashAccountId', +e.target.value)}
                                                className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                                                <option value={0}>⚠ Select…</option>
                                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Opening Mode</label>
                                            <select value={form.openingMode} onChange={e => set('openingMode', e.target.value)}
                                                className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                                                <option value="standard">Standard</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Warehouse</label>
                                        <select value={form.warehouseId} onChange={e => set('warehouseId', +e.target.value)}
                                            className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                                            <option value={0}>-- none --</option>
                                            {filteredWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.location_type || 'WH'})</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between py-2.5 border-t border-app-border/20">
                                        <div><p className="text-[11px] font-bold text-app-foreground">Account Book</p><p className="text-[9px] text-app-muted-foreground">{form.enableAccountBook ? 'Linked to cash account' : 'Disabled'}</p></div>
                                        <Toggle on={form.enableAccountBook} onChange={() => set('enableAccountBook', !form.enableAccountBook)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PAYMENTS ── */}
                    {tab === 'payments' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Banknote} label="Methods" color="var(--app-primary)" count={form.registerMethods.length} />
                                {methodsLoading ? (
                                    <div className="flex items-center gap-2 py-4 text-app-muted-foreground">
                                        <Loader2 size={14} className="animate-spin" /> <span className="text-[11px]">Loading methods…</span>
                                    </div>
                                ) : globalMethods.length === 0 ? (
                                    <p className="text-[10px] text-app-muted-foreground italic py-4">No payment methods configured. <a href="/finance/settings/payment-methods" className="text-app-primary underline">Create some →</a></p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {globalMethods.filter(gm => gm.is_active).map(gm => {
                                            const linked = form.registerMethods.find(rm => rm.methodId === gm.id)
                                            const isActive = !!linked
                                            const Icon = resolveIcon(gm)
                                            const methodColor = gm.color || '#10b981'
                                            return (
                                                <div key={gm.id}
                                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${isActive
                                                        ? 'border-app-success/20' : 'border-app-border/30 hover:bg-app-surface/50'}`}
                                                    style={isActive ? { background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)' } : {}}>
                                                    {/* Toggle */}
                                                    <button
                                                        onClick={() => {
                                                            if (isActive) {
                                                                set('registerMethods', form.registerMethods.filter(rm => rm.methodId !== gm.id))
                                                            } else {
                                                                set('registerMethods', [...form.registerMethods, {
                                                                    methodId: gm.id, code: gm.code, name: gm.name,
                                                                    icon: gm.icon, color: gm.color,
                                                                    accountId: null, accountName: null,
                                                                    isActive: true, sortOrder: form.registerMethods.length,
                                                                }])
                                                            }
                                                        }}
                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-app-success border-app-success' : 'border-app-border hover:border-app-success/50'}`}>
                                                        {isActive && <Check size={10} className="text-white" />}
                                                    </button>
                                                    {/* Icon */}
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? '' : 'opacity-40'}`}
                                                        style={isActive
                                                            ? { background: `color-mix(in srgb, ${methodColor} 12%, transparent)`, color: methodColor }
                                                            : { background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                        <Icon size={13} />
                                                    </div>
                                                    {/* Name */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[11px] font-bold truncate ${isActive ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>{gm.name}</p>
                                                        <p className="text-[8px] text-app-muted-foreground uppercase tracking-widest">{gm.code}</p>
                                                    </div>
                                                    {/* Account Dropdown (only when active) */}
                                                    {isActive && (
                                                        <select
                                                            value={linked?.accountId || 0}
                                                            onChange={e => {
                                                                const accId = +e.target.value
                                                                const acc = accounts.find(a => a.id === accId)
                                                                set('registerMethods', form.registerMethods.map(rm =>
                                                                    rm.methodId === gm.id ? { ...rm, accountId: accId || null, accountName: acc?.name || null } : rm
                                                                ))
                                                            }}
                                                            className="text-[10px] font-bold px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none max-w-[160px]"
                                                            title="Link financial account">
                                                            <option value={0}>— no account —</option>
                                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={CreditCard} label="Allowed Accounts" color="var(--app-primary)" count={form.allowedAccountIds.length + (form.cashAccountId ? 1 : 0)} />
                                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                                    {accounts.length === 0 && <p className="text-[10px] text-app-muted-foreground italic py-2">No financial accounts found</p>}
                                    {accounts.map(a => {
                                        const isCash = a.id === form.cashAccountId; const on = isCash || form.allowedAccountIds.includes(a.id)
                                        return (
                                            <button key={a.id} onClick={() => { if (isCash) return; set('allowedAccountIds', toggleId(form.allowedAccountIds, a.id)) }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all text-[11px] ${isCash ? 'border-app-success/25 text-emerald-400 cursor-default' : on ? 'border-app-success/15 text-emerald-400' : 'border-app-border/30 text-app-muted-foreground hover:bg-app-surface'}`}
                                                style={on ? { background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)' } : {}}>
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? 'bg-app-success border-app-success' : 'border-app-border'}`}>{on && <Check size={10} className="text-white" />}</div>
                                                <span className="flex-1 truncate font-medium">{a.name}</span>
                                                {isCash && <span className="font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>PRIMARY</span>}
                                                <span className="text-[9px] opacity-40">{a.type}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ACCESS (enhanced with inline PIN management + quick links) ── */}
                    {tab === 'access' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Users} label="Authorized Cashiers" color="var(--app-info)" count={form.authorizedUserIds.length} />
                                <p className="text-[9px] text-app-muted-foreground -mt-2 mb-3">Toggle access and manage PINs per register. Users without a PIN cannot log in.</p>
                                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    {users.map(u => {
                                        const on = form.authorizedUserIds.includes(u.id)
                                        const name = `${u.first_name} ${u.last_name}`.trim() || u.username
                                        return (
                                            <div key={u.id}
                                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all text-[11px] ${on ? 'border-app-info/20' : 'border-app-border/30 hover:bg-app-surface/30'}`}
                                                style={on ? { background: 'color-mix(in srgb, var(--app-info) 5%, transparent)' } : {}}>
                                                {/* Toggle authorize */}
                                                <button onClick={() => set('authorizedUserIds', toggleId(form.authorizedUserIds, u.id))}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${on ? 'bg-app-info border-app-info' : 'border-app-border hover:border-app-info/50'}`}>
                                                    {on && <Check size={10} className="text-white" />}
                                                </button>
                                                {/* Avatar */}
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                                                    style={on ? { background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' } : { background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                                                    {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                                                </div>
                                                {/* Name + role */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium truncate ${on ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>{name}</p>
                                                    <p className="text-[9px] opacity-50">{u.role_name || 'Staff'}</p>
                                                </div>
                                                {/* PIN status + actions */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${u.pos_pin ? 'text-emerald-400' : 'text-red-400'}`}
                                                        style={{ background: u.pos_pin ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)' }}>
                                                        {u.pos_pin ? '● PIN' : '○ NO PIN'}
                                                    </span>
                                                    {on && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                const pin = prompt(`${u.pos_pin ? 'Reset' : 'Set'} PIN for ${name}\n\nEnter new 4-6 digit PIN:`)
                                                                if (!pin || pin.length < 4) { if (pin !== null) toast.error('PIN must be 4-6 digits'); return }
                                                                erpFetch('pos-registers/admin-reset-pin/', {
                                                                    method: 'POST',
                                                                    body: JSON.stringify({ admin_password: prompt('Enter YOUR password to confirm:'), target_user_id: u.id, new_pin: pin })
                                                                }).then(() => { toast.success(`PIN ${u.pos_pin ? 'reset' : 'set'} for ${name}`); onRefresh() })
                                                                    .catch((err: any) => toast.error(err?.message || 'Failed'))
                                                            }}
                                                            className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-1 rounded-lg transition-all"
                                                            style={u.pos_pin
                                                                ? { background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }
                                                                : { background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }
                                                            }
                                                            title={u.pos_pin ? `Reset ${name}'s PIN` : `Set PIN for ${name}`}>
                                                            <Key size={9} /> {u.pos_pin ? 'Reset' : 'Set PIN'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Quick Links — easy access to related features */}
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Zap} label="Quick Links" color="var(--app-primary)" />
                                <p className="text-[9px] text-app-muted-foreground -mt-2 mb-3">Jump to related settings and features</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Users & PINs', desc: 'Global PIN manager', icon: Key, color: 'var(--app-info)', href: '__users_pins__' },
                                        { label: 'Global Rules', desc: 'POS-wide defaults', icon: Shield, color: 'var(--app-warning)', href: '__global_rules__' },
                                        { label: 'Access Users', desc: 'Identity management', icon: Users, color: 'var(--app-primary)', href: '/access/users' },
                                        { label: 'Payment Methods', desc: 'Configure accounts', icon: CreditCard, color: 'var(--app-primary)', href: '/finance/settings/payment-methods' },
                                    ].map(link => (
                                        <button key={link.label}
                                            onClick={() => {
                                                if (link.href === '__users_pins__') {
                                                    onOpenUsers?.(reg.id)
                                                }
                                                else if (link.href === '__global_rules__') {
                                                    onOpenSettings?.(reg.id)
                                                }
                                                else window.location.href = link.href
                                            }}
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-app-border/30 text-left transition-all hover:bg-app-surface hover:border-app-border/60">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ background: `color-mix(in srgb, ${link.color} 12%, transparent)`, color: link.color }}>
                                                <link.icon size={13} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-app-foreground truncate">{link.label}</p>
                                                <p className="text-[8px] text-app-muted-foreground">{link.desc}</p>
                                            </div>
                                            <ChevronRight size={11} className="text-app-muted-foreground shrink-0 ml-auto" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── RULES ── */}
                    {tab === 'rules' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Shield} label="Rules Override" color="var(--app-warning)" />
                                <p className="text-[10px] text-app-muted-foreground mb-3 -mt-1">Override global rules for this register. Unset rules inherit from Global Settings.</p>
                                <div className="space-y-0.5">
                                    {OVERRIDE_RULES.map(rule => {
                                        const val = form.rulesOverride[rule.key]; const isSet = val !== undefined
                                        return (
                                            <div key={rule.key} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-app-surface/50 transition-colors border-b border-app-border/10 last:border-0">
                                                <div className="flex-1 mr-3"><p className="text-[11px] font-bold text-app-foreground">{rule.label}</p><p className="text-[9px] text-app-muted-foreground">{rule.desc}</p></div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isSet && <button onClick={() => { const r = { ...form.rulesOverride }; delete r[rule.key]; set('rulesOverride', r) }}
                                                        className="text-[8px] text-app-muted-foreground hover:text-red-400 font-bold px-1.5 py-0.5 rounded hover:bg-red-400/10 transition-all">reset</button>}
                                                    <button onClick={() => set('rulesOverride', { ...form.rulesOverride, [rule.key]: !val })}
                                                        className={`w-9 h-5 rounded-full relative transition-all ${isSet ? (val ? 'bg-app-warning' : 'bg-app-surface border border-app-border/50') : 'bg-app-surface border border-app-border/50 opacity-30'}`}>
                                                        <span className={`w-3.5 h-3.5 rounded-full bg-app-surface shadow absolute top-[3px] transition-all ${val && isSet ? 'left-[18px]' : 'left-[3px]'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════ */
export function GlobalSettingsPanel({ onClose, onReturn }: { onClose: () => void; onReturn?: () => void }) {
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
        erpFetch('pos-settings/').catch(() => ({}))
        .then((sec) => { setRules(r => ({ ...r, ...sec })) }).finally(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await erpFetch('pos-settings/', { method: 'PATCH', body: JSON.stringify(rules) })
            toast.success('Settings saved!')
        } catch { toast.error('Failed to save') }
        setSaving(false)
    }

    const set = (k: string, v: any) => setRules(r => ({ ...r, [k]: v }))

    function TRow({ label, desc, k }: { label: string; desc: string; k: string }) {
        return (
            <div className="flex items-center justify-between py-2 border-b border-app-border/20 last:border-0">
                <div><p className="text-[11px] font-bold text-app-foreground">{label}</p><p className="text-[9px] text-app-muted-foreground">{desc}</p></div>
                <button onClick={() => set(k, !rules[k])} className={`w-9 h-5 rounded-full relative transition-all ml-3 shrink-0 ${rules[k] ? 'bg-app-primary' : 'bg-app-surface'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full bg-app-surface shadow absolute top-[3px] transition-all ${rules[k] ? 'left-[18px]' : 'left-[3px]'}`} />
                </button>
            </div>
        )
    }
    function NRow({ label, k, suffix }: { label: string; k: string; suffix: string }) {
        return (
            <div className="flex items-center justify-between py-2 border-b border-app-border/20 last:border-0">
                <p className="text-[11px] font-bold text-app-foreground">{label}</p>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                    <input type="number" value={rules[k] || 0} onChange={e => set(k, +e.target.value)}
                        className="w-14 px-2 py-1 bg-app-bg border border-app-border rounded-lg text-app-foreground text-[11px] font-bold text-center outline-none" />
                    <span className="text-[9px] text-app-muted-foreground font-bold">{suffix}</span>
                </div>
            </div>
        )
    }

    /* Delivery sub-section */
    const [ds, setDs] = useState<Record<string, any>>({ delivery_code_mode: 'auto', delivery_code_digits: 6, delivery_code_expiry_hours: 72, sms_provider: 'none' })
    const [dLoading, setDLoading] = useState(true)
    useEffect(() => { erpFetch('pos-settings/').then((d: any) => { if (d) setDs(x => ({ ...x, ...d })) }).catch(() => { }).finally(() => setDLoading(false)) }, [])

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-app-muted-foreground" /></div>

    const SECTIONS = [
        { id: 'security' as const, label: 'Security', icon: Shield, color: 'var(--app-warning)' },
        { id: 'delivery' as const, label: 'Delivery', icon: Truck, color: 'var(--app-error)' },
    ]

    const RULE_GROUPS = [
        {
            title: 'Connectivity', color: 'var(--app-accent-cyan)', icon: Zap, rows: [
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
            title: 'Manager Overrides', color: 'var(--app-error)', icon: Shield, rows: [
                <TRow key="a" label="Void Order" desc="Manager PIN to void" k="requireManagerForVoid" />,
                <TRow key="b" label="Discount" desc="Manager PIN for discounts" k="requireManagerForDiscount" />,
                <TRow key="c" label="Price Override" desc="Manager PIN to change price" k="requireManagerForPriceOverride" />,
                <TRow key="d" label="Refund" desc="Manager PIN for refunds" k="requireManagerForRefund" />,
                <NRow key="g" label="Max Discount" k="maxDiscountPercent" suffix="%" />,
            ]
        },
        {
            title: 'Register Close', color: 'var(--app-warning)', icon: Monitor, rows: [
                <TRow key="a" label="Lock on Close" desc="Prevent access after closing" k="lockRegisterOnClose" />,
                <TRow key="b" label="Z-Report" desc="Auto-print on close" k="printReceiptOnClose" />,
                <TRow key="c" label="Cash Count" desc="Count cash on close" k="requireCountOnClose" />,
            ]
        },
        {
            title: 'Reconciliation', color: 'var(--app-info)', icon: Zap, rows: [
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
                    <button onClick={onReturn || onClose} className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all shrink-0" title="Return">
                        <ArrowLeft size={14} />
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-app-primary flex items-center justify-center">
                        <Shield size={14} className="text-white" />
                    </div>
                    <div>
                        <h2>Global Settings</h2>
                        <p className="text-[9px] text-app-muted-foreground">Applies to all registers</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50">
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground"><X size={14} /></button>
                </div>
            </div>

            {/* Section tabs */}
            <div className="flex gap-1 px-5 pt-3 pb-2">
                {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setSection(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${section === s.id
                            ? 'bg-app-surface border border-app-border text-app-foreground'
                            : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                        <s.icon size={12} style={section === s.id ? { color: s.color } : { opacity: 0.5 }} /> {s.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3 custom-scrollbar">
                {section === 'security' && RULE_GROUPS.map(g => (
                    <div key={g.title} className="p-3 bg-app-surface/30 border border-app-border/50 rounded-xl">
                        <p className="text-[9px] text-app-muted-foreground uppercase tracking-widest font-black flex items-center gap-1.5 mb-1">
                            <g.icon size={9} style={{ color: g.color }} /> {g.title}
                        </p>
                        {g.rows}
                    </div>
                ))}
                {section === 'delivery' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-app-surface/30 border border-app-border/50 rounded-xl">
                            <p className="text-[9px] text-app-muted-foreground uppercase tracking-widest font-black flex items-center gap-1.5 mb-2">
                                <Hash size={9} style={{ color: 'var(--app-primary)' }} /> Delivery Codes
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[8px] font-black text-app-muted-foreground uppercase mb-1 block">Mode</label>
                                    <select value={ds.delivery_code_mode} onChange={e => setDs(x => ({ ...x, delivery_code_mode: e.target.value }))}
                                        className="w-full text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none">
                                        <option value="auto">Auto</option><option value="manual">Manual</option><option value="disabled">Off</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-app-muted-foreground uppercase mb-1 block">Digits</label>
                                    <input type="number" min={4} max={8} value={ds.delivery_code_digits}
                                        onChange={e => setDs(x => ({ ...x, delivery_code_digits: +e.target.value }))}
                                        className="w-full text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none text-center" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-app-muted-foreground uppercase mb-1 block">Expiry (h)</label>
                                    <input type="number" value={ds.delivery_code_expiry_hours}
                                        onChange={e => setDs(x => ({ ...x, delivery_code_expiry_hours: +e.target.value }))}
                                        className="w-full text-[11px] px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none text-center" />
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
   Enhanced with password-confirmed PIN changes
   ═══════════════════════════════════════════════════════════════ */
export function UsersPinsPanel({ users, onRefresh, onClose, onReturn }: { users: UD[]; onRefresh: () => void; onClose: () => void; onReturn?: () => void }) {
    const [filter, setFilter] = useState('')
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)

    // PIN change modal state
    const [pinModal, setPinModal] = useState<{ userId: number; userName: string; mode: 'self' | 'admin' } | null>(null)
    const [password, setPassword] = useState('')
    const [newPin, setNewPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [saving, setSaving] = useState(false)
    const [passwordError, setPasswordError] = useState('')

    // Load current user identity on mount
    useEffect(() => {
        erpFetch('auth/me/').then((me: any) => {
            if (me?.id) setCurrentUserId(me.id)
            if (me?.is_staff || me?.is_superuser) setIsAdmin(true)
        }).catch(() => { })
    }, [])

    const resetModal = () => {
        setPinModal(null)
        setPassword('')
        setNewPin('')
        setConfirmPin('')
        setShowPin(false)
        setPasswordError('')
    }

    const handlePinChange = async () => {
        if (!password) { setPasswordError('Password is required to confirm your identity'); return }
        if (!newPin || newPin.length < 4) { toast.error('PIN must be 4-6 digits'); return }
        if (newPin !== confirmPin) { toast.error('PINs do not match'); return }
        if (!pinModal) return

        setSaving(true)
        setPasswordError('')
        try {
            if (pinModal.mode === 'self') {
                await erpFetch('pos-registers/change-own-pin/', {
                    method: 'POST',
                    body: JSON.stringify({ current_password: password, new_pin: newPin })
                })
            } else {
                await erpFetch('pos-registers/admin-reset-pin/', {
                    method: 'POST',
                    body: JSON.stringify({ admin_password: password, target_user_id: pinModal.userId, new_pin: newPin })
                })
            }
            toast.success(pinModal.mode === 'self' ? 'Your PIN has been updated!' : `PIN reset for ${pinModal.userName}`)
            resetModal()
            onRefresh()
        } catch (e: any) {
            const msg = e?.message || e?.error || 'Failed'
            if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('identity')) {
                setPasswordError(msg)
            } else {
                toast.error(msg)
            }
        }
        setSaving(false)
    }

    const filtered = users.filter(u => {
        const q = filter.toLowerCase()
        return !q || u.username?.toLowerCase().includes(q) || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q)
    })

    const withPin = users.filter(u => u.pos_pin).length
    const withoutPin = users.length - withPin

    return (
        <>
            <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-app-bg border-l border-app-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
                    <div className="flex items-center gap-2">
                        <button onClick={onReturn || onClose} className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all shrink-0" title="Return">
                            <ArrowLeft size={14} />
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                            <Key size={14} />
                        </div>
                        <div>
                            <h2>Users & PINs</h2>
                            <p className="text-[9px] text-app-muted-foreground">{withPin} with PIN · {withoutPin} without</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground"><X size={14} /></button>
                </div>

                {/* Stats strip */}
                <div className="flex gap-2 px-5 py-2.5 border-b border-app-border/30">
                    <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                        <Lock size={10} style={{ color: 'var(--app-primary)' }} />
                        <span className="text-[10px] font-black" style={{ color: 'var(--app-primary)' }}>{withPin} PIN Set</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                        <Key size={10} style={{ color: 'var(--app-error)' }} />
                        <span className="text-[10px] font-black" style={{ color: 'var(--app-error)' }}>{withoutPin} No PIN</span>
                    </div>
                </div>

                {/* Search */}
                <div className="px-5 py-3">
                    <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search users…"
                        className="w-full text-[12px] pl-3 pr-3 py-2 bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none" />
                </div>

                {/* User list */}
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 custom-scrollbar">
                    {filtered.map(u => {
                        const name = `${u.first_name} ${u.last_name}`.trim() || u.username
                        const isSelf = u.id === currentUserId
                        const canReset = isAdmin && !isSelf

                        return (
                            <div key={u.id} className="p-3 rounded-xl border transition-all"
                                style={{
                                    background: isSelf
                                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                                        : 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                                    borderColor: isSelf
                                        ? 'color-mix(in srgb, var(--app-primary) 20%, transparent)'
                                        : 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <div className="flex items-center gap-2">
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0"
                                        style={{
                                            background: isSelf
                                                ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                                : 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                                            color: isSelf ? 'var(--app-primary)' : 'var(--app-info)',
                                        }}>
                                        {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                                    </div>

                                    {/* Name + role */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[11px] font-bold text-app-foreground truncate">{name}</p>
                                            {isSelf && (
                                                <span className="font-black px-1 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                    YOU
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-app-muted-foreground">{u.role_name || 'Staff'}</p>
                                    </div>

                                    {/* PIN status */}
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${u.pos_pin ? 'text-emerald-400' : 'text-red-400'}`}
                                        style={{ background: u.pos_pin ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)' }}>
                                        {u.pos_pin ? '● PIN SET' : '○ NO PIN'}
                                    </span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        {/* Self: Change own PIN */}
                                        {isSelf && (
                                            <button
                                                onClick={() => setPinModal({ userId: u.id, userName: name, mode: 'self' })}
                                                className="flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 rounded-lg transition-all hover:brightness-110"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}
                                                title="Change your PIN">
                                                <Key size={10} /> Change
                                            </button>
                                        )}
                                        {/* Admin: Reset other's PIN */}
                                        {canReset && (
                                            <button
                                                onClick={() => setPinModal({ userId: u.id, userName: name, mode: 'admin' })}
                                                className="flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 rounded-lg transition-all"
                                                style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}
                                                title={`Reset ${name}'s PIN`}>
                                                <Shield size={10} /> Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══ PIN CHANGE MODAL (password-confirmed) ═══ */}
            {pinModal && (
                <>
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[60] animate-in fade-in duration-150" onClick={resetModal} />
                    <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-app-bg border border-app-border rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200"
                            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                            {/* Modal header */}
                            <div className="px-5 pt-5 pb-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: pinModal.mode === 'self'
                                                ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                                : 'color-mix(in srgb, var(--app-warning) 12%, transparent)',
                                            color: pinModal.mode === 'self' ? 'var(--app-primary)' : 'var(--app-warning)',
                                        }}>
                                        {pinModal.mode === 'self' ? <Key size={18} /> : <Shield size={18} />}
                                    </div>
                                    <div>
                                        <h3>
                                            {pinModal.mode === 'self' ? 'Change Your PIN' : `Reset PIN`}
                                        </h3>
                                        <p className="text-[10px] text-app-muted-foreground">
                                            {pinModal.mode === 'self'
                                                ? 'Confirm your identity with your password'
                                                : `Setting new PIN for ${pinModal.userName}`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 pb-5 space-y-3">
                                {/* Identity verification notice */}
                                <div className="flex items-start gap-2 p-2.5 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 12%, transparent)' }}>
                                    <Lock size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                                    <p className="text-[10px] text-app-muted-foreground leading-relaxed">
                                        Enter your <strong>login password</strong> to verify your identity before changing the PIN.
                                    </p>
                                </div>

                                {/* Password field */}
                                <div>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                                        Your Password *
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                                        placeholder="Enter your login password"
                                        autoFocus
                                        className={`w-full text-[12px] px-3 py-2.5 bg-app-bg border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-colors ${passwordError ? 'border-app-error/50 bg-app-error/5' : 'border-app-border/50 focus:border-app-primary/40'}`}
                                    />
                                    {passwordError && (
                                        <p className="text-[9px] text-red-400 mt-1 flex items-center gap-1">
                                            <AlertTriangle size={9} /> {passwordError}
                                        </p>
                                    )}
                                </div>

                                {/* New PIN */}
                                <div>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                                        New PIN (4-6 digits) *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPin ? 'text' : 'password'}
                                            value={newPin}
                                            onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="● ● ● ●"
                                            className="w-full text-[14px] font-mono tracking-[0.3em] px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary/40 transition-colors text-center"
                                        />
                                        <button onClick={() => setShowPin(v => !v)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-app-muted-foreground hover:text-app-foreground transition-colors">
                                            {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm PIN */}
                                <div>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                                        Confirm PIN *
                                    </label>
                                    <input
                                        type={showPin ? 'text' : 'password'}
                                        value={confirmPin}
                                        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="● ● ● ●"
                                        className={`w-full text-[14px] font-mono tracking-[0.3em] px-3 py-2.5 bg-app-bg border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-colors text-center ${confirmPin && confirmPin !== newPin ? 'border-app-error/50' : 'border-app-border/50 focus:border-app-primary/40'}`}
                                    />
                                    {confirmPin && confirmPin !== newPin && (
                                        <p className="text-[9px] text-red-400 mt-1">PINs do not match</p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-1">
                                    <button onClick={resetModal}
                                        className="flex-1 text-[11px] font-bold py-2.5 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-surface transition-all">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePinChange}
                                        disabled={saving || !password || newPin.length < 4 || newPin !== confirmPin}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2.5 rounded-xl text-white transition-all disabled:opacity-40"
                                        style={{
                                            background: pinModal.mode === 'self' ? 'var(--app-primary)' : 'var(--app-warning)',
                                            boxShadow: `0 2px 12px color-mix(in srgb, ${pinModal.mode === 'self' ? 'var(--app-primary)' : 'var(--app-warning)'} 25%, transparent)`,
                                        }}>
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                                        {pinModal.mode === 'self' ? 'Update PIN' : 'Reset PIN'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}

/* ═══════════════════════════════════════════════════════════════
   CASHIER ROW — inline authorize + PIN management
   ═══════════════════════════════════════════════════════════════ */
function CashierRow({ user, name, authorized, onToggle, onRefresh }: {
    user: UD; name: string; authorized: boolean; onToggle: () => void; onRefresh: () => void
}) {
    const [pinOpen, setPinOpen] = useState(false)
    const [pinVal, setPinVal] = useState('')
    const [saving, setSaving] = useState(false)
    const [show, setShow] = useState(false)

    const setPin = async () => {
        if (!pinVal || pinVal.length < 4) { toast.error('PIN must be 4+ digits'); return }
        setSaving(true)
        try {
            await erpFetch('pos-registers/set-pin/', { method: 'POST', body: JSON.stringify({ user_id: user.id, pin: pinVal }) })
            toast.success(`PIN set for ${name}`)
            setPinOpen(false); setPinVal('')
            onRefresh()
        } catch (e: any) { toast.error(e?.message || 'Failed') }
        setSaving(false)
    }

    return (
        <div className="rounded-lg border transition-all"
            style={{
                background: authorized ? 'color-mix(in srgb, var(--app-info) 5%, transparent)' : 'transparent',
                borderColor: authorized ? 'color-mix(in srgb, var(--app-info) 18%, transparent)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
            }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5">
                {/* Authorize toggle */}
                <button onClick={onToggle}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${authorized ? 'bg-app-info border-app-info' : 'border-app-border hover:border-app-info'}`}>
                    {authorized && <Check size={9} className="text-white" />}
                </button>
                <span className="flex-1 truncate text-[11px] font-medium"
                    style={{ color: authorized ? 'var(--app-info)' : 'var(--app-muted-foreground)' }}>{name}</span>
                {/* PIN status */}
                <span className={`font-black px-1.5 py-0.5 rounded-md`}
                    style={{
                        background: user.pos_pin ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                        color: user.pos_pin ? 'var(--app-primary)' : 'var(--app-error)',
                    }}>
                    {user.pos_pin ? '✓ PIN' : '○ NO PIN'}
                </span>
                {/* Set PIN button */}
                <button onClick={() => { setPinOpen(!pinOpen); setPinVal('') }}
                    className="p-1 rounded transition-all hover:bg-app-info/10"
                    style={{ color: pinOpen ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 50%, transparent)' }}>
                    <Key size={10} />
                </button>
            </div>
            {pinOpen && (
                <div className="flex items-center gap-1.5 px-2.5 pb-2 animate-in fade-in duration-100">
                    <input type={show ? 'text' : 'password'} placeholder="PIN (4-6)" value={pinVal}
                        onChange={e => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus
                        className="flex-1 text-[10px] font-mono px-2 py-1 bg-app-bg border border-app-border/50 rounded-md text-app-foreground outline-none" />
                    <button onClick={() => setShow(v => !v)} className="p-0.5 text-app-muted-foreground"><Eye size={10} /></button>
                    <button onClick={setPin} disabled={saving || pinVal.length < 4}
                        className="text-[8px] font-bold bg-app-primary text-white px-2 py-1 rounded-md disabled:opacity-40">
                        {saving ? <Loader2 size={9} className="animate-spin" /> : 'Set'}
                    </button>
                </div>
            )}
        </div>
    )
}
