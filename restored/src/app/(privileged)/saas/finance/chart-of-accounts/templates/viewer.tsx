'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, CheckCircle2, LayoutGrid, Columns, Undo2, Library, Zap, FileText, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'

export default function CoaTemplatesLibrary({ templates }: { templates: any }) {
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    const toggleTemplate = (key: string) => {
        if (selectedTemplates.includes(key)) {
            setSelectedTemplates(selectedTemplates.filter(k => k !== key))
        } else {
            // Max 2 or 3 for comparison? Let's allow any but visually it works best with 2-3
            setSelectedTemplates([...selectedTemplates, key])
        }
    }

    const handleImport = async (key: string) => {
        if (!confirm(`Import ${key}? Existing accounts will be kept unless you click "Clean Import" in the next prompt.`)) return
        const reset = confirm("Perform a Clean Reset? (Deletes ALL existing accounts first - only works if zero transactions exist)")

        setIsPending(true)
        try {
            await importChartOfAccountsTemplate(key as any, { reset })
            alert(`Successfully imported ${key}`)
            router.push('/admin/finance/chart-of-accounts')
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="min-h-screen bg-stone-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-stone-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                            <Undo2 size={20} className="text-stone-500" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-stone-900 font-serif">Accounting Standards Library</h1>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Compare and select your operational layout</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-stone-100 p-1 rounded-lg flex gap-1">
                            <button className="p-2 bg-white shadow-sm rounded-md text-stone-900">
                                <Columns size={18} />
                            </button>
                            <button disabled className="p-2 text-stone-400 hover:text-stone-600">
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Logic Guide */}
            <div className="max-w-[1600px] mx-auto px-8 py-6">
                <div className="bg-emerald-900 rounded-3xl p-6 text-white flex flex-wrap items-center gap-8 shadow-lg">
                    <div className="flex items-center gap-3 border-r border-emerald-800 pr-8">
                        <ShieldCheck className="text-emerald-400" size={32} />
                        <div>
                            <h4 className="font-bold text-sm">Financial Integrity Guide</h4>
                            <p className="text-[10px] text-emerald-300 uppercase tracking-widest">How your reports are calculated</p>
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">Balance Sheet [BS]</span>
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <span className="p-1 bg-emerald-800 rounded">Assets</span>
                                <span>=</span>
                                <span className="p-1 bg-emerald-800 rounded">Liabilities</span>
                                <span>+</span>
                                <span className="p-1 bg-emerald-800 rounded">Equity</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-amber-400 uppercase">Profit & Loss [P&L]</span>
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <span className="p-1 bg-amber-800 rounded">Revenue</span>
                                <span>-</span>
                                <span className="p-1 bg-amber-800 rounded">Expenses</span>
                                <span>=</span>
                                <span className="p-1 bg-amber-800/50 border border-amber-400 rounded text-amber-200 italic font-bold">Net Profit</span>
                            </div>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-4 text-[10px] text-emerald-300 font-bold uppercase tracking-widest bg-emerald-950/50 px-4 py-2 rounded-full">
                        <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Auto-Rollup Logic</span>
                        <span className="opacity-30">|</span>
                        <span className="flex items-center gap-1"><FileText size={12} /> Double Entry (GAAP/IFRS)</span>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto p-8 pt-0">
                {/* Selection Bar */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
                    {Object.keys(templates).map(key => (
                        <button
                            key={key}
                            onClick={() => toggleTemplate(key)}
                            className={`flex-shrink-0 px-6 py-3 rounded-2xl border transition-all flex items-center gap-3 ${selectedTemplates.includes(key)
                                ? 'bg-stone-900 border-stone-900 text-white shadow-xl shadow-stone-200'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                                }`}
                        >
                            {selectedTemplates.includes(key) ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Library size={16} />}
                            <span className="font-bold text-sm whitespace-nowrap">{key.replace('_', ' ')}</span>
                        </button>
                    ))}
                </div>

                {selectedTemplates.length === 0 ? (
                    <div className="h-[60vh] flex flex-col items-center justify-center text-stone-300">
                        <Library size={64} className="mb-4 opacity-20" />
                        <h2 className="text-xl font-medium">Select standards to compare</h2>
                        <p className="text-sm">Choose one or more templates from the library above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                        {selectedTemplates.map(key => (
                            <div key={key} className="bg-white rounded-3xl border border-stone-200 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-6 border-b border-stone-100 flex justify-between items-start bg-stone-50/50">
                                    <div>
                                        <h3 className="font-bold text-stone-900 text-lg">{key.replace('_', ' ')}</h3>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase mt-1 tracking-tight">Official Standard Structure</p>
                                    </div>
                                    <button
                                        disabled={isPending}
                                        onClick={() => handleImport(key)}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                                    >
                                        <Zap size={14} /> Import
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 max-h-[600px] custom-scrollbar">
                                    <div className="space-y-1">
                                        {templates[key].map((item: any, i: number) => (
                                            <TemplateComparisonNode key={i} item={item} />
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 bg-stone-50 border-t border-stone-100 text-center">
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                        Total Root Classes: {templates[key].length}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function TemplateComparisonNode({ item, level = 0 }: any) {
    const [open, setOpen] = useState(level < 1) // Open top level by default
    const hasChildren = item.children && item.children.length > 0

    return (
        <div className="flex flex-col">
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2 py-1.5 hover:bg-stone-50 rounded px-2 transition-colors group ${level === 0 ? 'bg-stone-50/80 mb-1' : ''}`}
                style={{ paddingLeft: `${level === 0 ? 8 : level * 16 + 8}px` }}
            >
                <div className="w-4 flex justify-center">
                    {hasChildren && (
                        open ? <ChevronDown size={12} className="text-stone-400" /> : <ChevronRight size={12} className="text-stone-300" />
                    )}
                </div>
                <span className={`text-[10px] font-mono font-bold w-12 text-left ${level === 0 ? 'text-stone-900' : 'text-stone-400'}`}>
                    {item.code}
                </span>
                <span className={`text-xs text-left flex-1 truncate ${level === 0 ? 'font-bold text-stone-900' : 'font-medium text-stone-600'}`}>
                    {item.name}
                </span>

                {/* Report Mapping Badge */}
                {item.type && (
                    <div className="flex items-center gap-1.5 mr-2">
                        {['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? (
                            <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1 rounded" title="Goes to Balance Sheet">[BS]</span>
                        ) : (
                            <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1 rounded" title="Goes to Profit & Loss">[P&L]</span>
                        )}

                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${item.type === 'ASSET' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            item.type === 'LIABILITY' ? 'bg-red-50 text-red-600 border border-red-100' :
                                item.type === 'EQUITY' ? 'bg-stone-100 text-stone-600' :
                                    item.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                        'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                            {item.type}
                        </span>
                    </div>
                )}
            </button>
            {hasChildren && open && (
                <div className="flex flex-col">
                    {item.children.map((child: any, i: number) => (
                        <TemplateComparisonNode key={i} item={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}