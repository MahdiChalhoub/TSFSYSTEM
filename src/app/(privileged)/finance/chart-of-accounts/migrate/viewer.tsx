'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, AlertCircle, RefreshCcw, CheckCircle2, ChevronRight, Zap, Library, Layers } from 'lucide-react'
import { migrateBalances, importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { useRouter } from 'next/navigation'

export default function CoaMigrationTool({
    currentAccounts,
    availableTemplates
}: {
    currentAccounts: any[],
    availableTemplates: any
}) {
    const [step, setStep] = useState(1)
    const [selectedTemplate, setSelectedTemplate] = useState<string>('')
    const [mappings, setMappings] = useState<Record<number, number>>({})
    const [targetAccounts, setTargetAccounts] = useState<any[]>([])
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const accountsWithBalance = currentAccounts.filter(a => Math.abs(a.balance) > 0.0001)

    const handleSelectTemplate = (key: string) => {
        setSelectedTemplate(key)
    }

    const handlePrepareTarget = () => {
        if (!selectedTemplate) return
        startTransition(async () => {
            try {
                // Import the template (without reset)
                await importChartOfAccountsTemplate(selectedTemplate as any, { reset: false })

                // Get the updated accounts list from server to use as targets
                const allAccounts = await getChartOfAccounts(false) // Only active ones
                setTargetAccounts(allAccounts)
                setStep(2)
            } catch (err: any) {
                alert('Error preparing target: ' + err.message)
            }
        })
    }

    const handleMap = (sourceId: number, targetId: number) => {
        setMappings(prev => ({ ...prev, [sourceId]: targetId }))
    }

    const handleAutoMap = () => {
        const newMappings = { ...mappings }
        accountsWithBalance.forEach(src => {
            // Find in current target accounts
            const match = targetAccounts.find(t => t.code === src.code || t.name.toLowerCase() === src.name.toLowerCase())
            if (match) newMappings[src.id] = match.id
        })
        setMappings(newMappings)
    }

    const handleMigrate = () => {
        const mappingArray = Object.entries(mappings).map(([srcId, tgtId]) => ({
            sourceId: parseInt(srcId),
            targetId: tgtId
        }))

        if (mappingArray.length === 0 && accountsWithBalance.length > 0) {
            alert("No mappings defined.")
            return
        }

        startTransition(async () => {
            try {
                if (mappingArray.length > 0) {
                    await migrateBalances({
                        mappings: mappingArray,
                        description: `COA Migration to ${selectedTemplate} - ${new Date().toLocaleDateString()}`
                    })
                }
                alert('Success! System switched to the new standard.')
                router.push('/finance/chart-of-accounts')
                router.refresh()
            } catch (err: any) {
                alert('Migration Error: ' + err.message)
            }
        })
    }

    if (step === 1) {
        return (
            <div className="space-y-8 max-w-4xl mx-auto">
                <div className="bg-stone-900 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500/20 p-3 rounded-2xl">
                            <Layers className="text-amber-400" size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-serif italic">Step 1: Choose Your Destination</h2>
                            <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mt-1">Select the standard you want to migrate to</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(availableTemplates).map(key => (
                        <button
                            key={key}
                            onClick={() => handleSelectTemplate(key)}
                            className={`p-6 rounded-3xl border-2 transition-all text-left flex items-start gap-4 ${selectedTemplate === key
                                ? 'border-amber-500 bg-amber-50 shadow-lg'
                                : 'border-stone-100 bg-white hover:border-stone-200'
                                }`}
                        >
                            <Library className={selectedTemplate === key ? 'text-amber-600' : 'text-stone-300'} />
                            <div>
                                <h3 className={`font-bold ${selectedTemplate === key ? 'text-amber-900' : 'text-stone-700'}`}>
                                    {key.replace('_', ' ')}
                                </h3>
                                <p className="text-xs text-stone-500 mt-1">Standard structural hierarchy and account codes.</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex justify-center pt-8">
                    <button
                        onClick={handlePrepareTarget}
                        disabled={!selectedTemplate || isPending}
                        className="bg-stone-900 text-white px-12 py-4 rounded-2xl hover:bg-black font-bold shadow-xl transition-all disabled:opacity-30 flex items-center gap-3"
                    >
                        {isPending ? 'Preparing Layout...' : 'Load Standard & Continue'}
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            {/* Header / Instructions */}
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm border-2">
                <AlertCircle className="text-amber-500 mt-1" size={24} />
                <div className="flex-1">
                    <h3 className="font-bold text-amber-900">Step 2: Map Your Balances</h3>
                    <p className="text-sm text-amber-800 opacity-80 mt-1 leading-relaxed">
                        Your target standard <strong className="uppercase">{selectedTemplate.replace('_', ' ')}</strong> is now loaded.
                        Please match your old accounts with the new ones. Zero-balance accounts will be ignored.
                    </p>
                </div>
                <button
                    onClick={handleAutoMap}
                    className="flex items-center gap-2 text-xs font-bold bg-white text-amber-600 px-4 py-2 rounded-xl border border-amber-200 shadow-sm hover:bg-amber-100 transition-all self-center"
                >
                    <Zap size={14} /> Smart Match
                </button>
            </div>

            {/* Mapping Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-stone-900 text-stone-400 uppercase text-[10px] tracking-widest font-bold">
                            <th className="p-5 text-left w-1/2">Current Layout (Source)</th>
                            <th className="p-5 text-center w-12"></th>
                            <th className="p-5 text-left w-1/2">New Layout (Destination)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                        {accountsWithBalance.map(acc => (
                            <tr key={acc.id} className="hover:bg-stone-50/50 transition-colors">
                                <td className="p-5">
                                    <div className="flex flex-col">
                                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-1 font-mono">{acc.code}</div>
                                        <div className="font-bold text-stone-900">{acc.name}</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{acc.type}</span>
                                            <span className="text-sm font-mono text-emerald-600 font-bold">{acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 text-center">
                                    <ArrowRight className="text-stone-300 mx-auto" size={20} strokeWidth={3} />
                                </td>
                                <td className="p-5">
                                    <select
                                        className="w-full p-3.5 rounded-2xl border border-stone-200 text-sm font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all shadow-sm bg-stone-50/30"
                                        value={mappings[acc.id] || ''}
                                        onChange={(e) => handleMap(acc.id, parseInt(e.target.value))}
                                    >
                                        <option value="">(Select Target Account)</option>
                                        {targetAccounts.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.code} ΓÇö {t.name} [{t.type}]
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {accountsWithBalance.length === 0 && (
                    <div className="p-20 text-center text-stone-400 italic">
                        No accounts with active balances found. You can switch standards freely.
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center bg-stone-50 p-6 rounded-3xl border border-stone-200 shadow-inner">
                <button
                    disabled={isPending}
                    onClick={() => setStep(1)}
                    className="px-8 py-3 rounded-xl font-bold text-stone-500 hover:text-stone-900 transition-all flex items-center gap-2"
                >
                    <RefreshCcw size={16} /> Back to Selection
                </button>
                <div className="flex gap-4">
                    <button
                        disabled={isPending || (accountsWithBalance.length > 0 && Object.keys(mappings).length === 0)}
                        onClick={handleMigrate}
                        className="bg-stone-900 text-white px-12 py-3 rounded-xl hover:bg-black font-bold shadow-xl shadow-stone-900/20 transition-all flex items-center gap-2 disabled:opacity-30"
                    >
                        {isPending ? 'Migrating Data...' : 'Finalize & Post Migration'}
                        {!isPending && <CheckCircle2 size={18} className="text-emerald-400" />}
                    </button>
                </div>
            </div>

            <p className="text-[10px] text-stone-400 font-bold text-center uppercase tracking-widest">
                Warning: This process will post a Reclassification Journal Entry and deactivate mapped accounts.
            </p>
        </div>
    )
}