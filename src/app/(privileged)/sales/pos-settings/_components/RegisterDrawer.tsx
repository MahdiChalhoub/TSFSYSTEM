'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { 
    Save, Monitor, Users, Banknote, Shield, X, Loader2, 
    Settings2, ChevronRight, Zap, Check, AlertTriangle, 
    Key, CreditCard, Wallet, Smartphone, Truck, Hash, Phone
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { saveRegisterConfig } from '@/app/actions/pos/settings-actions'
import { Reg, FA, UD, RegisterMethod, GlobalPaymentMethod } from '../types' // Centralized types

interface RegisterDrawerProps {
    reg: Reg;
    accounts: FA[];
    warehouses: any[];
    users: UD[];
    onRefresh: () => void;
    onClose: () => void;
    onOpenUsers?: (regId: number) => void;
    onOpenSettings?: (regId: number) => void;
}

export function RegisterDrawer({ reg, accounts, warehouses, users, onRefresh, onClose, onOpenUsers, onOpenSettings }: RegisterDrawerProps) {
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState<'general' | 'payments' | 'access' | 'rules'>('general')
    
    const [form, setForm] = useState({
        name: reg.name, 
        warehouseId: reg.warehouseId || 0, 
        cashAccountId: reg.cashAccountId || 0,
        enableAccountBook: !!(reg.accountBookId), 
        openingMode: reg.openingMode || 'standard',
        allowedAccountIds: reg.allowedAccounts.map((a: any) => a.id) as number[],
        authorizedUserIds: reg.authorizedUsers.map((u: any) => u.id) as number[],
        paymentMethods: reg.paymentMethods || [],
        registerMethods: (reg.registerMethods || []) as RegisterMethod[],
        rulesOverride: reg.registerRulesOverride || {},
    })

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const toggleId = (arr: number[], id: number) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]

    /* Fetch global payment methods for payments tab */
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
    }, [tab])

    useEffect(() => {
        if (form.cashAccountId && !form.paymentMethods.some((m: any) => m.key === 'CASH')) {
            setForm(f => ({ ...f, paymentMethods: [...f.paymentMethods, { key: 'CASH', label: 'CASH', accountId: f.cashAccountId }] }))
        }
    }, [form.cashAccountId])

    const filteredWarehouses = useMemo(() => {
        if (!reg.siteId) return warehouses
        return warehouses.filter((w: any) => w.parent === reg.siteId || w.parent_id === reg.siteId)
    }, [warehouses, reg.siteId])

    const handleSave = async () => {
        if (!form.cashAccountId) { toast.error('Cash Account is required'); return }
        setSaving(true)
        try {
            const payload = {
                name: form.name, 
                warehouse_id: form.warehouseId || null,
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
            };
            
            await saveRegisterConfig(reg.id, payload);
            toast.success('Register configuration updated!')
            onRefresh()
        } catch (e: any) { toast.error(e?.message || 'Failed to save configuration') }
        setSaving(false)
    }

    /* Helper Components */
    const Toggle = ({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) => (
        <button onClick={onChange} disabled={disabled}
            className={`w-9 h-5 rounded-full relative transition-all shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${on ? 'bg-app-primary' : 'bg-app-surface border border-app-border/50'}`}>
            <span className={`w-3.5 h-3.5 rounded-full bg-app-surface shadow absolute top-[3px] transition-all ${on ? 'left-[18px]' : 'left-[3px]'}`} />
        </button>
    )

    const SectionLabel = ({ icon: Icon, label, color, count }: { icon: any; label: string; color: string; count?: number }) => (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                <Icon size={12} style={{ color }} />
            </div>
            <span className="text-[11px] font-black text-app-text uppercase tracking-widest">{label}</span>
            {count !== undefined && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>{count}</span>
            )}
        </div>
    )

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

                {/* HEADER */}
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
                                <h2 className="text-sm font-black text-app-text tracking-tight">{form.name}</h2>
                                <p className="text-[10px] text-app-text-muted">{reg.siteName} · #{reg.id}</p>
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
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 active:scale-95 text-white px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-app-surface rounded-xl text-app-text-muted transition-colors"><X size={16} /></button>
                        </div>
                    </div>
                    <div className="flex gap-0.5 -mb-[1px]">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[10px] font-bold transition-all border-b-2 ${tab === t.id
                                    ? 'text-app-text border-current'
                                    : 'text-app-text-muted border-transparent hover:text-app-text'}`}
                                style={tab === t.id ? { borderColor: t.color, color: t.color } : {}}>
                                <t.icon size={12} /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar">
                    {/* GENERAL */}
                    {tab === 'general' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            {!reg.isConfigComplete && (
                                <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                                    <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] font-black" style={{ color: 'var(--app-error)' }}>Register not operational</p>
                                        <p className="text-[10px] mt-0.5 text-app-text-muted">{reg.missingCashAccount && '⚠ Missing Cash Account. '}{reg.missingAccountBook && '⚠ Missing Account Book.'}</p>
                                    </div>
                                </div>
                            )}
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Monitor} label="Register Info" color="var(--app-primary)" />
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Name</label>
                                        <input value={form.name} onChange={e => set('name', e.target.value)}
                                            className="w-full text-[13px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none focus:border-app-primary/40 transition-colors" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Cash Account *</label>
                                            <select value={form.cashAccountId} onChange={e => set('cashAccountId', +e.target.value)}
                                                className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                                <option value={0}>⚠ Select…</option>
                                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Opening Mode</label>
                                            <select value={form.openingMode} onChange={e => set('openingMode', e.target.value)}
                                                className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                                <option value="standard">Standard</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Warehouse</label>
                                        <select value={form.warehouseId} onChange={e => set('warehouseId', +e.target.value)}
                                            className="w-full text-[12px] font-bold px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                            <option value={0}>-- none --</option>
                                            {filteredWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.location_type || 'WH'})</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between py-2.5 border-t border-app-border/20">
                                        <div><p className="text-[11px] font-bold text-app-text">Account Book</p><p className="text-[9px] text-app-text-muted">{form.enableAccountBook ? 'Linked to cash account' : 'Disabled'}</p></div>
                                        <Toggle on={form.enableAccountBook} onChange={() => set('enableAccountBook', !form.enableAccountBook)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PAYMENTS */}
                    {tab === 'payments' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Banknote} label="Methods" color="var(--app-primary)" count={form.registerMethods.length} />
                                {methodsLoading ? (
                                    <div className="flex items-center gap-2 py-4 text-app-text-muted">
                                        <Loader2 size={14} className="animate-spin" /> <span className="text-[11px]">Loading methods…</span>
                                    </div>
                                ) : globalMethods.length === 0 ? (
                                    <p className="text-[10px] text-app-text-muted italic py-4">No payment methods configured. <a href="/finance/settings/payment-methods" className="text-app-primary underline">Create some →</a></p>
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
                                                        ? 'border-emerald-500/20' : 'border-app-border/30 hover:bg-app-surface/50'}`}
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
                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-emerald-500 border-emerald-400' : 'border-app-border hover:border-emerald-400/50'}`}>
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
                                                        <p className={`text-[11px] font-bold truncate ${isActive ? 'text-app-text' : 'text-app-text-muted'}`}>{gm.name}</p>
                                                        <p className="text-[8px] text-app-text-faint uppercase tracking-widest">{gm.code}</p>
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
                                                            className="text-[10px] font-bold px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-text outline-none max-w-[160px]"
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
                                    {accounts.length === 0 && <p className="text-[10px] text-app-text-muted italic py-2">No financial accounts found</p>}
                                    {accounts.map(a => {
                                        const isCash = a.id === form.cashAccountId; const on = isCash || form.allowedAccountIds.includes(a.id)
                                        return (
                                            <button key={a.id} onClick={() => { if (isCash) return; set('allowedAccountIds', toggleId(form.allowedAccountIds, a.id)) }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all text-[11px] ${isCash ? 'border-emerald-500/25 text-emerald-400 cursor-default' : on ? 'border-emerald-500/15 text-emerald-400' : 'border-app-border/30 text-app-text-muted hover:bg-app-surface'}`}
                                                style={on ? { background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)' } : {}}>
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-400' : 'border-app-border'}`}>{on && <Check size={10} className="text-white" />}</div>
                                                <span className="flex-1 truncate font-medium">{a.name}</span>
                                                {isCash && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>PRIMARY</span>}
                                                <span className="text-[9px] opacity-40">{a.type}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ACCESS */}
                    {tab === 'access' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Users} label="Authorized Cashiers" color="var(--app-info)" count={form.authorizedUserIds.length} />
                                <p className="text-[9px] text-app-text-muted -mt-2 mb-3">Toggle access and manage PINs per register. Users without a PIN cannot log in.</p>
                                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    {users.map(u => {
                                        const on = form.authorizedUserIds.includes(u.id)
                                        const name = `${u.first_name} ${u.last_name}`.trim() || u.username
                                        return (
                                            <div key={u.id}
                                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all text-[11px] ${on ? 'border-blue-500/20' : 'border-app-border/30 hover:bg-app-surface/30'}`}
                                                style={on ? { background: 'color-mix(in srgb, var(--app-info) 5%, transparent)' } : {}}>
                                                {/* Toggle authorize */}
                                                <button onClick={() => set('authorizedUserIds', toggleId(form.authorizedUserIds, u.id))}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${on ? 'bg-blue-500 border-blue-400' : 'border-app-border hover:border-blue-400/50'}`}>
                                                    {on && <Check size={10} className="text-white" />}
                                                </button>
                                                {/* Avatar */}
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                                                    style={on ? { background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' } : { background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                                                    {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                                                </div>
                                                {/* Name + role */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium truncate ${on ? 'text-app-text' : 'text-app-text-muted'}`}>{name}</p>
                                                    <p className="text-[9px] opacity-50">{u.role_name || 'Staff'}</p>
                                                </div>
                                                {/* PIN status */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${u.pos_pin ? 'text-emerald-400' : 'text-red-400'}`}
                                                        style={{ background: u.pos_pin ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)' }}>
                                                        {u.pos_pin ? '● PIN' : '○ NO PIN'}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Zap} label="Quick Links" color="var(--app-primary)" />
                                <p className="text-[9px] text-app-text-muted -mt-2 mb-3">Jump to related settings and features</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Users & PINs', desc: 'Global PIN manager', icon: Key, color: 'var(--app-info)', href: '__users_pins__' },
                                        { label: 'Global Rules', desc: 'POS-wide defaults', icon: Shield, color: 'var(--app-warning)', href: '__global_rules__' },
                                        { label: 'Access Users', desc: 'Identity management', icon: Users, color: 'var(--app-primary)', href: '/access/users' },
                                        { label: 'Payment Methods', desc: 'Configure accounts', icon: CreditCard, color: 'var(--app-primary)', href: '/finance/settings/payment-methods' },
                                    ].map(link => (
                                        <button key={link.label}
                                            onClick={() => {
                                                if (link.href === '__users_pins__') onOpenUsers?.(reg.id)
                                                else if (link.href === '__global_rules__') onOpenSettings?.(reg.id)
                                                else window.location.href = link.href
                                            }}
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-app-border/30 text-left transition-all hover:bg-app-surface hover:border-app-border/60">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ background: `color-mix(in srgb, ${link.color} 12%, transparent)`, color: link.color }}>
                                                <link.icon size={13} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-app-text truncate">{link.label}</p>
                                                <p className="text-[8px] text-app-text-faint">{link.desc}</p>
                                            </div>
                                            <ChevronRight size={11} className="text-app-text-faint shrink-0 ml-auto" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RULES */}
                    {tab === 'rules' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 rounded-xl border border-app-border/30" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                                <SectionLabel icon={Shield} label="Rules Override" color="var(--app-warning)" />
                                <p className="text-[10px] text-app-text-muted mb-3 -mt-1">Override global rules for this register. Unset rules inherit from Global Settings.</p>
                                <div className="space-y-0.5">
                                    {OVERRIDE_RULES.map(rule => {
                                        const val = form.rulesOverride[rule.key]; const isSet = val !== undefined
                                        return (
                                            <div key={rule.key} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-app-surface/50 transition-colors border-b border-app-border/10 last:border-0">
                                                <div className="flex-1 mr-3"><p className="text-[11px] font-bold text-app-text">{rule.label}</p><p className="text-[9px] text-app-text-muted">{rule.desc}</p></div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isSet && <button onClick={() => { const r = { ...form.rulesOverride }; delete r[rule.key]; set('rulesOverride', r) }}
                                                        className="text-[8px] text-app-text-muted hover:text-red-400 font-bold px-1.5 py-0.5 rounded hover:bg-red-400/10 transition-all">reset</button>}
                                                    <button onClick={() => set('rulesOverride', { ...form.rulesOverride, [rule.key]: !val })}
                                                        className={`w-9 h-5 rounded-full relative transition-all ${isSet ? (val ? 'bg-amber-500' : 'bg-app-surface border border-app-border/50') : 'bg-app-surface border border-app-border/50 opacity-30'}`}>
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
