'use client'

import { useTransition, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { FinancialSettingsState, updateFinancialSettings } from '@/app/actions/finance/settings'
import { type Currency } from '@/app/actions/currencies'
import { ShieldAlert, Target, Lock, GitCompareArrows, X, Pencil, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
    settings: FinancialSettingsState
    lock: { isLocked: boolean; reason: string | null }
    currencies: Currency[]
}

// ────────────────────────────────────────────────────────
// Company Type Definitions
// ────────────────────────────────────────────────────────
const COMPARE_ROWS = [
    { label: 'Pricing Basis', key: 'pricing' },
    { label: 'VAT Handling', key: 'vat' },
    { label: 'VAT Declaration', key: 'vatDeclaration' },
    { label: 'Dual View', key: 'dualView' },
    { label: 'Bookkeeping', key: 'bookkeeping' },
    { label: 'Invoicing', key: 'invoicing' },
    { label: 'Access Control', key: 'accessControl' },
    { label: 'Best For', key: 'bestFor' },
] as const

const COMPANY_TYPES = [
    {
        key: 'REGULAR',
        name: 'Regular (TTC)',
        label: 'REGULAR (TTC Based)',
        description: 'Standard business model. Costs and prices are managed in TTC (Tax Included), simplifying daily pricing and cost entry. VAT is calculated automatically from the TTC amounts.',
        features: ['TTC-based pricing', 'Auto VAT calculation', 'Simple cost entry', 'Standard invoicing'],
        recommended: 'Retail shops, restaurants, small businesses',
        color: 'emerald',
        autoConfig: { worksInTTC: true, declareTVA: false, dualView: false },
        compare: {
            pricing: 'TTC (Tax Included)',
            vat: 'Auto-calculated from TTC',
            vatDeclaration: 'No',
            dualView: 'No',
            bookkeeping: 'Simple',
            invoicing: 'Standard',
            accessControl: 'Single scope',
            bestFor: 'Retail, restaurants',
        }
    },
    {
        key: 'MICRO',
        name: 'Micro Enterprise',
        label: 'MICRO (Percentage Tax)',
        description: 'Simplified taxation for very small businesses. You pay a fixed percentage on total sales and purchases — no detailed VAT declarations needed. Minimal bookkeeping overhead.',
        features: ['Flat tax rate on sales', 'Flat tax rate on purchases', 'No VAT declaration', 'Minimal bookkeeping'],
        recommended: 'Freelancers, sole proprietors, very small businesses',
        color: 'blue',
        autoConfig: { worksInTTC: true, declareTVA: false, dualView: false },
        compare: {
            pricing: 'TTC (Tax Included)',
            vat: 'Flat % on sales/purchases',
            vatDeclaration: 'No',
            dualView: 'No',
            bookkeeping: 'Minimal',
            invoicing: 'Simplified',
            accessControl: 'Single scope',
            bestFor: 'Freelancers, sole proprietors',
        }
    },
    {
        key: 'REAL',
        name: 'Real (Standard VAT)',
        label: 'REAL (Standard VAT)',
        description: 'Professional accounting regime ("Régime Réel"). All amounts are entered in HT (Hors Taxe). VAT is tracked in detail — Collected vs. Paid — requiring formal invoices and explicit tax handling.',
        features: ['HT-based entry', 'VAT Collected vs Paid', 'Formal invoicing', 'Official VAT declaration'],
        recommended: 'Medium-large businesses, formal accounting requirements',
        color: 'violet',
        autoConfig: { worksInTTC: false, declareTVA: true, dualView: false },
        compare: {
            pricing: 'HT (Hors Taxe)',
            vat: 'Collected vs Paid tracking',
            vatDeclaration: 'Yes — full declaration',
            dualView: 'No',
            bookkeeping: 'Professional',
            invoicing: 'Formal with VAT lines',
            accessControl: 'Single scope',
            bestFor: 'Medium-large businesses',
        }
    },
    {
        key: 'MIXED',
        name: 'Dual View (Mixed)',
        label: 'MIXED (Dual View)',
        description: 'Maintains two parallel accounting scopes: Official (declared to government) and Internal (full picture including undeclared operations). Each scope has independent ledger entries. Access to Official data can be PIN-protected.',
        features: ['Official scope (declared)', 'Internal scope (full picture)', 'Dual ledger entries', 'PIN-protected official access', 'Scope-aware reports'],
        recommended: 'Businesses needing dual-scope reporting and access control',
        color: 'amber',
        autoConfig: { worksInTTC: true, declareTVA: true, dualView: true },
        compare: {
            pricing: 'TTC (Tax Included)',
            vat: 'Full tracking per scope',
            vatDeclaration: 'Yes — official scope only',
            dualView: 'Yes — Official + Internal',
            bookkeeping: 'Dual ledger',
            invoicing: 'Scope-aware',
            accessControl: 'Per-user passwords',
            bestFor: 'Dual-scope reporting',
        }
    },
    {
        key: 'CUSTOM',
        name: 'Custom Configuration',
        label: 'CUSTOM (Manual Config)',
        description: 'Full manual control over every setting. Toggle TTC/HT modes, VAT declarations, and Dual View independently. For advanced users who need a configuration that doesn\'t fit standard profiles.',
        features: ['Manual TTC/HT toggle', 'Manual VAT toggle', 'Optional dual view', 'Custom tax rules'],
        recommended: 'Consultants, advanced accountants, specific setups',
        color: 'stone',
        autoConfig: null,
        compare: {
            pricing: 'Manual (TTC or HT)',
            vat: 'Manual configuration',
            vatDeclaration: 'Optional',
            dualView: 'Optional',
            bookkeeping: 'Fully configurable',
            invoicing: 'Configurable',
            accessControl: 'Configurable',
            bestFor: 'Advanced users',
        }
    }
]

const COLOR_MAP: Record<string, { bg: string, border: string, badge: string, text: string, dot: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', text: 'text-blue-700', dot: 'bg-blue-500' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', text: 'text-violet-700', dot: 'bg-violet-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700', dot: 'bg-amber-500' },
    stone: { bg: 'bg-stone-50', border: 'border-stone-200', badge: 'bg-stone-200 text-stone-700', text: 'text-stone-700', dot: 'bg-stone-500' },
}

// ─── Type Detail Card ───
function TypeDetailCard({ type, compact = false }: { type: typeof COMPANY_TYPES[0], compact?: boolean }) {
    const colors = COLOR_MAP[type.color]
    return (
        <div className={`${colors.bg} ${colors.border} border rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                <h4 className={`text-sm font-bold ${colors.text}`}>{type.name}</h4>
            </div>
            <p className={`text-xs text-stone-600 leading-relaxed ${compact ? 'line-clamp-3' : ''} mb-3`}>
                {type.description}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
                {type.features.map(f => (
                    <span key={f} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>{f}</span>
                ))}
            </div>
            <p className="text-[10px] text-stone-400 italic mt-2">
                Best for: {type.recommended}
            </p>
        </div>
    )
}

// ─── Edit Confirmation Modal ───
function EditConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-stone-900">Unlock Settings?</h3>
                        <p className="text-xs text-stone-500">This will allow editing core financial settings</p>
                    </div>
                </div>
                <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                    These settings are locked because they have already been saved and applied. Modifying them
                    may affect existing transactions and reports. Are you sure you want to unlock and edit?
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                    >
                        Yes, Unlock Settings
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function FinancialSettingsForm({ settings, lock, currencies }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { register, handleSubmit, watch, setValue } = useForm<FinancialSettingsState>({
        defaultValues: settings
    })
    const [isRecalcPending, startRecalc] = useTransition()
    const [showCompare, setShowCompare] = useState(false)
    const [compareType, setCompareType] = useState<string>('')
    const [showEditConfirm, setShowEditConfirm] = useState(false)

    // Settings lock: after save, core fields are locked until user explicitly unlocks
    const [settingsAreSaved, setSettingsAreSaved] = useState(() => {
        // If currency and defaultTaxRate have values, settings were previously saved
        return !!(settings.currency && settings.defaultTaxRate !== undefined && settings.defaultTaxRate !== null)
    })
    const [isUnlocked, setIsUnlocked] = useState(false)

    const isCoreFieldsLocked = lock.isLocked || (settingsAreSaved && !isUnlocked)

    const companyType = watch('companyType')
    const dualView = watch('dualView')

    const selectedType = COMPANY_TYPES.find(t => t.key === companyType)
    const compareTypeObj = COMPANY_TYPES.find(t => t.key === compareType)

    // Auto-configure settings when company type changes
    useEffect(() => {
        const type = COMPANY_TYPES.find(t => t.key === companyType)
        if (type?.autoConfig) {
            Object.entries(type.autoConfig).forEach(([key, value]) => {
                setValue(key as keyof FinancialSettingsState, value)
            })
        }
    }, [companyType, setValue])

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
            <div className={`space-y-8 transition-all duration-300 ${showCompare ? 'w-1/2 shrink-0' : 'max-w-3xl w-full'}`}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-stone-200">
                    {/* Lock Status Warning */}
                    {lock.isLocked && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-start">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-900">Accounting Integrity Lock Active</h3>
                                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                    {lock.reason}
                                    <br />
                                    <span className="font-bold">Structural core configuration fields have been set to read-only.</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Settings Saved Lock Banner */}
                    {settingsAreSaved && !isUnlocked && !lock.isLocked && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3 items-center justify-between">
                            <div className="flex gap-3 items-start">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-blue-900">Settings Locked</h3>
                                    <p className="text-xs text-blue-700 mt-0.5">
                                        Core settings are locked after saving. Click Edit to modify.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleUnlockRequest}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                                <Pencil size={12} />
                                Edit
                            </button>
                        </div>
                    )}

                    {/* ─── COMPANY TYPE ─── */}
                    <div>
                        <h2 className="text-lg font-medium text-stone-900 mb-4">Core Configuration</h2>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-stone-700">Company Type</label>
                                <button
                                    type="button"
                                    onClick={() => { setShowCompare(!showCompare); if (!compareType) setCompareType(COMPANY_TYPES.find(t => t.key !== companyType)?.key || '') }}
                                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    <GitCompareArrows size={14} />
                                    {showCompare ? 'Hide Comparison' : 'Compare Types'}
                                </button>
                            </div>

                            <select
                                {...register('companyType')}
                                disabled={isCoreFieldsLocked}
                                className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:ring-black focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
                            >
                                {COMPANY_TYPES.map(t => (
                                    <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-stone-500">
                                Determines how costs, prices, and taxes are calculated.
                            </p>

                            {/* Selected Type Detail */}
                            {selectedType && (
                                <div className="mt-3">
                                    <TypeDetailCard type={selectedType} />
                                </div>
                            )}


                        </div>

                        {/* Currency & Tax */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Default Currency</label>
                                <select
                                    {...register('currency')}
                                    disabled={isCoreFieldsLocked}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:ring-black focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
                                >
                                    <option value="">Select currency...</option>
                                    {currencies.map(c => (
                                        <option key={c.id} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-stone-400">
                                    Manage currencies in{' '}
                                    <a href="/saas/currencies" className="text-indigo-600 hover:underline">
                                        SaaS → Currencies
                                    </a>
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Standard TVA Rate</label>
                                <input
                                    {...register('defaultTaxRate', { valueAsNumber: true })}
                                    disabled={isCoreFieldsLocked}
                                    type="number" step="0.01"
                                    className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm disabled:bg-stone-100 disabled:text-stone-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ─── DUAL VIEW / OFFICIAL ACCESS ─── */}
                    {(dualView || companyType === 'MIXED') && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                                    <ShieldAlert size={16} />
                                </div>
                                <h3 className="text-sm font-bold text-amber-900">Dual View Active</h3>
                            </div>

                            <p className="text-xs text-amber-700 mb-4 leading-relaxed">
                                Two scopes are active: <strong>Official</strong> (declared/posted data) and <strong>Internal</strong> (full picture).
                                The scope toggle appears in the sidebar. Each user has separate credentials for each scope.
                            </p>

                            {/* Scope Preview */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="p-3 bg-white rounded-lg border border-amber-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-bold text-stone-900">Official</span>
                                    </div>
                                    <p className="text-[10px] text-stone-500 leading-relaxed">
                                        Declared transactions only. Government-reported data.
                                        Access via <strong>Viewer Password</strong>.
                                    </p>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-amber-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-stone-500" />
                                        <span className="text-xs font-bold text-stone-900">Internal</span>
                                    </div>
                                    <p className="text-[10px] text-stone-500 leading-relaxed">
                                        Full picture — all operations including undeclared.
                                        Access via <strong>Full Access Password</strong>.
                                    </p>
                                </div>
                            </div>

                            {/* Per-User Access Info */}
                            <div className="bg-white rounded-lg border border-amber-200 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lock size={14} className="text-amber-600" />
                                    <span className="text-sm font-bold text-stone-900">Scope Access Control</span>
                                </div>
                                <p className="text-xs text-stone-600 leading-relaxed">
                                    Each user has <strong>two passwords</strong> when Dual View is enabled:
                                </p>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600">
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                        <span><strong>Viewer Password</strong> — grants read-only access to Official (posted/declared) data</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-stone-500 mt-1.5 shrink-0" />
                                        <span><strong>Full Access Password</strong> — grants full access to Internal scope (complete picture)</span>
                                    </li>
                                </ul>
                                <p className="text-[10px] text-stone-400 mt-3 italic">
                                    Manage user scope passwords in HR &amp; Teams → Access Control.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ─── CUSTOM FLAGS ─── */}
                    {companyType === 'CUSTOM' && (
                        <div className="p-4 bg-stone-50 rounded-md border border-stone-100">
                            <h3 className="text-sm font-medium text-stone-900 mb-3">Manual Configuration</h3>
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <input {...register('worksInTTC')} disabled={isCoreFieldsLocked} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded disabled:opacity-50" />
                                    <label className="ml-2 text-sm text-stone-700">Works in TTC (Cost Effective Basis is TTC)</label>
                                </div>
                                <div className="flex items-center">
                                    <input {...register('allowHTEntryForTTC')} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded" />
                                    <label className="ml-2 text-sm text-stone-700">Allow HT Entry (Auto-convert to TTC)</label>
                                </div>
                                <div className="flex items-center">
                                    <input {...register('declareTVA')} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded" />
                                    <label className="ml-2 text-sm text-stone-700">Declare TVA (Official)</label>
                                </div>
                                <div className="flex items-center">
                                    <input {...register('dualView')} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded" />
                                    <label className="ml-2 text-sm text-stone-700">Enable Dual View (Official / Internal)</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── MICRO TAX RULES ─── */}
                    {companyType === 'MICRO' && (
                        <div className="p-4 bg-blue-50 rounded-md border border-blue-100">
                            <h3 className="text-sm font-medium text-blue-900 mb-3">Micro Tax Rules</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-blue-700 mb-1">Sales Tax %</label>
                                    <input
                                        {...register('salesTaxPercentage', { valueAsNumber: true })}
                                        type="number" step="0.01"
                                        className="w-full px-3 py-2 border border-blue-200 rounded-md shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-blue-700 mb-1">Purchase Tax %</label>
                                    <input
                                        {...register('purchaseTaxPercentage', { valueAsNumber: true })}
                                        type="number" step="0.01"
                                        className="w-full px-3 py-2 border border-blue-200 rounded-md shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── POSTING RULES ─── */}
                    <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100 flex items-center justify-between">
                        <div className="flex gap-3 items-center">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <Target size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-emerald-900">Transaction Posting Rules</h3>
                                <p className="text-xs text-emerald-700">Link operations (Sales, Purchases) to specific accounts.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/finance/settings/posting-rules')}
                            className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded text-xs font-bold shadow-sm"
                        >
                            Configure Auto-Mapping
                        </button>
                    </div>

                    {/* ─── SUBMIT ─── */}
                    <div className="pt-4 border-t border-stone-200">
                        <button
                            type="submit"
                            disabled={isPending || isCoreFieldsLocked}
                            className="w-full bg-black text-white px-4 py-2 rounded-md hover:bg-stone-800 disabled:opacity-50"
                        >
                            {isPending ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>

                {/* ─── MAINTENANCE ZONE ─── */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
                    <h2 className="text-lg font-medium text-rose-600 mb-4 flex items-center gap-2">
                        <ShieldAlert size={20} />
                        Maintenance Zone
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-100 rounded-md p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-amber-900">Recalculate Ledger Balances</h3>
                                <p className="text-xs text-amber-700 mt-1">
                                    Rebuilds account balances from scratch based on the posted journal entries.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleRecalculate}
                                disabled={isRecalcPending}
                                className="bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded text-xs font-bold shadow-sm"
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
                                className="bg-rose-600 border border-rose-700 text-white hover:bg-rose-700 px-4 py-2 rounded text-xs font-black shadow-lg"
                            >
                                {isPending ? 'Wiping...' : 'FRESH VERSION'}
                            </button>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 rounded-md p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Fill Real Data (Seed System)</h3>
                                <p className="text-xs text-emerald-700 mt-1 font-medium">
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
                                className="bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 px-4 py-2 rounded text-xs font-black shadow-lg"
                            >
                                {isPending ? 'Seeding...' : 'FILL REAL DATA'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>{/* close left column */}

            {/* ─── RIGHT COLUMN: Type Comparison ─── */}
            {showCompare && (
                <div className="w-1/2 shrink-0 sticky top-6">
                    <div className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden">
                        {/* Panel Header */}
                        <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between border-b border-indigo-200">
                            <div className="flex items-center gap-2">
                                <GitCompareArrows size={14} className="text-indigo-600" />
                                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Type Comparison</h3>
                            </div>
                            <button type="button" onClick={() => setShowCompare(false)} className="text-indigo-400 hover:text-indigo-600 p-0.5">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Two Type Column Headers */}
                        <div className="grid grid-cols-2 border-b border-indigo-100">
                            {/* Current Type Header */}
                            <div className="px-4 py-3 bg-indigo-50/40 border-r border-indigo-100">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Current</p>
                                {selectedType && (
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-full ${COLOR_MAP[selectedType.color].dot}`} />
                                        <span className={`text-sm font-bold ${COLOR_MAP[selectedType.color].text}`}>{selectedType.name}</span>
                                    </div>
                                )}
                            </div>
                            {/* Compare Type Header */}
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Compare With</p>
                                <select
                                    value={compareType}
                                    onChange={e => setCompareType(e.target.value)}
                                    className="w-full px-2 py-1 border border-stone-200 rounded text-sm font-semibold bg-white focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {COMPANY_TYPES.filter(t => t.key !== companyType).map(t => (
                                        <option key={t.key} value={t.key}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Feature Rows */}
                        <div>
                            {COMPARE_ROWS.map((row, i) => (
                                <div key={row.key}>
                                    {/* Feature Label — full width */}
                                    <div className={`px-4 py-1.5 bg-stone-50 ${i > 0 ? 'border-t border-stone-200' : ''}`}>
                                        <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">{row.label}</span>
                                    </div>
                                    {/* Two value columns */}
                                    <div className="grid grid-cols-2">
                                        <div className="px-4 py-2 bg-indigo-50/20 border-r border-stone-100">
                                            <span className="text-[12px] text-stone-700">{selectedType?.compare[row.key] || '—'}</span>
                                        </div>
                                        <div className="px-4 py-2">
                                            <span className="text-[12px] text-stone-700">{compareTypeObj?.compare[row.key] || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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