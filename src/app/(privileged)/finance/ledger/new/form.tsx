'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { createJournalEntry, updateJournalEntry } from '@/app/actions/finance/ledger'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, FileText, Send, CheckCircle2, Building2, User, LayoutGrid, Hash, Calculator, Maximize2, Minimize2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdmin } from '@/context/AdminContext'

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
    const [focusMode, setFocusMode] = useState(false)
    const { viewScope, setViewScope, canToggleScope } = useAdmin()

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

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
        <form onSubmit={e => e.preventDefault()} className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Page Header ── */}
            {!focusMode && <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6">
                <div className="flex items-center gap-3">
                    <div
                        className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                    >
                        <FileText size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                            Post Manual Journal
                        </h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            General Ledger · Dimensional Engine
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Scope Toggle */}
                    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--app-border)' }}>
                        {(['OFFICIAL', 'INTERNAL'] as const).map(scope => {
                            const isActive = viewScope === scope
                            return (
                                <button
                                    key={scope}
                                    type="button"
                                    onClick={() => setViewScope(scope)}
                                    className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
                                    style={{
                                        background: isActive ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                        color: isActive ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        borderRight: scope === 'OFFICIAL' ? '1px solid var(--app-border)' : 'none',
                                    }}
                                >
                                    {scope === 'OFFICIAL' ? 'Official' : 'Internal'}
                                </button>
                            )
                        })}
                    </div>

                    {/* Focus Mode */}
                    <button
                        type="button"
                        onClick={() => setFocusMode(p => !p)}
                        title="Toggle Focus Mode (Ctrl+Q)"
                        className="p-1.5 rounded-xl border transition-all"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}
                    >
                        {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>}

            {/* ── KPI Strip ── */}
            {!focusMode && <div className="flex-shrink-0 mb-3 px-4 md:px-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Total Debit', value: totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }), color: 'var(--app-primary)', icon: <Calculator size={14} /> },
                    { label: 'Total Credit', value: totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }), color: 'var(--app-error, #EF4444)', icon: <Calculator size={14} /> },
                    { label: 'Balance State', value: isBalanced ? 'Balanced' : Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 }), color: isBalanced ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #F59E0B)', icon: <Hash size={14} /> },
                ].map(s => (
                    <div key={s.label}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>}

            {/* ── Journal Control Toolbar ── */}
            {!focusMode && <div className="flex items-center gap-2 mb-3 flex-shrink-0 px-4 md:px-6">
                {/* Date */}
                <div className="flex-shrink-0 w-[140px]">
                    <input
                        type="date"
                        required
                        value={header.transactionDate}
                        onChange={e => setHeader({ ...header, transactionDate: e.target.value })}
                        className="w-full pl-3 pr-2 py-2 text-[12px] md:text-[13px] font-bold rounded-xl outline-none transition-all"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            color: 'var(--app-foreground)',
                        }}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--app-border)'; (e.target as HTMLElement).style.background = 'var(--app-surface)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                    />
                </div>

                {/* Description */}
                <div className="flex-1">
                    <input
                        required
                        value={header.description}
                        onChange={e => setHeader({ ...header, description: e.target.value })}
                        placeholder="Journal description..."
                        className="w-full pl-3 pr-3 py-2 text-[12px] md:text-[13px] rounded-xl outline-none transition-all"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            color: 'var(--app-foreground)',
                        }}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--app-border)'; (e.target as HTMLElement).style.background = 'var(--app-surface)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                    />
                </div>

                {/* Reference */}
                <div className="flex-shrink-0 w-[130px] hidden sm:block">
                    <input
                        value={header.reference}
                        onChange={e => setHeader({ ...header, reference: e.target.value })}
                        placeholder="Reference..."
                        className="w-full pl-3 pr-2 py-2 text-[11px] font-mono rounded-xl outline-none transition-all"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            color: 'var(--app-foreground)',
                        }}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--app-border)'; (e.target as HTMLElement).style.background = 'var(--app-surface)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                    />
                </div>

                {/* Fiscal Badge */}
                {fiscalContext.yearId ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success) 6%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)',
                            color: 'var(--app-success)',
                        }}>
                        <CheckCircle2 size={12} />
                        <span className="hidden lg:inline">{activeYear?.name}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-bold flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-error) 6%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)',
                            color: 'var(--app-error)',
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> No Fiscal Year
                    </div>
                )}
            </div>}

            {/* ── Focus Mode: Compact inline header ── */}
            {focusMode && (
                <div className="flex items-center gap-2 flex-shrink-0 px-4 md:px-6 py-2 pt-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <FileText size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Post Manual Journal</span>
                    </div>

                    {/* Mini KPIs in focus mode */}
                    <div className="flex items-center gap-3 ml-auto mr-2">
                        <span className="text-[11px] font-black font-mono tabular-nums" style={{ color: 'var(--app-primary)' }}>Dr {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-[11px] font-black font-mono tabular-nums" style={{ color: 'var(--app-error)' }}>Cr {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className={`text-[11px] font-black font-mono tabular-nums`} style={{ color: isBalanced ? 'var(--app-success)' : 'var(--app-warning)' }}>
                            {isBalanced ? '✓ BAL' : `Δ ${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setFocusMode(false)}
                        title="Exit Focus Mode (Ctrl+Q)"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 text-[11px] font-bold"
                        style={{
                            color: 'var(--app-primary)',
                            borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                        }}
                    >
                        <Minimize2 size={13} /> Exit
                    </button>
                </div>
            )}

            {/* ── Dimensional Entry Matrix (Tree Table Container pattern) ── */}
            <div
                className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col mx-4 md:mx-6"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}
            >
                {/* Column Headers */}
                <div
                    className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 border-b text-[10px] font-black uppercase tracking-wider"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                        color: 'var(--app-muted-foreground)',
                    }}
                >
                    <LayoutGrid size={13} style={{ color: 'var(--app-info)' }} />
                    Dimensional Entry Matrix
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {/* Desktop view (table) */}
                    <div className="hidden md:block">
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
                            <tr style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
                                <td colSpan={4} className="px-5 py-2.5 text-right">
                                    {isBalanced ? (
                                        <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                                            style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            Trial Balance Zeroed
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-2">
                                            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                                                style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                                Diff: {Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-[13px] tabular-nums"
                                    style={{ color: totalDebit > 0 ? 'var(--app-primary)' : 'var(--app-muted-foreground)', borderTop: '2px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                    {totalDebit > 0 ? totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-[13px] tabular-nums"
                                    style={{ color: totalCredit > 0 ? 'var(--app-error)' : 'var(--app-muted-foreground)', borderTop: '2px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                    {totalCredit > 0 ? totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                </td>
                                <td style={{ borderTop: '2px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}></td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Add line button inside desktop scroll */}
                    <div className="px-3 py-2">
                        <button
                            type="button"
                            onClick={addLine}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            style={{
                                border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)',
                                color: 'var(--app-muted-foreground)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-primary) 4%, transparent)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-border) 60%, transparent)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                            <Plus size={13} /> Add Line
                        </button>
                    </div>
                </div>

                {/* Mobile view (cards) */}
                <div className="block md:hidden p-3 space-y-3 bg-app-surface/30">
                    {lines.map((line: any, idx: number) => (
                        <div key={idx} className="bg-app-surface p-3 rounded-xl border border-app-border/50 shadow-sm flex flex-col gap-3 relative">
                            {/* Account Picker */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Ledger Account</label>
                                <input
                                    list={`accounts-list-mob-${idx}`}
                                    placeholder="Code or name..."
                                    value={line.searchString}
                                    onChange={e => updateLine(idx, 'searchString', e.target.value)}
                                    className={`w-full p-2 border rounded-lg text-[12px] font-bold focus:ring-1 focus:ring-app-primary/20 outline-none transition-all shadow-sm ${
                                        line.accountId 
                                        ? 'border-emerald-500/30 bg-emerald-500/5 text-app-foreground' 
                                        : 'border-app-border/60 bg-app-surface text-app-foreground'
                                    }`}
                                />
                                <datalist id={`accounts-list-mob-${idx}`}>
                                    {selectableAccounts.map(acc => (
                                        <option key={acc.id} value={`${acc.code} ${acc.name}`}>
                                            {acc.type} {acc.isActive ? '' : '(INACTIVE)'}
                                        </option>
                                    ))}
                                </datalist>
                                {!line.accountId && line.searchString && (
                                    <div className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">Unknown Account</div>
                                )}
                            </div>
                            
                            {/* Details Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Subledger</label>
                                    <select
                                        value={line.contactId}
                                        onChange={e => updateLine(idx, 'contactId', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-app-border/60 rounded-lg text-[11px] font-medium focus:ring-1 focus:ring-app-primary/20 outline-none bg-app-surface text-app-foreground h-[32px] shadow-sm appearance-none"
                                    >
                                        <option value="">None</option>
                                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Cost Center</label>
                                    <input
                                        value={line.costCenter}
                                        onChange={e => updateLine(idx, 'costCenter', e.target.value)}
                                        placeholder="EX: MKTG"
                                        className="w-full px-2 py-1.5 border border-app-border/60 rounded-lg text-[11px] font-bold uppercase focus:ring-1 focus:ring-app-primary/20 outline-none bg-app-surface text-app-foreground h-[32px] shadow-sm"
                                    />
                                </div>
                            </div>
                            
                            {/* Description */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Line Description</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        value={line.description}
                                        onChange={e => updateLine(idx, 'description', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-app-border/60 rounded-lg text-[12px] font-bold focus:ring-1 focus:ring-app-primary/20 outline-none bg-app-surface text-app-foreground shadow-sm"
                                        placeholder={header.description || "Specific text..."}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAutoBalance(idx)}
                                        className="text-app-primary hover:bg-app-primary/10 p-1.5 rounded-md flex items-center justify-center shrink-0 border border-transparent hover:border-app-primary/20 transition-all"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Amount Row */}
                            <div className="grid grid-cols-2 gap-3 pb-8">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Debit (Dr)</label>
                                    <input
                                        type="number" step="0.01" min="0" value={line.debit}
                                        onChange={e => updateLine(idx, 'debit', e.target.value)}
                                        className="w-full px-2 py-2 border border-app-border/60 rounded-lg text-right font-mono font-bold text-[12px] focus:ring-1 focus:ring-app-primary/20 outline-none bg-app-surface shadow-sm transition-all text-app-primary placeholder:text-transparent focus:placeholder:text-app-muted-foreground/20"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Credit (Cr)</label>
                                    <input
                                        type="number" step="0.01" min="0" value={line.credit}
                                        onChange={e => updateLine(idx, 'credit', e.target.value)}
                                        className="w-full px-2 py-2 border border-app-border/60 rounded-lg text-right font-mono font-bold text-[12px] focus:ring-1 focus:ring-rose-500/20 outline-none bg-app-surface shadow-sm transition-all focus:border-rose-500/50 text-rose-500 placeholder:text-transparent focus:placeholder:text-app-muted-foreground/20"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            
                            {/* Remove button */}
                            <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="absolute bottom-2 right-2 text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                    
                    {/* Mobile summary */}
                    <div className="p-3 flex flex-col gap-1.5 rounded-xl font-mono"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex justify-between items-center text-[12px] font-bold">
                            <span style={{ color: 'var(--app-primary)' }}>Dr: {totalDebit > 0 ? totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</span>
                            <span style={{ color: 'var(--app-error)' }}>Cr: {totalCredit > 0 ? totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</span>
                        </div>
                        {isBalanced ? (
                            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>Trial Balance Zeroed</div>
                        ) : (
                            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-error)' }}>Diff: {Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        )}
                    </div>

                    {/* Mobile add line */}
                    <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        style={{
                            border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)',
                            color: 'var(--app-muted-foreground)',
                        }}
                    >
                        <Plus size={13} /> Add Line
                    </button>
                </div>
                </div>
            </div>

            {/* ── Action Footer (COA-style) ── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2.5 mx-4 md:mx-6 rounded-b-2xl"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none',
                    marginTop: '-1px',
                    marginBottom: '8px',
                    color: 'var(--app-muted-foreground)',
                }}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="text-[11px] font-bold transition-colors"
                    style={{ color: 'var(--app-muted-foreground)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                >
                    Cancel
                </button>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => handleAction('DRAFT')}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                    >
                        <Save size={13} /> {isPending ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleAction('POSTED')}
                        disabled={isPending || !isBalanced}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--app-primary)',
                            color: '#fff',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}
                    >
                        <Send size={13} /> {isPending ? 'Processing...' : 'Post to Ledger'}
                    </button>
                </div>
            </div>
        </form>
    )
}