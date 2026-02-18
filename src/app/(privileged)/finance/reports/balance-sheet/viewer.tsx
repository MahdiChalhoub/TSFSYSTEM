'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { getBalanceSheetReport } from '@/app/actions/finance/accounts'
import { Printer, Calendar, ShieldCheck, Landmark, PieChart, ChevronRight, ChevronDown, Target, AlertTriangle, X, Search, Sparkles } from 'lucide-react'
import { diagnoseFinancialDiscrepancy, healLedgerResidues } from '@/app/actions/finance/diagnostics'
import { useRouter } from 'next/navigation'

export default function BalanceSheetViewer({ initialData, fiscalYears }: { initialData: any, fiscalYears: any[] }) {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()
    const [showDiagnostics, setShowDiagnostics] = useState(false)
    const [diagnostics, setDiagnostics] = useState<Record<string, unknown>[]>([])
    const [mounted, setMounted] = useState(false)
    const [isHealing, setIsHealing] = useState(false)
    const router = useRouter()

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleRefresh = () => {
        startTransition(async () => {
            const report = await getBalanceSheetReport(new Date(asOfDate))
            setData(report)
        })
    }

    const runDiagnostics = async () => {
        const issues = await diagnoseFinancialDiscrepancy()
        setDiagnostics(issues)
    }

    useEffect(() => {
        if (showDiagnostics) {
            runDiagnostics()
        }
    }, [showDiagnostics])

    const handleAction = async (issue: any) => {
        if (issue.action === 'HEAL_RESIDUE') {
            setIsHealing(true)
            await healLedgerResidues()
            await runDiagnostics()
            handleRefresh()
            setIsHealing(false)
        } else if (issue.action) {
            router.push(issue.action)
        }
    }

    const { assets, liabilities, equity, totalAssets, totalLiabEq } = useMemo(() => {
        const accounts = data.accounts as any[]
        const ass = accounts.filter(a => a.type === 'ASSET' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const liab = accounts.filter(a => a.type === 'LIABILITY' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
        const eq = accounts.filter(a => a.type === 'EQUITY' && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))

        const totalAss = ass.reduce((sum, a) => sum + a.balance, 0)
        const totalLiab = liab.reduce((sum, a) => sum + a.balance, 0)
        const totalEq = eq.reduce((sum, a) => sum + a.balance, 0) + data.netProfit

        return {
            assets: ass,
            liabilities: liab,
            equity: eq,
            totalAssets: totalAss,
            totalLiabEq: totalLiab + totalEq
        }
    }, [data])

    const isBalanced = Math.abs(totalAssets - totalLiabEq) < 0.01

    const formatAmount = (val: number) => {
        if (!mounted) return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        return val.toLocaleString(undefined, { minimumFractionDigits: 2 })
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-wrap items-end justify-between gap-4 print:hidden">
                <div className="flex gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                            <Calendar size={12} /> Statement As Of
                        </label>
                        <input
                            type="date"
                            value={asOfDate}
                            onChange={e => setAsOfDate(e.target.value)}
                            className="border border-stone-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="bg-stone-900 text-white px-6 py-2.5 rounded-lg hover:bg-black font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isPending ? 'Revaluing...' : 'Generate Statement'}
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => window.print()}
                        className="bg-white text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 font-bold text-sm shadow-sm flex items-center gap-2"
                    >
                        <Printer size={18} /> Print PDF
                    </button>
                </div>
            </div>

            {/* Health Status */}
            {!isPending && (
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${isBalanced ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    <div className="flex items-center gap-4">
                        {isBalanced ? <ShieldCheck className="text-emerald-500" /> : <PieChart className="text-rose-500 animate-pulse" />}
                        <div>
                            <p className="font-bold text-sm">{isBalanced ? 'Statement In Balance' : 'Account Discrepancy Detected'}</p>
                            <p className="text-xs opacity-75">{isBalanced ? 'Assets perfectly match Liabilities and Equity.' : `There is a difference of ${(totalAssets - totalLiabEq).toFixed(2)} between your assets and claims.`}</p>
                        </div>
                    </div>
                    {!isBalanced && (
                        <button
                            onClick={() => setShowDiagnostics(true)}
                            className="bg-rose-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg hover:bg-rose-700 transition-all flex items-center gap-2"
                        >
                            <Target size={14} /> Troubleshoot Difference
                        </button>
                    )}
                </div>
            )}

            {/* Main Statement Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                {/* Left Side: ASSETS */}
                <div className="bg-white rounded-3xl shadow-xl shadow-stone-100 border border-stone-200 overflow-hidden">
                    <div className="bg-stone-900 p-6 text-white flex items-center gap-3">
                        <Landmark size={20} className="text-emerald-400" />
                        <h2 className="font-serif text-xl font-bold italic">Assets</h2>
                    </div>
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-stone-50">
                            {assets.map(acc => (
                                <ReportRow key={acc.id} account={acc} allAccounts={data.accounts} level={0} formatAmount={formatAmount} />
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-stone-50 font-black border-t-2 border-stone-100">
                                <td className="p-6 text-right uppercase tracking-[0.2em] text-[10px] text-stone-400">Total Assets</td>
                                <td className="p-6 text-right font-mono text-xl text-stone-900">
                                    {formatAmount(totalAssets)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Right Side: LIABILITIES & EQUITY */}
                <div className="space-y-8">
                    {/* Liabilities */}
                    <div className="bg-white rounded-3xl shadow-xl shadow-stone-100 border border-stone-200 overflow-hidden">
                        <div className="bg-stone-800 p-6 text-white flex items-center gap-3">
                            <PieChart size={20} className="text-amber-400" />
                            <h2 className="font-serif text-xl font-bold italic">Liabilities</h2>
                        </div>
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-stone-50">
                                {liabilities.map(acc => (
                                    <ReportRow key={acc.id} account={acc} allAccounts={data.accounts} level={0} formatAmount={formatAmount} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Equity */}
                    <div className="bg-white rounded-3xl shadow-xl shadow-stone-100 border border-stone-200 overflow-hidden">
                        <div className="bg-stone-700 p-6 text-white flex items-center gap-3">
                            <ShieldCheck size={20} className="text-sky-400" />
                            <h2 className="font-serif text-xl font-bold italic">Equity</h2>
                        </div>
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-stone-50">
                                {equity.map(acc => (
                                    <ReportRow key={acc.id} account={acc} allAccounts={data.accounts} level={0} formatAmount={formatAmount} />
                                ))}
                                {/* Virtual Profit Account */}
                                <tr className="group bg-blue-50/30 italic">
                                    <td className="p-4 pl-6 text-blue-800">
                                        <div className="flex flex-col">
                                            <span className="font-bold">Current Period Earnings</span>
                                            <span className="text-[10px] font-medium opacity-60">Net Profit from Income Statement</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-blue-900">
                                        {formatAmount(data.netProfit)}
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr className="bg-stone-50 font-black border-t-2 border-stone-100">
                                    <td className="p-6 text-right uppercase tracking-[0.2em] text-[10px] text-stone-400">Total Liab. & Equity</td>
                                    <td className="p-6 text-right font-mono text-xl text-stone-900">
                                        {formatAmount(totalLiabEq)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>

            <div className="text-center py-10 opacity-30 text-[10px] font-bold uppercase tracking-[0.3em] font-mono">
                {mounted && `Institutional Financial Integrity Header • ${new Date().toLocaleDateString()}`}
            </div>

            {/* Diagnostics Modal */}
            {showDiagnostics && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-stone-200 animate-in zoom-in-95 duration-300">
                        <div className="p-8 bg-stone-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Target size={24} className="text-rose-400" />
                                <div>
                                    <h3 className="text-xl font-bold font-serif italic">Financial Forensic Diagnosis</h3>
                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">Automated discrepancy troubleshooter</p>
                                </div>
                            </div>
                            <button onClick={() => setShowDiagnostics(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                            {diagnostics.length === 0 ? (
                                <div className="text-center py-10 space-y-4">
                                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-300">
                                        <Search size={32} />
                                    </div>
                                    <p className="text-stone-500 font-medium italic">No deep structural errors found in ledger entries. Checking for opening balance alignment...</p>
                                </div>
                            ) : (
                                diagnostics.map((issue, idx) => (
                                    <div key={idx} className={`p-5 rounded-2xl border flex gap-4 ${issue.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                        <AlertTriangle size={24} className={issue.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'} />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-stone-900">{issue.title}</h4>
                                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">{issue.description}</p>
                                            {issue.action && (
                                                <button
                                                    onClick={() => handleAction(issue)}
                                                    disabled={isHealing}
                                                    className="mt-3 text-xs font-bold text-stone-900 flex items-center gap-1 hover:underline disabled:opacity-50"
                                                >
                                                    {issue.action === 'HEAL_RESIDUE' ? (
                                                        <span className="flex items-center gap-1 text-emerald-600">
                                                            <Sparkles size={14} /> {isHealing ? 'Healing...' : 'Sweep to Active Accounts'}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            Fix This Entry <ChevronRight size={14} />
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* Standard Education Guide */}
                            <div className="mt-8 p-6 bg-stone-50 rounded-2xl border border-stone-200">
                                <h4 className="font-bold text-xs uppercase tracking-widest text-stone-400 mb-4">Standard Resolution Guide</h4>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3 text-xs text-stone-600">
                                        <div className="w-1.5 h-1.5 bg-stone-400 rounded-full mt-1.5" />
                                        <span>Check <strong>Trial Balance</strong> to see if Credits match Debits.</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-xs text-stone-600">
                                        <div className="w-1.5 h-1.5 bg-stone-400 rounded-full mt-1.5" />
                                        <span>Ensure <strong>Opening Balances</strong> are balanced (A = L + E).</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-xs text-stone-600">
                                        <div className="w-1.5 h-1.5 bg-stone-400 rounded-full mt-1.5" />
                                        <span>Verify that <strong>Income/Expense</strong> accounts aren't mixed into Assets.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
                            <button
                                onClick={() => setShowDiagnostics(false)}
                                className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-stone-200 transition-all"
                            >
                                I understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ReportRow({ account, level, allAccounts, formatAmount }: any) {
    const [expanded, setExpanded] = useState(level < 1)
    const isParent = account.children && account.children.length > 0
    const hasBalance = Math.abs(account.balance) > 0.001

    if (!hasBalance && !isParent) return null

    return (
        <>
            <tr className={`group transition-colors ${isParent ? 'bg-stone-50/40 font-bold' : 'hover:bg-stone-50/30'}`}>
                <td className="p-4" style={{ paddingLeft: `${level * 24 + 24}px` }}>
                    <div className="flex items-center gap-3">
                        {isParent && (
                            <button onClick={() => setExpanded(!expanded)} className="text-stone-300 hover:text-stone-900 transition-colors">
                                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        )}
                        <span className="text-stone-400 font-mono text-[10px] mr-2 opacity-0 group-hover:opacity-100 transition-opacity">{account.code}</span>
                        <span className={isParent ? 'text-stone-900' : 'text-stone-600'}>{account.name}</span>
                    </div>
                </td>
                <td className="p-4 text-right font-mono font-medium text-stone-800">
                    {formatAmount(account.balance)}
                </td>
            </tr>
            {isParent && expanded && account.children.map((childId: any) => {
                const child = typeof childId === 'object' ? childId : allAccounts.find((a: any) => a.id === childId)
                if (!child) return null
                return <ReportRow key={child.id} account={child} level={level + 1} allAccounts={allAccounts} formatAmount={formatAmount} />
            })}
        </>
    )
}