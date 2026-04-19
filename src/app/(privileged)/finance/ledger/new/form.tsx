'use client'

import { useState, useTransition, useMemo } from 'react'
import { createJournalEntry, updateJournalEntry } from '@/app/actions/finance/ledger'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, FileText, Send, CheckCircle2, Building2, User, LayoutGrid, Hash, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { KPIStrip } from '@/components/ui/KPIStrip'

// Helper to find the correct Fiscal Year/Period for a date
function findFiscalContext(date: string, years: Record<string, any>[]) {
    const d = new Date(date)
    const year = years.find((y: Record<string, any>) => new Date(y.startDate) <= d && new Date(y.endDate) >= d)
    if (!year) return { yearId: null, periodId: null }

    const period = year.periods.find((p: Record<string, any>) => new Date(p.startDate) <= d && new Date(p.endDate) >= d)
    return { yearId: year.id, periodId: period?.id }
}

export default function JournalEntryForm({ 
    accounts, 
    fiscalYears, 
    contacts = [], 
    initialEntry 
}: { 
    accounts: Record<string, any>[], 
    fiscalYears: Record<string, any>[], 
    contacts?: Record<string, any>[], 
    initialEntry?: Record<string, any> 
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [header, setHeader] = useState({
        transactionDate: initialEntry ? new Date(initialEntry.transactionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: initialEntry?.description || '',
        reference: initialEntry?.reference || ''
    })

    const [lines, setLines] = useState(initialEntry?.lines.map((l: Record<string, any>) => ({
        accountId: l.accountId?.toString() || l.account?.id?.toString() || '',
        searchString: `${l.account?.code || ''} ${l.account?.name || ''}`.trim(),
        debit: Number(l.debit) || '',
        credit: Number(l.credit) || '',
        description: l.description || '',
        contactId: l.contactId?.toString() || l.contact?.id?.toString() || '',
        costCenter: l.costCenter || l.cost_center || ''
    })) || [
            { accountId: '', searchString: '', debit: '', credit: '', description: '', contactId: '', costCenter: '' },
            { accountId: '', searchString: '', debit: '', credit: '', description: '', contactId: '', costCenter: '' }
        ])

    const selectableAccounts = useMemo(() => {
        return accounts.sort((a, b) => a.code.localeCompare(b.code))
    }, [accounts])

    const addLine = () => {
        setLines([...lines, { accountId: '', searchString: '', debit: '', credit: '', description: '', contactId: '', costCenter: '' }])
    }

    const removeLine = (index: number) => {
        if (lines.length <= 2) return
        setLines(lines.filter((_: any, i: number) => i !== index))
    }

    const updateLine = (index: number, field: string, value: string) => {
        const newLines = [...lines]
        // @ts-ignore
        newLines[index][field] = value

        if (field === 'searchString') {
            const val = value.toLowerCase()
            const acc = selectableAccounts.find(a =>
                a.code === value.split(' ')[0] ||
                `${a.code} ${a.name}`.toLowerCase() === val
            )

            if (acc) {
                // @ts-ignore
                newLines[index].accountId = acc.id.toString()
                // @ts-ignore
                newLines[index].searchString = `${acc.code} ${acc.name}`
            } else {
                // @ts-ignore
                newLines[index].accountId = ''
            }
        }

        // Auto-clear logic
        if (field === 'debit' && value !== '') {
            // @ts-ignore
            newLines[index].credit = ''
        } else if (field === 'credit' && value !== '') {
            // @ts-ignore
            newLines[index].debit = ''
        }

        setLines(newLines)
    }

    const totalDebit = lines.reduce((sum: number, line: any) => sum + (Number(line.debit) || 0), 0)
    const totalCredit = lines.reduce((sum: number, line: any) => sum + (Number(line.credit) || 0), 0)
    const diff = totalDebit - totalCredit
    const isBalanced = Math.abs(diff) < 0.01

    const fiscalContext = useMemo(() => findFiscalContext(header.transactionDate, fiscalYears), [header.transactionDate, fiscalYears])

    const handleAutoBalance = (idx: number) => {
        const targetDiff = totalCredit - totalDebit
        const newLines = [...lines]
        if (targetDiff > 0) {
            newLines[idx].debit = targetDiff.toFixed(2)
            newLines[idx].credit = ''
        } else if (targetDiff < 0) {
            newLines[idx].credit = Math.abs(targetDiff).toFixed(2)
            newLines[idx].debit = ''
        }
        setLines(newLines)
    }

    const handleKeyDown = (e: React.KeyboardEvent, idx: number, field: string) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (idx === lines.length - 1) {
                addLine()
            }
        }
    }

    const handleAction = async (status: 'DRAFT' | 'POSTED') => {
        if (status === 'POSTED' && !isBalanced) {
            toast.error('Cannot post an unbalanced entry.')
            return
        }

        const { yearId, periodId } = findFiscalContext(header.transactionDate, fiscalYears)
        if (!yearId) {
            toast.error('No active Fiscal Year found for this date.')
            return
        }

        startTransition(async () => {
            try {
                const payload = {
                    transactionDate: new Date(header.transactionDate),
                    description: header.description,
                    reference: header.reference,
                    fiscalYearId: yearId,
                    fiscalPeriodId: periodId,
                    status,
                    lines: lines.map((l: Record<string, any>) => {
                        const linePayload: any = {
                            accountId: Number(l.accountId),
                            debit: Number(l.debit) || 0,
                            credit: Number(l.credit) || 0,
                            description: l.description || header.description,
                        }
                        if (l.contactId) {
                            linePayload.contactId = Number(l.contactId)
                            linePayload.partnerType = 'PARTNER' // Generic assignment
                        }
                        if (l.costCenter) {
                            linePayload.costCenter = l.costCenter.trim().toUpperCase()
                        }
                        return linePayload
                    })
                }

                if (initialEntry) {
                    await updateJournalEntry(initialEntry.id, payload)
                } else {
                    await createJournalEntry(payload)
                }

                toast.success(`Journal entry ${status.toLowerCase()} successfully`)
                router.push('/finance/ledger')
                router.refresh()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)))
            }
        })
    }

    const activeYear = fiscalYears.find(y => y.id === fiscalContext.yearId)
    const activePeriod = activeYear?.periods?.find((p: Record<string, any>) => p.id === fiscalContext.periodId)

    return (
        <form onSubmit={e => e.preventDefault()} className="space-y-6 max-w-[1400px]">
            
            {/* ── KPI Strip ── */}
            <KPIStrip stats={[
                { label: 'Total Debit', value: totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }), icon: <Calculator size={11} />, color: 'var(--app-primary)' },
                { label: 'Total Credit', value: totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }), icon: <Calculator size={11} />, color: 'var(--app-error)' },
                { label: 'Balance State', value: isBalanced ? 'Balanced' : Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 }), icon: <Hash size={11} />, color: isBalanced ? 'var(--app-success)' : 'var(--app-warning)' },
            ]} />

            {/* ── Header Metadata ── */}
            <div className="bg-app-surface/60 backdrop-blur-md p-5 rounded-2xl border border-app-border/40 shadow-sm transition-all focus-within:border-app-primary/30">
                <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase tracking-widest text-app-muted-foreground border-b border-app-border/30 pb-2">
                    <FileText size={14} className="text-app-primary" /> Journal Control Data
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4 items-start">
                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 ml-1">Transaction Date</label>
                        <input
                            type="date"
                            required
                            value={header.transactionDate}
                            onChange={e => setHeader({ ...header, transactionDate: e.target.value })}
                            className="w-full bg-app-surface border border-app-border/50 rounded-xl px-4 py-2 text-sm font-medium focus:ring-1 focus:ring-app-primary focus:border-app-primary outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 ml-1">Global Description</label>
                        <input
                            required
                            value={header.description}
                            onChange={e => setHeader({ ...header, description: e.target.value })}
                            className="w-full bg-app-surface border border-app-border/50 rounded-xl px-4 py-2 text-sm font-medium focus:ring-1 focus:ring-app-primary focus:border-app-primary outline-none transition-all shadow-sm placeholder:text-app-muted-foreground/40"
                            placeholder="e.g. Monthly Accrual for April"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 ml-1">Reference</label>
                        <input
                            value={header.reference}
                            onChange={e => setHeader({ ...header, reference: e.target.value })}
                            className="w-full bg-app-surface border border-app-border/50 rounded-xl px-4 py-2 text-sm font-medium font-mono focus:ring-1 focus:ring-app-primary focus:border-app-primary outline-none transition-all shadow-sm placeholder:text-app-muted-foreground/40"
                            placeholder="Auto-generated"
                        />
                    </div>
                    
                    {/* Fiscal Context Badge */}
                    <div className="md:col-span-3 pb-1">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 ml-1">Posting Period Context</label>
                        {fiscalContext.yearId ? (
                            <div className="flex flex-col gap-1 items-start bg-app-surface px-4 py-2 rounded-xl border border-app-success/20 shadow-sm" style={{ background: 'color-mix(in srgb, var(--app-success) 5%, var(--app-surface))' }}>
                                <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--app-success)' }}>
                                    <CheckCircle2 size={13} fill="currentColor" className="text-white" />
                                    {activeYear?.name}
                                </span>
                                {activePeriod && (
                                    <span className="text-[10px] font-bold opacity-80" style={{ color: 'var(--app-success)' }}>
                                        {activePeriod.name} — ({new Date(activePeriod.startDate).toLocaleDateString('en-GB')} to {new Date(activePeriod.endDate).toLocaleDateString('en-GB')})
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                INVALID FISCAL SCOPE
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Advanced Financial Matrix ── */}
            <div className="bg-app-surface/60 backdrop-blur-md rounded-2xl border border-app-border/40 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-app-border/30 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)' }}>
                    <LayoutGrid size={14} style={{ color: 'var(--app-info)' }} />
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Dimensional Entry Matrix</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-app-surface border-b border-app-border/40 text-left">
                                <th className="px-4 py-3 font-black text-[10px] uppercase text-app-muted-foreground tracking-wider min-w-[220px]">Ledger Account</th>
                                <th className="px-3 py-3 font-black text-[10px] uppercase text-app-muted-foreground tracking-wider w-40">Subledger (Contact)</th>
                                <th className="px-3 py-3 font-black text-[10px] uppercase text-app-muted-foreground tracking-wider w-32">Cost Center</th>
                                <th className="px-3 py-3 font-black text-[10px] uppercase text-app-muted-foreground tracking-wider min-w-[180px]">Line Description</th>
                                <th className="px-4 py-3 font-black text-[10px] uppercase text-app-muted-foreground tracking-wider w-36 text-right">Debit</th>
                                <th className="px-4 py-3 font-black text-[10px] uppercase text-app-muted-foreground tracking-wider w-36 text-right">Credit</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line: any, idx: number) => (
                                <tr key={idx} className="border-b border-app-border/20 last:border-0 hover:bg-app-surface/40 group transition-colors">
                                    <td className="px-4 py-2.5 relative">
                                        <div className="flex items-center gap-2">
                                            <input
                                                list="accounts-list"
                                                placeholder="Code or name..."
                                                value={line.searchString}
                                                onChange={e => updateLine(idx, 'searchString', e.target.value)}
                                                className={`w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-app-primary/20 outline-none font-bold transition-all shadow-sm ${
                                                    line.accountId 
                                                    ? 'border-emerald-500/30 bg-emerald-500/5 text-app-foreground' 
                                                    : 'border-app-border/60 bg-app-surface text-app-foreground'
                                                }`}
                                            />
                                            {line.accountId && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {!selectableAccounts.find(a => a.id.toString() === line.accountId)?.isActive && (
                                                        <span className="text-[8px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-md font-black uppercase">INACTIVE</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <datalist id="accounts-list">
                                            {selectableAccounts.map(acc => (
                                                <option key={acc.id} value={`${acc.code} ${acc.name}`}>
                                                    {acc.type} {acc.isActive ? '' : '(INACTIVE)'}
                                                </option>
                                            ))}
                                        </datalist>
                                        {!line.accountId && line.searchString && (
                                            <div className="absolute left-4 top-[calc(100%-4px)] z-10 text-[9px] text-white font-black uppercase tracking-widest bg-rose-500 px-2 py-0.5 rounded-full shadow-md">
                                                Unknown Account
                                            </div>
                                        )}
                                    </td>
                                    
                                    {/* Subledger Selector */}
                                    <td className="px-3 py-2.5">
                                        <div className="relative flex items-center">
                                            <User size={12} className="absolute left-2.5 text-app-muted-foreground opacity-50" />
                                            <select
                                                value={line.contactId}
                                                onChange={e => updateLine(idx, 'contactId', e.target.value)}
                                                className="w-full pl-7 pr-2 py-2 border border-app-border/60 rounded-lg text-[11px] font-medium focus:ring-2 focus:ring-app-primary/20 outline-none bg-app-surface appearance-none text-app-foreground transition-all shadow-sm disabled:opacity-50"
                                            >
                                                <option value="">None</option>
                                                {contacts.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                    
                                    {/* Cost Center */}
                                    <td className="px-3 py-2.5">
                                        <div className="relative flex items-center">
                                            <Building2 size={12} className="absolute left-2.5 text-app-muted-foreground opacity-50" />
                                            <input
                                                value={line.costCenter}
                                                onChange={e => updateLine(idx, 'costCenter', e.target.value)}
                                                placeholder="e.g. MARKETING"
                                                className="w-full pl-7 pr-2 py-2 border border-app-border/60 rounded-lg text-[11px] font-bold uppercase focus:ring-2 focus:ring-app-primary/20 outline-none bg-app-surface text-app-foreground transition-all shadow-sm placeholder:normal-case placeholder:font-medium placeholder:opacity-40"
                                            />
                                        </div>
                                    </td>

                                    <td className="px-3 py-2.5">
                                        <div className="flex gap-2 items-center">
                                            <input
                                                value={line.description}
                                                onChange={e => updateLine(idx, 'description', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, idx, 'description')}
                                                className="w-full p-2 border border-app-border/60 rounded-lg text-xs focus:ring-2 focus:ring-app-primary/20 outline-none bg-app-surface text-app-foreground transition-all shadow-sm placeholder:opacity-40"
                                                placeholder={header.description || "Specific text..."}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAutoBalance(idx)}
                                                title="Calculate Auto-Plug"
                                                className="opacity-20 group-hover:opacity-100 text-app-primary hover:bg-app-primary/10 p-1.5 rounded-md transition-all flex-shrink-0"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-2.5">
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-app-muted-foreground opacity-40 select-none">Dr</span>
                                            <input
                                                type="number" step="0.01" min="0"
                                                value={line.debit}
                                                onKeyDown={e => handleKeyDown(e, idx, 'debit')}
                                                onChange={e => updateLine(idx, 'debit', e.target.value)}
                                                className="w-full pl-8 pr-2 py-2 border border-app-border/60 rounded-lg text-right font-mono font-bold text-sm focus:ring-2 focus:ring-app-primary/20 outline-none bg-app-surface shadow-sm transition-all text-app-primary placeholder:text-transparent focus:placeholder:text-app-muted-foreground/20"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-2.5">
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-app-muted-foreground opacity-40 select-none">Cr</span>
                                            <input
                                                type="number" step="0.01" min="0"
                                                value={line.credit}
                                                onKeyDown={e => handleKeyDown(e, idx, 'credit')}
                                                onChange={e => updateLine(idx, 'credit', e.target.value)}
                                                className="w-full pl-8 pr-2 py-2 border border-app-border/60 rounded-lg text-right font-mono font-bold text-sm focus:ring-2 focus:ring-rose-500/20 outline-none bg-app-surface shadow-sm transition-all focus:border-rose-500/50 text-rose-500 placeholder:text-transparent focus:placeholder:text-app-muted-foreground/20"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </td>

                                    <td className="px-4 py-2.5 text-center">
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            className="opacity-20 group-hover:opacity-100 text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-app-surface/80">
                                <td colSpan={4} className="px-5 py-3 text-right">
                                    {isBalanced ? (
                                        <div className="inline-flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            TRIAL BALANCE ZEROED
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-3">
                                            <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                DIFF: {Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => addLine()}
                                                className="text-[10px] text-app-muted-foreground hover:text-app-foreground underline uppercase font-bold"
                                            >
                                                Add Offset Line
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right font-mono font-bold text-[15px] border-t-2 border-app-border" style={{ color: totalDebit > 0 ? 'var(--app-primary)' : 'inherit' }}>
                                    {totalDebit > 0 ? totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                </td>
                                <td className="px-4 py-4 text-right font-mono font-bold text-[15px] border-t-2 border-app-border text-rose-500" style={{ color: totalCredit > 0 ? 'var(--app-error)' : 'inherit' }}>
                                    {totalCredit > 0 ? totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                </td>
                                <td className="px-4 py-4 border-t-2 border-app-border"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="p-2 border-t border-app-border/40 bg-app-surface/50">
                    <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-app-border/60 text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface hover:border-app-primary/40 text-xs font-black uppercase tracking-widest transition-all"
                    >
                        <Plus size={14} /> Insert Additional Vector Line
                    </button>
                </div>
            </div>

            {/* ── Action Footer ── */}
            <div className="flex justify-between items-center bg-app-surface/60 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-app-border/40 mt-12 sticky bottom-6 max-w-[1400px]">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2.5 text-app-muted-foreground font-black uppercase tracking-widest text-[11px] hover:bg-app-surface rounded-xl transition-colors"
                >
                    Cancel
                </button>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => handleAction('DRAFT')}
                        disabled={isPending}
                        className="flex items-center justify-center gap-2 bg-app-surface text-app-foreground px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-95 disabled:opacity-50 transition-all border border-app-border shadow-sm min-w-[140px]"
                    >
                        {isPending ? 'Saving...' : <><Save size={14} /> Save Draft</>}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleAction('POSTED')}
                        disabled={isPending || !isBalanced}
                        className="flex items-center justify-center gap-2 bg-app-primary text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_color-mix(in_srgb,var(--app-primary)_40%,transparent)] transition-all min-w-[160px]"
                    >
                        {isPending ? 'Processing...' : <><Send size={14} /> Post to Ledger</>}
                    </button>
                </div>
            </div>
        </form>
    )
}