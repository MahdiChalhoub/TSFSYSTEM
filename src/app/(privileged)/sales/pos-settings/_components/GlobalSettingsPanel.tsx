'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Shield, Truck, Zap, Key, Monitor, ArrowLeft, X, Save, Hash, Loader2 } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { saveGlobalPOSSettings } from '@/app/actions/pos/settings-actions'

interface GlobalSettingsPanelProps {
    onClose: () => void;
    onReturn?: () => void;
}

export function GlobalSettingsPanel({ onClose, onReturn }: GlobalSettingsPanelProps) {
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
        erpFetch('pos-settings/')
            .then((data: any) => { if (data) setRules(r => ({ ...r, ...data })) })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await saveGlobalPOSSettings(rules);
            toast.success('Global settings saved!')
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save settings')
        }
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

    /* Delivery sub-section state */
    const [ds, setDs] = useState<Record<string, any>>({ delivery_code_mode: 'auto', delivery_code_digits: 6, delivery_code_expiry_hours: 72, sms_provider: 'none' })
    const [dLoading, setDLoading] = useState(true)
    
    useEffect(() => { 
        if (section === 'delivery') {
            erpFetch('pos-settings/').then((d: any) => { if (d) setDs(x => ({ ...x, ...d })) }).catch(() => { }).finally(() => setDLoading(false)) 
        }
    }, [section])

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
                        <h2 className="text-sm font-black text-app-foreground">Global Settings</h2>
                        <p className="text-[9px] text-app-muted-foreground">Applies to all registers</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50 hover:brightness-110 active:scale-95">
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground transition-colors"><X size={14} /></button>
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
