'use client'

import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { FinancialSettingsState, updateFinancialSettings } from '@/app/actions/finance/settings'
import { ShieldAlert, AlertTriangle, Lightbulb, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
    settings: FinancialSettingsState
    lock: { isLocked: boolean; reason: string | null }
}

const COMPANY_DESCRIPTIONS: Record<string, string> = {
    'REGULAR': "Standard Business. Costs and Prices are typically managed in TTC (Tax Included). Simplifies daily operations.",
    'MICRO': "Simplified Tax Regime. You pay a fixed percentage on Sales and Purchases. No detailed VAT declaration required.",
    'REAL': "Professional Accounting (Reel). You verify VAT (Collected vs Paid). Requires formal invoices and explicit tax handling.",
    'MIXED': "Hybrid System. Supports both 'Official' (Declared) and 'Internal' (Undeclared) transaction scopes simultaneously.",
    'CUSTOM': "Fully Configurable. Manually toggle settings for TTC/HT working modes, VAT declarations, and Dual Views."
}

export default function FinancialSettingsForm({ settings, lock }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { register, handleSubmit, watch } = useForm<FinancialSettingsState>({
        defaultValues: settings
    })
    const [isRecalcPending, startRecalc] = useTransition()

    // Watch for conditional fields
    const companyType = watch('companyType')

    const onSubmit = (data: FinancialSettingsState) => {
        startTransition(async () => {
            try {
                await updateFinancialSettings(data)
                alert('Settings Saved!')
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    const handleRecalculate = () => {
        if (!confirm('Are you sure? This will reset and recalculate all account balances based on the ledger history.')) return

        startRecalc(async () => {
            try {
                const res = await recalculateAccountBalances()
                alert(`Success! Recalculated balances from ${res.count} ledger entries.`)
            } catch (e: any) {
                alert('Error: ' + e.message)
            }
        })
    }

    return (
        <div className="space-y-8 max-w-2xl">
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

                <div>
                    <h2 className="text-lg font-medium text-stone-900 mb-4">Core Configuration</h2>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Company Type */}
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Company Type</label>
                            <select
                                {...register('companyType')}
                                disabled={lock.isLocked}
                                className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:ring-black focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
                            >
                                <option value="REGULAR">REGULAR (TTC Based)</option>
                                <option value="MICRO">MICRO (Percentage Tax)</option>
                                <option value="REAL">REAL (Standard VAT)</option>
                                <option value="MIXED">MIXED (Dual View)</option>
                                <option value="CUSTOM">CUSTOM (Manual Config)</option>
                            </select>
                            <p className="mt-1 text-sm text-stone-500">
                                Determines how costs and prices are calculated.
                            </p>

                            {/* Dynamic Description Hint */}
                            {companyType && COMPANY_DESCRIPTIONS[companyType] && (
                                <div className="mt-3 p-3 bg-stone-50 border border-stone-200 rounded text-sm text-stone-600 flex gap-2 items-start">
                                    <span className="text-lg">≡ƒÆí</span>
                                    <span>{COMPANY_DESCRIPTIONS[companyType]}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Default Currency</label>
                                <input
                                    {...register('currency')}
                                    disabled={lock.isLocked}
                                    type="text"
                                    className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm disabled:bg-stone-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Standard TVA Rate</label>
                                <input
                                    {...register('defaultTaxRate', { valueAsNumber: true })}
                                    type="number" step="0.01"
                                    className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Custom Flags */}
                {(companyType === 'CUSTOM' || companyType === 'REGULAR') && (
                    <div className="p-4 bg-stone-50 rounded-md border border-stone-100">
                        <h3 className="text-sm font-medium text-stone-900 mb-3">Advanced Rules</h3>
                        <div className="space-y-2">
                            <div className="flex items-center">
                                <input {...register('worksInTTC')} disabled={lock.isLocked} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded disabled:opacity-50" />
                                <label className="ml-2 text-sm text-stone-700">Works in TTC (Cost Effective Basis is TTC)</label>
                            </div>
                            <div className="flex items-center">
                                <input {...register('allowHTEntryForTTC')} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded" />
                                <label className="ml-2 text-sm text-stone-700">Allow HT Entry (Auto-convert to TTC)</label>
                            </div>
                            {companyType === 'CUSTOM' && (
                                <>
                                    <div className="flex items-center">
                                        <input {...register('declareTVA')} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded" />
                                        <label className="ml-2 text-sm text-stone-700">Declare TVA (Official)</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input {...register('dualView')} type="checkbox" className="h-4 w-4 text-black border-stone-300 rounded" />
                                        <label className="ml-2 text-sm text-stone-700">Enable Dual View (Official / Internal)</label>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {(companyType === 'MICRO') && (
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
                        onClick={() => router.push('/admin/finance/settings/posting-rules')}
                        className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded text-xs font-bold shadow-sm"
                    >
                        Configure Auto-Mapping
                    </button>
                </div>

                <div className="pt-4 border-t border-stone-200">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-black text-white px-4 py-2 rounded-md hover:bg-stone-800 disabled:opacity-50"
                    >
                        {isPending ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>

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
                            onClick={async () => {
                                if (!confirm("ULTIMATE DANGER: This will delete EVERYTHING (Products, Orders, Ledger, Contacts). This cannot be undone. Proceed?")) return
                                if (!confirm("TOTAL WIPE CONFIRMATION: Start with a Fresh Version?")) return

                                startTransition(async () => {
                                    try {
                                        const { wipeAllOperationalData } = await import('@/app/actions/finance/system')
                                        await wipeAllOperationalData()
                                        alert("System has been completely wiped to a Fresh Version.")
                                        router.refresh()
                                    } catch (e: any) {
                                        alert("Error: " + e.message)
                                    }
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
                            onClick={async () => {
                                if (!confirm("Populate database with test records?")) return

                                startTransition(async () => {
                                    try {
                                        const { seedTestData } = await import('@/app/actions/finance/system')
                                        await seedTestData()
                                        alert("Test data has been successfully seeded!")
                                        router.refresh()
                                    } catch (e: any) {
                                        alert("Error: " + e.message)
                                    }
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
        </div>
    )
}