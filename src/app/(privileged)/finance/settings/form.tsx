'use client'
import { useTransition, useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { FinancialSettingsState, updateFinancialSettings } from '@/app/actions/finance/settings'
import { type Currency } from '@/app/actions/currencies'
import { Package, ShieldAlert, Target, Lock, GitCompareArrows, X, Pencil, AlertTriangle, Layers, Banknote, Landmark, Wallet, Activity, Plus, Trash2, Clock, ArrowRight, Zap, Ghost } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getTradeSubTypeSettings, updateTradeSubTypeSettings } from '@/app/actions/settings/trade-settings'
interface Props {
    settings: FinancialSettingsState
    lock: { isLocked: boolean; reason: string | null }
    currencies: Currency[]
    accounts: any[]
}
// ─── Edit Confirmation Modal ───
function EditConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
    return (
        <div className="fixed inset-0 bg-app-background/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-app-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-app-warning-bg rounded-xl text-app-warning">
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-app-foreground">Unlock Settings?</h3>
                        <p className="text-xs text-app-muted-foreground">This will allow editing core financial settings</p>
                    </div>
                </div>
                <p className="text-sm text-app-muted-foreground mb-6 leading-relaxed">
                    These settings are locked because they have already been saved and applied. Modifying them
                    may affect existing transactions and reports. Are you sure you want to unlock and edit?
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-app-muted-foreground bg-app-surface-2 rounded-lg hover:bg-app-border transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-semibold text-app-foreground bg-app-warning rounded-lg hover:bg-app-warning transition-colors"
                    >
                        Yes, Unlock Settings
                    </button>
                </div>
            </div>
        </div>
    )
}
export default function FinancialSettingsForm({ settings, lock, currencies, accounts }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { register, handleSubmit, watch, setValue, control } = useForm<FinancialSettingsState>({
        defaultValues: {
            ...settings,
            declarationRules: settings.declarationRules || []
        }
    })
    const { fields, append, remove } = useFieldArray({
        control,
        name: "declarationRules"
    })
    const [isRecalcPending, startRecalc] = useTransition()
    const [showEditConfirm, setShowEditConfirm] = useState(false)
    const [tradeSubTypesEnabled, setTradeSubTypesEnabled] = useState(false)
    const [tradeTogglePending, setTradeTogglePending] = useState(false)
    // Load trade sub-type setting on mount
    useEffect(() => {
        getTradeSubTypeSettings().then(s => setTradeSubTypesEnabled(s?.enabled ?? false)).catch(() => { })
    }, [])
    // Settings lock: after save, core fields are locked until user explicitly unlocks
    const [settingsAreSaved, setSettingsAreSaved] = useState(() => {
        // If currency has a value, settings were previously saved
        return !!(settings.currency && settings.currency !== '')
    })
    const [isUnlocked, setIsUnlocked] = useState(false)
    const isCoreFieldsLocked = lock.isLocked || (settingsAreSaved && !isUnlocked)

    const onSubmit = (data: FinancialSettingsState) => {
        startTransition(async () => {
            try {
                await updateFinancialSettings(data)
                setSettingsAreSaved(true)
                setIsUnlocked(false)
                toast.success('Settings Saved!')
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)))
            }
        })
    }
    const [settingsPendingAction, setSettingsPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info' } | null>(null)
    const handleRecalculate = () => {
        setSettingsPendingAction({
            type: 'recalculate',
            title: 'Recalculate Balances?',
            description: 'This will reset and recalculate all account balances based on the ledger history.',
            variant: 'warning',
        })
    }
    const handleUnlockRequest = () => {
        setShowEditConfirm(true)
    }
    const handleConfirmUnlock = () => {
        setIsUnlocked(true)
        setShowEditConfirm(false)
    }
    return (
        <div className="flex gap-6 items-start">
            {/* Edit Confirmation Modal */}
            {showEditConfirm && (
                <EditConfirmModal
                    onConfirm={handleConfirmUnlock}
                    onCancel={() => setShowEditConfirm(false)}
                />
            )}
            {/* ─── LEFT COLUMN: Main Form ─── */}
            <div className="space-y-4 max-w-3xl w-full">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-app-surface p-4 rounded-xl shadow-sm border border-app-border">
                    {/* Lock Status Warning */}
                    {lock.isLocked && (
                        <div className="p-4 bg-app-warning-bg border border-app-warning rounded-lg flex gap-3 items-start">
                            <div className="p-2 bg-app-warning-bg rounded-lg text-app-warning">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-app-warning">Accounting Integrity Lock Active</h3>
                                <p className="text-xs text-app-warning mt-0.5 leading-relaxed">
                                    {lock.reason}
                                    <br />
                                    <span className="font-bold">Structural core configuration fields have been set to read-only.</span>
                                </p>
                            </div>
                        </div>
                    )}
                    {/* Settings Saved Lock Banner */}
                    {settingsAreSaved && !isUnlocked && !lock.isLocked && (
                        <div className="p-4 bg-app-info-bg border border-app-info rounded-lg flex gap-3 items-center justify-between">
                            <div className="flex gap-3 items-start">
                                <div className="p-2 bg-app-info-bg rounded-lg text-app-info">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-app-info">Settings Locked</h3>
                                    <p className="text-xs text-app-info mt-0.5">
                                        Core settings are locked after saving. Click Edit to modify.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleUnlockRequest}
                                className="flex items-center gap-1.5 px-3 py-2 bg-app-surface border border-app-info text-app-info hover:bg-app-info-bg rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                                <Pencil size={12} />
                                Edit
                            </button>
                        </div>
                    )}
                    {/* ─── CORE CONFIGURATION ─── */}
                    <div>
                        <h2 className="text-lg font-medium text-app-foreground mb-4">Core Configuration</h2>
                        {/* Tax Migration Banner */}
                        <div className="p-4 bg-app-primary/5 border border-app-primary/30 rounded-xl flex items-start gap-4 mb-4">
                            <div className="p-2 bg-app-primary/10 text-app-primary rounded-lg shrink-0">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-app-primary">Tax Configuration has moved</h3>
                                <p className="text-xs text-app-primary mt-1 leading-relaxed">
                                    Legacy Company Types (MICRO, REAL, MIXED) and generic tax rates have been replaced by the <strong>Universal Tax Engine</strong>. Configure all taxes in <a href="/finance/tax-policy" className="underline font-bold">Finance → Tax Policy</a>.
                                </p>
                            </div>
                        </div>
                        {/* Currency */}
                        <div className="max-w-xs">
                            <label className="block text-sm font-medium text-app-muted-foreground mb-1">Default Currency</label>
                            <select
                                {...register('currency')}
                                disabled={isCoreFieldsLocked}
                                className="w-full px-3 py-2 border border-app-border rounded-md shadow-sm focus:ring-black focus:border-black disabled:bg-app-surface-2 disabled:text-app-muted-foreground"
                            >
                                <option value="">Select currency...</option>
                                {currencies.map(c => (
                                    <option key={c.id} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-app-muted-foreground">
                                Manage currencies in <a href="/saas/currencies" className="text-app-primary hover:underline">SaaS → Currencies</a>
                            </p>
                        </div>
                    </div>
                    {/* ─── DUAL VIEW / OFFICIAL ACCESS ─── */}
                    <div className="p-4 bg-app-surface-2 rounded-xl border border-app-border">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-app-surface rounded-lg text-app-muted-foreground mt-0.5">
                                    <ShieldAlert size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-app-foreground">Dual View — Internal Scope Access</h3>
                                    <p className="text-xs text-app-muted-foreground mt-0.5 leading-relaxed">
                                        Activates a second <strong>Internal</strong> scope alongside the Official one.
                                        Each user gets separate scope credentials for controlled access.
                                    </p>
                                </div>
                            </div>
                            {/* Gate: show toggle only if org has the add-on */}
                            {settings.canEnableDualView ? (
                                <input
                                    {...register('dualView')}
                                    type="checkbox"
                                    disabled={isCoreFieldsLocked}
                                    className="h-5 w-5 shrink-0 text-app-primary border-app-border rounded focus:ring-app-primary disabled:opacity-50"
                                />
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-app-primary/5 border border-app-primary/30 rounded-lg shrink-0">
                                    <span className="text-app-primary" title="SaaS Add-On required">🔒</span>
                                    <span className="text-[10px] font-bold text-app-primary uppercase tracking-widest whitespace-nowrap">Add-On</span>
                                </div>
                            )}
                        </div>
                        {/* Upgrade CTA — only shown when org does not have the add-on */}
                        {!settings.canEnableDualView && (
                            <p className="mt-3 text-[11px] text-app-muted-foreground leading-relaxed border-t border-app-border pt-3">
                                🔒 Dual View is a <strong>SaaS Add-On</strong>. Contact your account manager to activate Internal Scope Access for this organization.
                            </p>
                        )}
                    </div>
                    {settings.dualView && (
                        <div className="p-4 bg-app-warning-bg rounded-xl border border-app-warning">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-app-warning-bg rounded-lg text-app-warning">
                                    <ShieldAlert size={16} />
                                </div>
                                <h3 className="text-sm font-bold text-app-warning">Dual View Active</h3>
                            </div>
                            <p className="text-xs text-app-warning mb-4 leading-relaxed">
                                Two scopes are active: <strong>Official</strong> (declared/posted data) and <strong>Internal</strong> (full picture).
                                The scope toggle appears in the sidebar. Each user has separate credentials for each scope.
                            </p>
                            {/* Scope Preview */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="p-3 bg-app-surface rounded-lg border border-app-warning">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-app-primary" />
                                        <span className="text-xs font-bold text-app-foreground">Official</span>
                                    </div>
                                    <p className="text-[10px] text-app-muted-foreground leading-relaxed">
                                        Declared transactions only. Government-reported data.
                                        Access via <strong>Viewer Password</strong>.
                                    </p>
                                </div>
                                <div className="p-3 bg-app-surface rounded-lg border border-app-warning">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-app-surface-2" />
                                        <span className="text-xs font-bold text-app-foreground">Internal</span>
                                    </div>
                                    <p className="text-[10px] text-app-muted-foreground leading-relaxed">
                                        Full picture — all operations including undeclared.
                                        Access via <strong>Full Access Password</strong>.
                                    </p>
                                </div>
                            </div>
                            {/* Per-User Access Info */}
                            <div className="bg-app-surface rounded-lg border border-app-warning p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lock size={14} className="text-app-warning" />
                                    <span className="text-sm font-bold text-app-foreground">Scope Access Control</span>
                                </div>
                                <p className="text-xs text-app-muted-foreground leading-relaxed">
                                    Each user has <strong>two passwords</strong> when Dual View is enabled:
                                </p>
                                <ul className="mt-2 space-y-1.5 text-xs text-app-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary mt-1.5 shrink-0" />
                                        <span><strong>Viewer Password</strong> — grants read-only access to Official (posted/declared) data</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-surface-2 mt-1.5 shrink-0" />
                                        <span><strong>Full Access Password</strong> — grants full access to Internal scope (complete picture)</span>
                                    </li>
                                </ul>
                                <p className="text-[10px] text-app-muted-foreground mt-3 italic">
                                    Manage user scope passwords in HR &amp; Teams → Access Control.
                                </p>
                            </div>
                            {/* --- AUTO-DECLARATION STRATEGY --- */}
                            <div className="mt-4 p-5 bg-app-surface rounded-2xl border border-app-warning shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-app-primary-light rounded-lg text-app-primary">
                                            <Target size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-app-foreground uppercase tracking-tight">Official Transaction Guard</h3>
                                    </div>
                                    <div className="flex items-center h-6">
                                        <input
                                            {...register('autoDeclarationEnabled')}
                                            type="checkbox"
                                            className="h-4 w-4 text-app-primary border-app-border rounded focus:ring-app-primary"
                                        />
                                    </div>
                                </div>
                                <p className="text-[11px] text-app-muted-foreground leading-relaxed font-medium">
                                    Automate which Sales/POS invoices are routed to the <strong>Official Scope</strong>.
                                    Reduces manual scope toggling during high-speed checkout.
                                </p>
                                {/* --- STRATEGIC OVERRIDES --- */}
                                <div className="mt-4 p-5 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-app-error rounded-lg text-app-foreground shadow-lg shadow-rose-100">
                                                <Zap size={16} />
                                            </div>
                                            <h3 className="text-sm font-black text-rose-900 uppercase tracking-tight">Management Overrides</h3>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-3 bg-app-surface rounded-xl border border-rose-200 shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-rose-900 uppercase tracking-widest">Panic Mode</span>
                                                <span className="text-[9px] text-rose-500 font-bold uppercase tracking-tighter">Force ALL Transactions to OFFICIAL</span>
                                            </div>
                                            <input
                                                {...register('emergencyForceDeclared')}
                                                type="checkbox"
                                                className="h-5 w-5 text-rose-600 border-rose-300 rounded-lg focus:ring-rose-500 shadow-sm"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5 p-3 bg-app-surface rounded-xl border border-app-border shadow-sm">
                                            <label className="text-[10px] font-black text-app-foreground uppercase tracking-widest block">High-Value Guard ($)</label>
                                            <input
                                                {...register('highValueAlertThreshold', { valueAsNumber: true })}
                                                type="number"
                                                placeholder="Amount for alert"
                                                className="w-full px-3 py-1.5 bg-app-background border border-app-border rounded-lg text-xs font-black text-app-foreground focus:bg-app-surface outline-none transition-all"
                                            />
                                            <p className="text-[8px] text-app-muted-foreground italic">User must confirm if amount &gt; X is declared.</p>
                                        </div>
                                    </div>
                                </div>
                                {/* --- RULES OF ENGAGEMENT --- */}
                                <div className="mt-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-app-surface-2 rounded-lg text-app-muted-foreground">
                                                <GitCompareArrows size={16} />
                                            </div>
                                            <h3 className="text-sm font-black text-app-foreground uppercase tracking-tight">Rules of Engagement</h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => append({ id: Math.random().toString(36).substr(2, 9), name: 'New Strategy', startTime: '08:00', endTime: '17:00', forceScope: 'OFFICIAL' })}
                                            className="flex items-center gap-2 px-4 py-2 bg-app-primary text-app-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-app-success transition-all shadow-lg shadow-emerald-100"
                                        >
                                            <Plus size={12} /> Add Rule
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {fields.length === 0 && (
                                            <div className="p-8 text-center bg-app-background rounded-2xl border-2 border-dashed border-app-border">
                                                <Ghost size={32} className="mx-auto text-app-muted-foreground mb-2" />
                                                <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">No active windows defined</p>
                                            </div>
                                        )}
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="p-4 bg-app-surface rounded-2xl border border-app-border shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Clock size={14} className="text-app-primary" />
                                                        <div className="flex items-center border border-app-border rounded-lg overflow-hidden bg-app-background">
                                                            <input {...register(`declarationRules.${index}.startTime`)} type="time" className="px-2 py-1 text-[10px] font-black bg-transparent outline-none w-20" />
                                                            <div className="px-1 text-app-muted-foreground font-black"><ArrowRight size={10} /></div>
                                                            <input {...register(`declarationRules.${index}.endTime`)} type="time" className="px-2 py-1 text-[10px] font-black bg-transparent outline-none w-20" />
                                                        </div>
                                                        <input {...register(`declarationRules.${index}.name`)} placeholder="Window Name" className="text-xs font-black text-app-foreground uppercase tracking-tight bg-transparent border-none focus:ring-0 w-32" />
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <select
                                                            {...register(`declarationRules.${index}.forceScope`)}
                                                            className="text-[10px] font-black uppercase bg-app-surface-2 rounded-lg px-2 py-1 outline-none border-none focus:ring-0"
                                                        >
                                                            <option value="OFFICIAL">Official</option>
                                                            <option value="INTERNAL">Internal</option>
                                                        </select>
                                                        <button onClick={() => remove(index)} className="p-1.5 text-app-muted-foreground hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6 bg-app-surface/50 p-4 rounded-xl border border-app-border">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block">Allowed Payment Methods</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['CASH', 'WAVE', 'OM', 'CARD'].map(method => (
                                                                <button
                                                                    key={method}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = watch(`declarationRules.${index}.allowedMethods`) || [];
                                                                        if (current.includes(method)) {
                                                                            setValue(`declarationRules.${index}.allowedMethods`, current.filter(m => m !== method));
                                                                        } else {
                                                                            setValue(`declarationRules.${index}.allowedMethods`, [...current, method]);
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${(watch(`declarationRules.${index}.allowedMethods`) || []).includes(method)
                                                                        ? 'bg-app-primary text-app-foreground shadow-lg shadow-indigo-100'
                                                                        : 'bg-app-surface text-app-muted-foreground border border-app-border hover:border-app-primary/30'
                                                                        }`}
                                                                >
                                                                    {method}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block">Restricted Accounts</label>
                                                        <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5 p-1">
                                                            {accounts.filter(a => ['BANK', 'WALLET', 'CASH'].includes(a.type) || a.nature === 'FINANCIAL').map(account => (
                                                                <label key={account.id} className="flex items-center gap-2 cursor-pointer group">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(watch(`declarationRules.${index}.allowedAccountIds`) || []).includes(account.id)}
                                                                        onChange={(e) => {
                                                                            const current = watch(`declarationRules.${index}.allowedAccountIds`) || [];
                                                                            if (e.target.checked) {
                                                                                setValue(`declarationRules.${index}.allowedAccountIds`, [...current, account.id]);
                                                                            } else {
                                                                                setValue(`declarationRules.${index}.allowedAccountIds`, current.filter(id => id !== account.id));
                                                                            }
                                                                        }}
                                                                        className="h-3 w-3 text-app-primary border-app-border rounded transition-all group-hover:border-app-primary/30"
                                                                    />
                                                                    <span className="text-[9px] font-bold text-app-muted-foreground truncate group-hover:text-app-primary transition-all">{account.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <p className="text-[7px] text-app-muted-foreground uppercase font-black">Leave empty to apply to all accounts</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest block">Tx Min ($)</label>
                                                        <input {...register(`declarationRules.${index}.minTransactionAmount`, { valueAsNumber: true })} type="number" placeholder="0" className="w-full px-2 py-1.5 bg-app-background border border-app-border rounded-lg text-xs font-bold" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest block">Tx Max ($)</label>
                                                        <input {...register(`declarationRules.${index}.maxTransactionAmount`, { valueAsNumber: true })} type="number" placeholder="Any" className="w-full px-2 py-1.5 bg-app-background border border-app-border rounded-lg text-xs font-bold" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest block">Turnover Limit ($)</label>
                                                        <input {...register(`declarationRules.${index}.limitDailyTurnover`, { valueAsNumber: true })} type="number" placeholder="No limit" className="w-full px-2 py-1.5 bg-app-background border border-app-border rounded-lg text-xs font-bold" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-app-border">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block">Global Threshold ($)</label>
                                            <select
                                                {...register('autoDeclareThresholdMode')}
                                                className="text-[9px] font-black uppercase text-app-primary bg-app-primary/5 px-1.5 py-0.5 rounded border-none outline-none"
                                            >
                                                <option value="ABOVE">Declare Above</option>
                                                <option value="BELOW">Declare Below</option>
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground font-bold">$</span>
                                            <input
                                                {...register('autoDeclareThreshold', { valueAsNumber: true })}
                                                type="number"
                                                placeholder="e.g. 500"
                                                className="w-full pl-7 pr-3 py-2 bg-app-background border border-app-border rounded-xl text-xs font-black text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-emerald-50 focus:border-app-success transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block">Sampling Strategy (%)</label>
                                        <div className="relative">
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground font-bold">%</span>
                                            <input
                                                {...register('autoDeclarePercentage', { valueAsNumber: true })}
                                                type="number"
                                                placeholder="e.g. 15"
                                                className="w-full pl-3 pr-8 py-2 bg-app-background border border-app-border rounded-xl text-xs font-black text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-indigo-50 focus:border-app-primary/30 transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* --- INTEGRITY PROTECTION --- */}
                                <div className="mt-2 pt-4 border-t border-app-border space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-app-warning-bg rounded-lg text-app-warning">
                                                <Activity size={16} />
                                            </div>
                                            <h3 className="text-sm font-black text-app-foreground uppercase tracking-tight">Financial Health Shield</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-tighter">Safety Margin Active</span>
                                            <input
                                                {...register('integrityAlertEnabled')}
                                                type="checkbox"
                                                className="h-4 w-4 text-app-warning border-app-border rounded focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block">Daily Operation Cap ($)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground font-bold">$</span>
                                                <input
                                                    {...register('autoDeclareDailyLimit', { valueAsNumber: true })}
                                                    type="number"
                                                    placeholder="Global daily cap"
                                                    className="w-full pl-7 pr-3 py-2.5 bg-app-background border border-app-border rounded-xl text-xs font-black text-app-warning focus:bg-app-surface focus:ring-4 focus:ring-amber-50 focus:border-app-warning transition-all outline-none shadow-inner"
                                                />
                                            </div>
                                            <p className="text-[9px] text-app-warning font-bold italic leading-tight uppercase tracking-tighter">Strategic downgrade point to avoid over-exposure.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block flex items-center gap-1.5">
                                                <Landmark size={10} className="text-app-primary" /> Controllable Entry Points
                                            </label>
                                            <div className="bg-app-surface-2/50 border border-app-border rounded-2xl p-4 max-h-40 overflow-y-auto custom-scrollbar space-y-2 shadow-inner">
                                                {accounts.filter(a => ['BANK', 'WALLET', 'CASH'].includes(a.type) || a.nature === 'FINANCIAL').length > 0 ? (
                                                    accounts.filter(a => ['BANK', 'WALLET', 'CASH'].includes(a.type) || a.nature === 'FINANCIAL').map(account => (
                                                        <label key={account.id} className="flex items-center gap-3 p-2 bg-app-surface rounded-xl border border-app-border hover:border-app-primary/30 transition-all cursor-pointer shadow-sm">
                                                            <input
                                                                type="checkbox"
                                                                value={account.id}
                                                                defaultChecked={settings.controllableAccountIds?.includes(account.id)}
                                                                onChange={(e) => {
                                                                    const current = watch('controllableAccountIds') || [];
                                                                    if (e.target.checked) {
                                                                        setValue('controllableAccountIds', [...current, account.id]);
                                                                    } else {
                                                                        setValue('controllableAccountIds', current.filter(id => id !== account.id));
                                                                    }
                                                                }}
                                                                className="h-3.5 w-3.5 text-app-primary border-app-border rounded-lg focus:ring-app-primary"
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[10px] font-black text-app-muted-foreground truncate capitalize">{account.name.toLowerCase()}</span>
                                                                <span className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-tighter">{account.type}</span>
                                                            </div>
                                                        </label>
                                                    ))
                                                ) : (
                                                    <p className="text-[9px] text-app-muted-foreground text-center py-4 italic">No controllable accounts found.</p>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-app-muted-foreground italic leading-tight">Digital channels gov can trace. These always route to Official.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* ─── POSTING RULES ─── */}
                    <div className="p-4 bg-app-primary-light rounded-md border border-app-success/30 flex items-center justify-between">
                        <div className="flex gap-3 items-center">
                            <div className="p-2 bg-app-primary-light rounded-lg text-app-primary">
                                <Target size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-app-success">Transaction Posting Rules</h3>
                                <p className="text-xs text-app-success">Link operations (Sales, Purchases) to specific accounts.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/finance/settings/posting-rules')}
                            className="bg-app-surface border border-app-success text-app-success hover:bg-app-primary-light px-4 py-2 rounded text-xs font-bold shadow-sm"
                        >
                            Configure Auto-Mapping
                        </button>
                    </div>
                    {/* ─── FIXED ASSET INTELLIGENCE STRATEGY ─── */}
                    <div className="p-6 bg-gradient-to-br from-indigo-50/50 via-white to-stone-50 border border-app-primary/30 rounded-3xl shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-app-primary rounded-xl text-app-foreground shadow-lg shadow-indigo-100">
                                    <Package size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-app-foreground uppercase tracking-tight">Asset Intelligence Strategy</h3>
                                    <p className="text-xs text-app-primary font-bold uppercase tracking-widest">Universal Asset Management Engine</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-app-surface border border-app-primary/30 rounded-xl shadow-inner">
                                <Activity size={14} className="text-app-primary animate-pulse" />
                                <span className="text-[10px] font-black text-app-primary uppercase">Live Engine Configuration</span>
                            </div>
                        </div>

                        {/* Complexity Mode Selection */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] ml-1">Complexity Mode</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { key: 'BASIC', label: 'Basic', desc: 'Simple list and linear depreciation', icon: Package, color: 'stone' },
                                    { key: 'PROFESSIONAL', label: 'Professional', desc: 'Adds revaluation and schedules', icon: Landmark, color: 'indigo' },
                                    { key: 'ENTERPRISE', label: 'Enterprise', desc: 'Full QR, Maintenance & IFRS', icon: Zap, color: 'emerald' },
                                ].map(mode => (
                                    <button
                                        key={mode.key}
                                        type="button"
                                        onClick={() => setValue('assetTrackingMode', mode.key as any)}
                                        className={`relative group p-4 rounded-2xl border-2 transition-all text-left overflow-hidden ${watch('assetTrackingMode') === mode.key
                                            ? 'border-app-primary/30 bg-app-surface shadow-xl shadow-indigo-100'
                                            : 'border-app-border bg-app-surface/50 hover:border-app-border hover:bg-app-surface'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg w-fit mb-3 transition-colors ${watch('assetTrackingMode') === mode.key ? 'bg-app-primary text-app-foreground' : 'bg-app-border text-app-muted-foreground group-hover:bg-app-surface-2'}`}>
                                            <mode.icon size={18} />
                                        </div>
                                        <h4 className="text-xs font-black text-app-foreground uppercase tracking-tighter">{mode.label}</h4>
                                        <p className="text-[9px] text-app-muted-foreground font-medium leading-tight mt-1">{mode.desc}</p>
                                        {watch('assetTrackingMode') === mode.key && (
                                            <div className="absolute top-2 right-2 flex gap-0.5">
                                                <div className="w-1 h-3 bg-app-primary rounded-full" />
                                                <div className="w-1 h-3 bg-app-primary/10 rounded-full" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Power Toggles */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-app-surface rounded-2xl border border-app-border shadow-sm space-y-4">
                                <h4 className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Activity size={12} className="text-app-primary" /> Operational Powers
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-1">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-app-foreground">QR-Code Tracking</span>
                                            <span className="text-[9px] text-app-muted-foreground">Generate physical audit stickers</span>
                                        </div>
                                        <input {...register('enableAssetQR')} type="checkbox" className="h-5 w-5 text-app-primary border-app-border rounded-lg focus:ring-app-primary" />
                                    </div>
                                    <div className="flex items-center justify-between p-1">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-app-foreground">Maintenance Logic</span>
                                            <span className="text-[9px] text-app-muted-foreground">Link assets to service records</span>
                                        </div>
                                        <input {...register('enableAssetMaintenance')} type="checkbox" className="h-5 w-5 text-app-primary border-app-border rounded-lg focus:ring-app-primary" />
                                    </div>
                                    <div className="flex items-center justify-between p-1">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-app-foreground">Automatic Posting</span>
                                            <span className="text-[9px] text-app-muted-foreground">Post depreciation logs automatically</span>
                                        </div>
                                        <input {...register('autoDepreciationPosting')} type="checkbox" className="h-5 w-5 text-app-primary border-app-border rounded-lg focus:ring-app-primary" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-app-surface rounded-2xl border border-app-border shadow-sm space-y-4">
                                <h4 className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <GitCompareArrows size={12} className="text-app-warning" /> Accounting Weapons
                                </h4>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-app-muted-foreground leading-tight">Select depreciation methods available for this organization:</label>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {[
                                            { key: 'LINEAR', label: 'Straight-Line' },
                                            { key: 'DECLINING', label: 'Declining' },
                                            { key: 'DOUBLE_DECLINING', label: 'Double-Declining' },
                                            { key: 'PRODUCTION', label: 'Units of Prod.' },
                                        ].map(method => (
                                            <button
                                                key={method.key}
                                                type="button"
                                                onClick={() => {
                                                    const current = watch('allowedDepreciationMethods') || [];
                                                    if (current.includes(method.key)) {
                                                        setValue('allowedDepreciationMethods', current.filter(m => m !== method.key));
                                                    } else {
                                                        setValue('allowedDepreciationMethods', [...current, method.key]);
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${(watch('allowedDepreciationMethods') || []).includes(method.key)
                                                    ? 'bg-app-warning-bg text-app-warning border border-app-warning'
                                                    : 'bg-app-background text-app-muted-foreground border border-app-border hover:border-app-warning/30'
                                                    }`}
                                            >
                                                {method.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[8px] text-app-muted-foreground italic mt-2 uppercase tracking-tighter">Enterprise mode forces revaluation logic regardless of selection.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── TRADE SUB-TYPES TOGGLE ─── */}
                    <div className="p-4 bg-app-primary/5 rounded-md border border-app-primary/30 flex items-center justify-between">
                        <div className="flex gap-3 items-center">
                            <div className="p-2 bg-app-primary/10 rounded-lg text-app-primary">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-app-primary">Sales & Purchase Sub-Types</h3>
                                <p className="text-xs text-app-primary mt-0.5">
                                    Decompose invoices and POs into Retail / Wholesale / Consignee.
                                    Enables filter pills, badges, and sub-type columns across pages.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={tradeTogglePending}
                            onClick={async () => {
                                setTradeTogglePending(true)
                                try {
                                    await updateTradeSubTypeSettings(!tradeSubTypesEnabled)
                                    setTradeSubTypesEnabled(!tradeSubTypesEnabled)
                                    toast.success(tradeSubTypesEnabled ? 'Trade sub-types disabled' : 'Trade sub-types enabled')
                                } catch {
                                    toast.error('Failed to update setting')
                                } finally {
                                    setTradeTogglePending(false)
                                }
                            }}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${tradeSubTypesEnabled ? 'bg-app-primary' : 'bg-app-surface-2'
                                }`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-app-surface shadow-sm transition-transform ${tradeSubTypesEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>
                    {/* ─── SUBMIT ─── */}
                    <div className="pt-4 border-t border-app-border">
                        <button
                            type="submit"
                            disabled={isPending || isCoreFieldsLocked}
                            className="w-full bg-app-background text-app-foreground px-4 py-2 rounded-md hover:bg-app-surface-2 disabled:opacity-50"
                        >
                            {isPending ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
                {/* ─── MAINTENANCE ZONE ─── */}
                <div className="bg-app-surface p-6 rounded-lg shadow-sm border border-app-border">
                    <h2 className="text-lg font-medium text-rose-600 mb-4 flex items-center gap-2">
                        <ShieldAlert size={20} />
                        Maintenance Zone
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-app-warning-bg border border-app-warning/30 rounded-md p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-app-warning">Recalculate Ledger Balances</h3>
                                <p className="text-xs text-app-warning mt-1">
                                    Rebuilds account balances from scratch based on the posted journal entries.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleRecalculate}
                                disabled={isRecalcPending}
                                className="bg-app-surface border border-app-warning text-app-warning hover:bg-app-warning-bg px-4 py-2 rounded text-xs font-bold shadow-sm"
                            >
                                {isRecalcPending ? 'Processing...' : 'Recalculate Now'}
                            </button>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-md p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider">CRITICAL: Fresh Version (Wipe All Data)</h3>
                                <p className="text-xs text-rose-700 mt-1 font-medium">
                                    DELETES all Products, Orders, Ledger entries, CRM, and Inventory.
                                    <br /> Use this to completely reset the system to a clean state.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsPendingAction({
                                        type: 'wipeAll',
                                        title: 'CRITICAL: Fresh Version',
                                        description: 'This will delete EVERYTHING (Products, Orders, Ledger, Contacts). This cannot be undone. You will start with a completely fresh system.',
                                        variant: 'danger',
                                    })
                                }}
                                disabled={isPending}
                                className="bg-rose-600 border border-rose-700 text-app-foreground hover:bg-rose-700 px-4 py-2 rounded text-xs font-black shadow-lg"
                            >
                                {isPending ? 'Wiping...' : 'FRESH VERSION'}
                            </button>
                        </div>
                        <div className="bg-app-primary-light border border-app-success/30 rounded-md p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-app-success uppercase tracking-wider">Fill Real Data (Seed System)</h3>
                                <p className="text-xs text-app-success mt-1 font-medium">
                                    Fills the database with test products, suppliers, and initial stock.
                                    <br /> Use this to quickly test system functionality.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsPendingAction({
                                        type: 'seedData',
                                        title: 'Seed Test Data?',
                                        description: 'This will populate the database with test products, suppliers, and initial stock.',
                                        variant: 'warning',
                                    })
                                }}
                                disabled={isPending}
                                className="bg-app-primary border border-app-success/30 text-app-foreground hover:bg-app-success px-4 py-2 rounded text-xs font-black shadow-lg"
                            >
                                {isPending ? 'Seeding...' : 'FILL REAL DATA'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>{/* close left column */}
            <ConfirmDialog
                open={settingsPendingAction !== null}
                onOpenChange={(open) => { if (!open) setSettingsPendingAction(null) }}
                onConfirm={() => {
                    if (!settingsPendingAction) return
                    if (settingsPendingAction.type === 'recalculate') {
                        startRecalc(async () => {
                            try {
                                const res = await recalculateAccountBalances()
                                toast(res.success ? 'Success! All account balances have been recalculated.' : 'Recalculation failed.', { icon: res.success ? '✅' : '❌' })
                            } catch (e: unknown) {
                                toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
                            }
                        })
                    } else if (settingsPendingAction.type === 'wipeAll') {
                        startTransition(async () => {
                            try {
                                const { wipeAllOperationalData } = await import('@/app/actions/finance/system')
                                await wipeAllOperationalData()
                                toast.success("System has been completely wiped to a Fresh Version.")
                                router.refresh()
                            } catch (e: unknown) {
                                toast.error("Error: " + (e instanceof Error ? e.message : String(e)))
                            }
                        })
                    } else if (settingsPendingAction.type === 'seedData') {
                        startTransition(async () => {
                            try {
                                const { seedTestData } = await import('@/app/actions/finance/system')
                                await seedTestData()
                                toast.success("Test data has been successfully seeded!")
                                router.refresh()
                            } catch (e: unknown) {
                                toast.error("Error: " + (e instanceof Error ? e.message : String(e)))
                            }
                        })
                    }
                    setSettingsPendingAction(null)
                }}
                title={settingsPendingAction?.title ?? ''}
                description={settingsPendingAction?.description ?? ''}
                confirmText="Confirm"
                variant={settingsPendingAction?.variant ?? 'danger'}
            />
        </div>
    )
}