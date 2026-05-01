'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    previewImport, importJournalEntries,
    previewOpeningBalances, importOpeningBalances,
} from '@/app/actions/finance/ledger'
import {
    Upload, FileText, CheckCircle, XCircle, AlertTriangle,
    ChevronLeft, Download, Loader2, ArrowRight, BookOpen, FileSpreadsheet,
} from 'lucide-react'

// ── Shared helpers ────────────────────────────────────────────────────────────

const SAMPLE_JE_CSV = `date,description,debit_account_code,credit_account_code,amount,reference
2026-04-01,Office supplies purchase,6010,4011,150000,REF-001
2026-04-02,Rent payment,6130,5200,500000,REF-002
2026-04-03,Sales revenue receipt,5110,7010,800000,REF-003
`

const SAMPLE_OB_CSV = `account_code,balance
1010,5000000
1020,12000000
3010,-8000000
4010,-9000000
`

type Step = 'upload' | 'preview' | 'confirm' | 'done'

function StepBar({ step }: { step: Step }) {
    const STEPS: Step[] = ['upload', 'preview', 'confirm', 'done']
    const idx = STEPS.indexOf(step)
    return (
        <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                        s === step ? 'bg-app-bg text-white' :
                        i < idx ? 'bg-app-success-bg text-app-success border border-app-success' :
                        'bg-app-surface-2 text-app-muted-foreground'
                    }`}>
                        {i < idx && <CheckCircle className="h-3 w-3" />}
                        {s}
                    </div>
                    {i < 3 && <ArrowRight className="h-3 w-3 text-app-faint" />}
                </div>
            ))}
        </div>
    )
}

function DropZone({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
    const ref = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
    }, [onFile])

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => ref.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragging ? 'border-stone-600 bg-app-surface scale-[1.01]' :
                file ? 'border-emerald-400 bg-app-success-bg' :
                'border-app-border hover:border-stone-400 hover:bg-app-surface'
            }`}
        >
            <input ref={ref} type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
            {file ? (
                <div className="flex flex-col items-center gap-3">
                    <CheckCircle className="h-10 w-10 text-app-success" />
                    <div>
                        <div className="font-bold text-app-foreground">{file.name}</div>
                        <div className="text-sm text-app-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3">
                    <Upload className="h-10 w-10 text-app-faint" />
                    <div>
                        <div className="font-bold text-app-foreground">Drop your CSV here</div>
                        <div className="text-sm text-app-muted-foreground mt-1">or click to browse</div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Tab 1: Journal Entry Import ───────────────────────────────────────────────

function JournalImport() {
    const router = useRouter()
    const [step, setStep] = useState<Step>('upload')
    const [file, setFile] = useState<File | null>(null)
    const [targetStatus, setTargetStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT')
    const [preview, setPreview] = useState<any>(null)
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reset = () => { setStep('upload'); setFile(null); setPreview(null); setResult(null); setError(null) }

    const handlePreview = async () => {
        if (!file) return
        setLoading(true); setError(null)
        try {
            const fd = new FormData(); fd.append('file', file)
            setPreview(await previewImport(fd))
            setStep('preview')
        } catch (e: any) { setError(e?.message || 'Failed to parse file.') }
        finally { setLoading(false) }
    }

    const handleImport = async () => {
        if (!file) return
        setLoading(true); setError(null)
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('status', targetStatus)
            setResult(await importJournalEntries(fd))
            setStep('done')
        } catch (e: any) { setError(e?.message || 'Import failed.') }
        finally { setLoading(false) }
    }

    const downloadSample = () => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([SAMPLE_JE_CSV], { type: 'text/csv' }))
        a.download = 'journal-import-sample.csv'; a.click()
    }

    return (
        <div className="space-y-6">
            <StepBar step={step} />

            {error && (
                <div className="flex items-start gap-3 p-4 bg-app-error-bg border border-app-error rounded-xl text-app-error text-sm">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
            )}

            {step === 'upload' && (
                <div className="space-y-6">
                    <div className="bg-app-info-bg border border-app-info rounded-xl p-4 text-sm text-app-info">
                        <div className="font-bold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Required CSV columns</div>
                        <div className="grid grid-cols-2 gap-x-8">
                            <div className="space-y-0.5 text-xs font-mono">
                                {['date (YYYY-MM-DD)', 'description', 'debit_account_code', 'credit_account_code', 'amount'].map(c => (
                                    <div key={c} className="text-app-info">• {c}</div>
                                ))}
                            </div>
                            <div className="space-y-0.5 text-xs font-mono text-app-info/70">
                                <div>Optional:</div>
                                {['reference', 'currency'].map(c => <div key={c}>• {c}</div>)}
                            </div>
                        </div>
                        <button onClick={downloadSample} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-app-info hover:text-app-info underline underline-offset-2">
                            <Download className="h-3 w-3" /> Download sample CSV
                        </button>
                    </div>

                    <DropZone file={file} onFile={f => { setFile(f); setError(null) }} />

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-app-foreground">Import as:</span>
                        {(['DRAFT', 'POSTED'] as const).map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="je-status" value={s} checked={targetStatus === s} onChange={() => setTargetStatus(s)} className="accent-stone-900" />
                                <span className="text-sm font-medium text-app-foreground">{s}</span>
                                <span className="text-xs text-app-muted-foreground">{s === 'DRAFT' ? '(review before posting)' : '(post immediately)'}</span>
                            </label>
                        ))}
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handlePreview} disabled={!file || loading}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Preview Import <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {step === 'preview' && preview && (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Total Rows', value: preview.total, style: 'bg-app-surface border-app-border text-app-foreground' },
                            { label: 'Valid', value: preview.valid, style: 'bg-app-success-bg border-app-success text-app-success' },
                            { label: 'Errors', value: preview.invalid, style: preview.invalid > 0 ? 'bg-app-error-bg border-app-error text-app-error' : 'bg-app-surface border-app-border text-app-muted-foreground' },
                        ].map(({ label, value, style }) => (
                            <div key={label} className={`border rounded-xl p-4 text-center ${style}`}>
                                <div className="text-2xl font-bold">{value}</div>
                                <div className="text-xs uppercase tracking-wider font-bold mt-1 opacity-70">{label}</div>
                            </div>
                        ))}
                    </div>

                    {preview.invalid > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-app-warning-bg border border-app-warning rounded-xl text-app-warning text-sm">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {preview.invalid} row{preview.invalid !== 1 ? 's' : ''} will be skipped. Only {preview.valid} valid row{preview.valid !== 1 ? 's' : ''} will be imported.
                        </div>
                    )}

                    <div className="border border-app-border rounded-xl overflow-hidden">
                        <div className="bg-app-surface border-b border-app-border px-4 py-3">
                            <span className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Preview</span>
                        </div>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-app-surface border-b border-app-border">
                                    <tr>
                                        {['#', 'Date', 'Description', 'Debit', 'Credit', 'Amount', ''].map(h => (
                                            <th key={h} className={`px-3 py-2 text-left font-bold text-app-muted-foreground ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-app-border">
                                    {preview.rows.map((row: any) => (
                                        <tr key={row.row} className={row.valid ? '' : 'bg-app-error-bg'}>
                                            <td className="px-3 py-2 text-app-muted-foreground font-mono">{row.row}</td>
                                            <td className="px-3 py-2 font-mono text-app-foreground">{row.date || <span className="text-app-error italic">missing</span>}</td>
                                            <td className="px-3 py-2 text-app-foreground max-w-[160px] truncate">{row.description}</td>
                                            <td className="px-3 py-2">
                                                <div className="font-mono text-app-foreground">{row.debit_code}</div>
                                                {row.debit_account && <div className="text-app-muted-foreground text-tp-xs truncate max-w-[110px]">{row.debit_account.name}</div>}
                                                {!row.debit_account && row.debit_code && <div className="text-app-error text-tp-xs italic">not found</div>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-mono text-app-foreground">{row.credit_code}</div>
                                                {row.credit_account && <div className="text-app-muted-foreground text-tp-xs truncate max-w-[110px]">{row.credit_account.name}</div>}
                                                {!row.credit_account && row.credit_code && <div className="text-app-error text-tp-xs italic">not found</div>}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-app-foreground">
                                                {row.amount > 0 ? row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : <span className="text-app-error">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {row.valid ? <CheckCircle className="h-3.5 w-3.5 text-app-success mx-auto" /> : (
                                                    <div className="group relative inline-block">
                                                        <XCircle className="h-3.5 w-3.5 text-app-error mx-auto cursor-help" />
                                                        <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-app-bg text-white text-tp-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                                                            {row.errors.join('; ')}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <button onClick={reset} className="text-sm text-app-muted-foreground hover:text-app-foreground font-bold flex items-center gap-1.5">
                            <ChevronLeft className="h-4 w-4" /> Change File
                        </button>
                        <button onClick={() => preview.valid > 0 && setStep('confirm')} disabled={preview.valid === 0}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed">
                            Continue to Import <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {step === 'confirm' && preview && (
                <div className="space-y-6 max-w-lg mx-auto text-center">
                    <div className="w-16 h-16 bg-app-surface-2 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="h-7 w-7 text-app-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-app-foreground mb-2">Confirm Import</h2>
                        <p className="text-app-muted-foreground text-sm">
                            Creating <strong className="text-app-foreground">{preview.valid} journal entries</strong> as{' '}
                            <strong className={targetStatus === 'POSTED' ? 'text-app-success' : 'text-app-foreground'}>{targetStatus}</strong>.
                        </p>
                        {targetStatus === 'POSTED' && (
                            <div className="mt-3 flex items-center gap-2 justify-center text-app-warning bg-app-warning-bg border border-app-warning rounded-xl p-3 text-sm">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                Posted entries cannot be edited. Verify your data first.
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => setStep('preview')} className="px-5 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-foreground hover:bg-app-surface">
                            Back to Preview
                        </button>
                        <button onClick={handleImport} disabled={loading}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Import {preview.valid} Entries
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && result && (
                <div className="space-y-6 max-w-lg mx-auto text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${result.created > 0 ? 'bg-app-success-bg' : 'bg-app-error-bg'}`}>
                        {result.created > 0 ? <CheckCircle className="h-8 w-8 text-app-success" /> : <XCircle className="h-8 w-8 text-app-error" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-app-foreground mb-2">{result.created > 0 ? 'Import Complete' : 'Import Failed'}</h2>
                        <p className="text-app-muted-foreground text-sm">
                            <strong className="text-app-success">{result.created}</strong> of <strong>{result.total}</strong> entries created.
                            {result.errors?.length > 0 && <> <strong className="text-app-error">{result.errors.length}</strong> failed.</>}
                        </p>
                    </div>
                    {result.errors?.length > 0 && (
                        <div className="text-left border border-app-error rounded-xl overflow-hidden">
                            <div className="bg-app-error-bg border-b border-app-error px-4 py-2 text-xs font-bold text-app-error uppercase tracking-wider">Failed Rows</div>
                            <div className="divide-y divide-rose-100 max-h-48 overflow-y-auto">
                                {result.errors.map((err: any) => (
                                    <div key={err.row} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                                        <span className="font-mono text-app-error font-bold text-xs mt-0.5">Row {err.row}</span>
                                        <span className="text-app-error">{err.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3 justify-center">
                        <button onClick={reset} className="px-5 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-foreground hover:bg-app-surface">
                            Import Another File
                        </button>
                        <button onClick={() => router.push('/finance/ledger')}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface">
                            View Ledger <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Tab 2: Opening Balance Import ─────────────────────────────────────────────

function OpeningBalanceImport() {
    const router = useRouter()
    const [step, setStep] = useState<Step>('upload')
    const [file, setFile] = useState<File | null>(null)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [targetStatus, setTargetStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT')
    const [preview, setPreview] = useState<any>(null)
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reset = () => { setStep('upload'); setFile(null); setPreview(null); setResult(null); setError(null) }

    const handlePreview = async () => {
        if (!file) return
        setLoading(true); setError(null)
        try {
            const fd = new FormData(); fd.append('file', file)
            setPreview(await previewOpeningBalances(fd))
            setStep('preview')
        } catch (e: any) { setError(e?.message || 'Failed to parse file.') }
        finally { setLoading(false) }
    }

    const handleImport = async () => {
        if (!file) return
        setLoading(true); setError(null)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('date', date)
            fd.append('status', targetStatus)
            fd.append('auto_balance', 'true')
            setResult(await importOpeningBalances(fd))
            setStep('done')
        } catch (e: any) { setError(e?.message || 'Import failed.') }
        finally { setLoading(false) }
    }

    const downloadSample = () => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([SAMPLE_OB_CSV], { type: 'text/csv' }))
        a.download = 'opening-balances-sample.csv'; a.click()
    }

    const isBalanced = preview && Math.abs(preview.difference) < 0.01

    return (
        <div className="space-y-6">
            <StepBar step={step} />

            {error && (
                <div className="flex items-start gap-3 p-4 bg-app-error-bg border border-app-error rounded-xl text-app-error text-sm">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
            )}

            {step === 'upload' && (
                <div className="space-y-6">
                    <div className="bg-app-info-bg border border-app-info rounded-xl p-4 text-sm text-app-info">
                        <div className="font-bold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> CSV Format</div>
                        <div className="grid grid-cols-2 gap-x-8">
                            <div>
                                <div className="text-xs font-semibold mb-1">Required columns:</div>
                                <div className="space-y-0.5 text-xs font-mono">
                                    <div className="text-app-info">• account_code</div>
                                    <div className="text-app-info">• balance (positive = normal side)</div>
                                </div>
                            </div>
                            <div className="text-xs space-y-1">
                                <div><span className="font-semibold">ASSET/EXPENSE</span> → Debit</div>
                                <div><span className="font-semibold">LIABILITY/EQUITY/INCOME</span> → Credit</div>
                                <div className="text-app-info/70 mt-1">Negative balance reverses the side.</div>
                                <div className="text-app-info/70">Imbalance → auto-adjusts via Opening Balance Equity account.</div>
                            </div>
                        </div>
                        <button onClick={downloadSample} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-app-info hover:text-app-info underline underline-offset-2">
                            <Download className="h-3 w-3" /> Download sample CSV
                        </button>
                    </div>

                    <DropZone file={file} onFile={f => { setFile(f); setError(null) }} />

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-app-foreground mb-1.5">Opening Balance Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-app-foreground mb-1.5">Import as</label>
                            <div className="flex gap-4 mt-1">
                                {(['DRAFT', 'POSTED'] as const).map(s => (
                                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="ob-status" value={s} checked={targetStatus === s} onChange={() => setTargetStatus(s)} className="accent-stone-900" />
                                        <span className="text-sm font-medium text-app-foreground">{s}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handlePreview} disabled={!file || loading}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Preview Balances <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {step === 'preview' && preview && (
                <div className="space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: 'Accounts', value: preview.valid, style: 'bg-app-surface border-app-border text-app-foreground' },
                            { label: 'Total Debits', value: preview.total_debit.toLocaleString('en-US', { minimumFractionDigits: 2 }), style: 'bg-app-surface border-app-border text-app-foreground' },
                            { label: 'Total Credits', value: preview.total_credit.toLocaleString('en-US', { minimumFractionDigits: 2 }), style: 'bg-app-surface border-app-border text-app-foreground' },
                            {
                                label: isBalanced ? 'Balanced' : 'Difference',
                                value: isBalanced ? '✓' : Math.abs(preview.difference).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                                style: isBalanced ? 'bg-app-success-bg border-app-success text-app-success' : 'bg-app-warning-bg border-app-warning text-app-warning',
                            },
                        ].map(({ label, value, style }) => (
                            <div key={label} className={`border rounded-xl p-4 text-center ${style}`}>
                                <div className="text-lg font-bold font-mono">{value}</div>
                                <div className="text-xs uppercase tracking-wider font-bold mt-1 opacity-70">{label}</div>
                            </div>
                        ))}
                    </div>

                    {!isBalanced && (
                        <div className="flex items-start gap-3 p-4 bg-app-warning-bg border border-app-warning rounded-xl text-app-warning text-sm">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            Debits and credits differ by <strong className="mx-1">{Math.abs(preview.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>.
                            The system will automatically create an adjusting line in the <strong className="mx-1">Opening Balance Equity</strong> account.
                        </div>
                    )}

                    {preview.invalid > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-app-error-bg border border-app-error rounded-xl text-app-error text-sm">
                            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {preview.invalid} row{preview.invalid !== 1 ? 's' : ''} have errors and will be skipped.
                        </div>
                    )}

                    <div className="border border-app-border rounded-xl overflow-hidden">
                        <div className="bg-app-surface border-b border-app-border px-4 py-3">
                            <span className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Account Balances ({preview.rows.length} rows)</span>
                        </div>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-app-surface border-b border-app-border">
                                    <tr>
                                        {['#', 'Account Code', 'Account Name', 'Type', 'Balance', 'Side', 'Debit', 'Credit', ''].map(h => (
                                            <th key={h} className={`px-3 py-2 font-bold text-app-muted-foreground text-left ${['Debit','Credit','Balance'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-app-border">
                                    {preview.rows.map((row: any) => (
                                        <tr key={row.row} className={row.valid ? '' : 'bg-app-error-bg'}>
                                            <td className="px-3 py-2 text-app-muted-foreground font-mono">{row.row}</td>
                                            <td className="px-3 py-2 font-mono text-app-foreground font-bold">{row.account_code || <span className="text-app-error italic">missing</span>}</td>
                                            <td className="px-3 py-2 text-app-foreground max-w-[150px] truncate">
                                                {row.account?.name || (!row.account && row.account_code ? <span className="text-app-error italic">not found</span> : '—')}
                                            </td>
                                            <td className="px-3 py-2">
                                                {row.account?.type && (
                                                    <span className="px-1.5 py-0.5 rounded text-tp-xs font-bold bg-app-surface-2 text-app-muted-foreground">{row.account.type}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-app-foreground">{row.balance !== 0 ? row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
                                            <td className="px-3 py-2 text-center">
                                                {row.side && (
                                                    <span className={`px-1.5 py-0.5 rounded text-tp-xs font-bold ${row.side === 'Dr' ? 'bg-app-info-bg text-app-info' : 'bg-purple-100 text-purple-700'}`}>{row.side}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-app-foreground">{row.debit > 0 ? row.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}</td>
                                            <td className="px-3 py-2 text-right font-mono text-app-foreground">{row.credit > 0 ? row.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}</td>
                                            <td className="px-3 py-2 text-center">
                                                {row.valid ? <CheckCircle className="h-3.5 w-3.5 text-app-success mx-auto" /> : (
                                                    <div className="group relative inline-block">
                                                        <XCircle className="h-3.5 w-3.5 text-app-error mx-auto cursor-help" />
                                                        <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-app-bg text-white text-tp-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                                                            {row.errors.join('; ')}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <button onClick={reset} className="text-sm text-app-muted-foreground hover:text-app-foreground font-bold flex items-center gap-1.5">
                            <ChevronLeft className="h-4 w-4" /> Change File
                        </button>
                        <button onClick={() => preview.valid > 0 && setStep('confirm')} disabled={preview.valid === 0}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed">
                            Continue to Import <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {step === 'confirm' && preview && (
                <div className="space-y-6 max-w-lg mx-auto text-center">
                    <div className="w-16 h-16 bg-app-surface-2 rounded-full flex items-center justify-center mx-auto">
                        <BookOpen className="h-7 w-7 text-app-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-app-foreground mb-2">Confirm Opening Balances</h2>
                        <p className="text-app-muted-foreground text-sm">
                            One opening balance entry will be created for{' '}
                            <strong className="text-app-foreground">{date}</strong> with{' '}
                            <strong className="text-app-foreground">{preview.valid} account{preview.valid !== 1 ? 's' : ''}</strong> as{' '}
                            <strong className={targetStatus === 'POSTED' ? 'text-app-success' : 'text-app-foreground'}>{targetStatus}</strong>.
                        </p>
                        {!isBalanced && (
                            <div className="mt-3 p-3 bg-app-warning-bg border border-app-warning rounded-xl text-app-warning text-sm flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                An auto-balancing line of <strong className="mx-1">{Math.abs(preview.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> will be posted to Opening Balance Equity.
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => setStep('preview')} className="px-5 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-foreground hover:bg-app-surface">
                            Back to Preview
                        </button>
                        <button onClick={handleImport} disabled={loading}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                            Create Opening Balance Entry
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && result && (
                <div className="space-y-6 max-w-lg mx-auto text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${result.created_entry_id ? 'bg-app-success-bg' : 'bg-app-error-bg'}`}>
                        {result.created_entry_id ? <CheckCircle className="h-8 w-8 text-app-success" /> : <XCircle className="h-8 w-8 text-app-error" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-app-foreground mb-2">
                            {result.created_entry_id ? 'Opening Balances Imported' : 'Import Failed'}
                        </h2>
                        <p className="text-app-muted-foreground text-sm">
                            {result.created_entry_id && <>
                                Journal Entry <strong className="text-app-foreground">#{result.created_entry_id}</strong> created with{' '}
                                <strong className="text-app-success">{result.lines_ok} lines</strong>.
                                {parseFloat(result.auto_balance_amount) > 0 && (
                                    <> Auto-balance adjustment of <strong className="text-app-warning">{parseFloat(result.auto_balance_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> posted to Opening Balance Equity.</>
                                )}
                            </>}
                        </p>
                    </div>
                    {result.errors?.length > 0 && (
                        <div className="text-left border border-app-error rounded-xl overflow-hidden">
                            <div className="bg-app-error-bg border-b border-app-error px-4 py-2 text-xs font-bold text-app-error uppercase tracking-wider">
                                {result.skipped} Row{result.skipped !== 1 ? 's' : ''} Skipped
                            </div>
                            <div className="divide-y divide-rose-100 max-h-48 overflow-y-auto">
                                {result.errors.map((err: any) => (
                                    <div key={err.row} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                                        <span className="font-mono text-app-error font-bold text-xs mt-0.5">Row {err.row}</span>
                                        <span className="text-app-error">{err.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3 justify-center">
                        <button onClick={reset} className="px-5 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-foreground hover:bg-app-surface">
                            Import Another File
                        </button>
                        <button onClick={() => router.push('/finance/ledger')}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface">
                            View Ledger <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Page shell ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'journal', label: 'Journal Entries', icon: FileSpreadsheet, desc: 'Import double-entry journal entries — one entry per CSV row' },
    { id: 'opening', label: 'Opening Balances', icon: BookOpen, desc: 'Set initial account balances — all rows combine into one opening entry' },
]

export default function LedgerImportPage() {
    const router = useRouter()
    const [tab, setTab] = useState<'journal' | 'opening'>('journal')

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-app-muted-foreground hover:text-app-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back to Ledger
                </button>
                <span className="text-app-faint">/</span>
                <h1 className="text-xl font-bold text-app-foreground">Import Financial Data</h1>
            </div>

            {/* Tab selector */}
            <div className="flex gap-3 mb-8">
                {TABS.map(t => {
                    const Icon = t.icon
                    const active = tab === t.id
                    return (
                        <button key={t.id} onClick={() => setTab(t.id as any)}
                            className={`flex-1 flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                active ? 'border-stone-900 bg-app-surface' : 'border-app-border hover:border-stone-400'
                            }`}
                        >
                            <div className={`mt-0.5 p-1.5 rounded-lg ${active ? 'bg-app-bg text-white' : 'bg-app-surface-2 text-app-muted-foreground'}`}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <div className={`font-bold text-sm ${active ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>{t.label}</div>
                                <div className="text-xs text-app-muted-foreground mt-0.5">{t.desc}</div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {tab === 'journal' ? <JournalImport /> : <OpeningBalanceImport />}
        </div>
    )
}
