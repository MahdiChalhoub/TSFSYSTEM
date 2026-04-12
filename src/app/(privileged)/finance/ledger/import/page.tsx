// @ts-nocheck
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { previewImport, importJournalEntries } from '@/app/actions/finance/ledger'
import {
    Upload, FileText, CheckCircle, XCircle, AlertTriangle,
    ChevronLeft, Download, Loader2, ArrowRight
} from 'lucide-react'

const REQUIRED_COLUMNS = ['date', 'description', 'debit_account_code', 'credit_account_code', 'amount']
const OPTIONAL_COLUMNS = ['reference', 'currency']

const SAMPLE_CSV = `date,description,debit_account_code,credit_account_code,amount,reference
2026-04-01,Office supplies purchase,6010,4011,150000,REF-001
2026-04-02,Rent payment,6130,5200,500000,REF-002
2026-04-03,Sales revenue receipt,5110,7010,800000,REF-003
`

type Step = 'upload' | 'preview' | 'confirm' | 'done'

export default function LedgerImportPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [step, setStep] = useState<Step>('upload')
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [targetStatus, setTargetStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT')
    const [preview, setPreview] = useState<any>(null)
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped && (dropped.name.endsWith('.csv') || dropped.type === 'text/csv')) {
            setFile(dropped)
            setError(null)
        } else {
            setError('Please upload a CSV file.')
        }
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f) { setFile(f); setError(null) }
    }

    const handlePreview = async () => {
        if (!file) return
        setLoading(true)
        setError(null)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const data = await previewImport(fd)
            setPreview(data)
            setStep('preview')
        } catch (e: any) {
            setError(e?.message || 'Failed to parse file. Check the format and try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        if (!file) return
        setLoading(true)
        setError(null)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('status', targetStatus)
            const data = await importJournalEntries(fd)
            setResult(data)
            setStep('done')
        } catch (e: any) {
            setError(e?.message || 'Import failed. Check the errors and try again.')
        } finally {
            setLoading(false)
        }
    }

    const downloadSample = () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'journal-import-sample.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const reset = () => {
        setStep('upload')
        setFile(null)
        setPreview(null)
        setResult(null)
        setError(null)
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Ledger
                </button>
                <span className="text-stone-300">/</span>
                <h1 className="text-xl font-bold text-stone-900">Import Journal Entries</h1>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
                {(['upload', 'preview', 'confirm', 'done'] as Step[]).map((s, i) => {
                    const stepIndex = ['upload', 'preview', 'confirm', 'done'].indexOf(step)
                    const thisIndex = i
                    const isDone = thisIndex < stepIndex
                    const isActive = s === step
                    return (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                                isActive ? 'bg-stone-900 text-white' :
                                isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                'bg-stone-100 text-stone-400'
                            }`}>
                                {isDone ? <CheckCircle className="h-3 w-3" /> : null}
                                {s}
                            </div>
                            {i < 3 && <ArrowRight className="h-3 w-3 text-stone-300" />}
                        </div>
                    )
                })}
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Step 1: Upload ──────────────────────────────────────── */}
            {step === 'upload' && (
                <div className="space-y-6">
                    {/* Format guide */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                        <div className="font-bold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            CSV Format Requirements
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                            <div>
                                <span className="font-semibold">Required columns:</span>
                                <ul className="mt-1 space-y-0.5 text-xs font-mono">
                                    {REQUIRED_COLUMNS.map(c => (
                                        <li key={c} className="text-blue-700">• {c}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <span className="font-semibold">Optional columns:</span>
                                <ul className="mt-1 space-y-0.5 text-xs font-mono">
                                    {OPTIONAL_COLUMNS.map(c => (
                                        <li key={c} className="text-blue-600/70">• {c}</li>
                                    ))}
                                </ul>
                                <div className="mt-3">
                                    <span className="font-semibold">Date format:</span>
                                    <div className="text-xs font-mono text-blue-700 mt-0.5">YYYY-MM-DD</div>
                                </div>
                                <div className="mt-2">
                                    <span className="font-semibold">Amount:</span>
                                    <div className="text-xs font-mono text-blue-700 mt-0.5">Positive number (no currency symbol)</div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={downloadSample}
                            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2"
                        >
                            <Download className="h-3 w-3" />
                            Download sample CSV
                        </button>
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                            isDragging
                                ? 'border-stone-600 bg-stone-50 scale-[1.01]'
                                : file
                                    ? 'border-emerald-400 bg-emerald-50'
                                    : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-3">
                                <CheckCircle className="h-10 w-10 text-emerald-500" />
                                <div>
                                    <div className="font-bold text-stone-900">{file.name}</div>
                                    <div className="text-sm text-stone-500 mt-1">
                                        {(file.size / 1024).toFixed(1)} KB — click to change
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <Upload className="h-10 w-10 text-stone-300" />
                                <div>
                                    <div className="font-bold text-stone-700">Drop your CSV here</div>
                                    <div className="text-sm text-stone-400 mt-1">or click to browse files</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status selection */}
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-stone-700">Import as:</span>
                        {(['DRAFT', 'POSTED'] as const).map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="status"
                                    value={s}
                                    checked={targetStatus === s}
                                    onChange={() => setTargetStatus(s)}
                                    className="accent-stone-900"
                                />
                                <span className="text-sm font-medium text-stone-700">{s}</span>
                                <span className="text-xs text-stone-400">
                                    {s === 'DRAFT' ? '(review before posting)' : '(post immediately)'}
                                </span>
                            </label>
                        ))}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handlePreview}
                            disabled={!file || loading}
                            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Preview Import
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Preview ─────────────────────────────────────── */}
            {step === 'preview' && preview && (
                <div className="space-y-6">
                    {/* Summary bar */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-stone-900">{preview.total}</div>
                            <div className="text-xs text-stone-500 uppercase tracking-wider font-bold mt-1">Total Rows</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-emerald-700">{preview.valid}</div>
                            <div className="text-xs text-emerald-600 uppercase tracking-wider font-bold mt-1">Valid</div>
                        </div>
                        <div className={`border rounded-xl p-4 text-center ${preview.invalid > 0 ? 'bg-rose-50 border-rose-200' : 'bg-stone-50 border-stone-200'}`}>
                            <div className={`text-2xl font-bold ${preview.invalid > 0 ? 'text-rose-700' : 'text-stone-400'}`}>{preview.invalid}</div>
                            <div className={`text-xs uppercase tracking-wider font-bold mt-1 ${preview.invalid > 0 ? 'text-rose-500' : 'text-stone-400'}`}>Errors</div>
                        </div>
                    </div>

                    {preview.invalid > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>
                                {preview.invalid} row{preview.invalid !== 1 ? 's' : ''} have errors and will be skipped.
                                Only the {preview.valid} valid row{preview.valid !== 1 ? 's' : ''} will be imported.
                            </span>
                        </div>
                    )}

                    {/* Preview table */}
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex justify-between items-center">
                            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Preview ({preview.rows.length} rows)</span>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-stone-50 border-b border-stone-200">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-bold text-stone-500 w-10">#</th>
                                        <th className="px-3 py-2 text-left font-bold text-stone-500">Date</th>
                                        <th className="px-3 py-2 text-left font-bold text-stone-500">Description</th>
                                        <th className="px-3 py-2 text-left font-bold text-stone-500">Debit</th>
                                        <th className="px-3 py-2 text-left font-bold text-stone-500">Credit</th>
                                        <th className="px-3 py-2 text-right font-bold text-stone-500">Amount</th>
                                        <th className="px-3 py-2 text-center font-bold text-stone-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {preview.rows.map((row: any) => (
                                        <tr key={row.row} className={`${!row.valid ? 'bg-rose-50' : ''}`}>
                                            <td className="px-3 py-2 text-stone-400 font-mono">{row.row}</td>
                                            <td className="px-3 py-2 font-mono text-stone-700">{row.date || <span className="text-rose-400 italic">missing</span>}</td>
                                            <td className="px-3 py-2 text-stone-700 max-w-[180px] truncate">{row.description}</td>
                                            <td className="px-3 py-2">
                                                <div className="font-mono text-stone-800">{row.debit_code}</div>
                                                {row.debit_account && (
                                                    <div className="text-stone-400 truncate max-w-[120px]">{row.debit_account.name}</div>
                                                )}
                                                {!row.debit_account && row.debit_code && (
                                                    <div className="text-rose-500 italic">not found</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-mono text-stone-800">{row.credit_code}</div>
                                                {row.credit_account && (
                                                    <div className="text-stone-400 truncate max-w-[120px]">{row.credit_account.name}</div>
                                                )}
                                                {!row.credit_account && row.credit_code && (
                                                    <div className="text-rose-500 italic">not found</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-stone-900">
                                                {row.amount > 0 ? row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : <span className="text-rose-400">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {row.valid ? (
                                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                                                ) : (
                                                    <div className="group relative inline-block">
                                                        <XCircle className="h-3.5 w-3.5 text-rose-500 mx-auto cursor-help" />
                                                        <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
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
                        <button onClick={reset} className="text-sm text-stone-500 hover:text-stone-900 font-bold flex items-center gap-1.5 transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                            Change File
                        </button>
                        <button
                            onClick={() => { if (preview.valid > 0) setStep('confirm') }}
                            disabled={preview.valid === 0}
                            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            Continue to Import
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 3: Confirm ─────────────────────────────────────── */}
            {step === 'confirm' && preview && (
                <div className="space-y-6 max-w-lg mx-auto text-center">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="h-7 w-7 text-stone-700" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-stone-900 mb-2">Confirm Import</h2>
                        <p className="text-stone-500 text-sm">
                            You are about to create <strong className="text-stone-900">{preview.valid} journal entries</strong> with status{' '}
                            <strong className={targetStatus === 'POSTED' ? 'text-emerald-700' : 'text-stone-900'}>{targetStatus}</strong>.
                        </p>
                        {targetStatus === 'POSTED' && (
                            <div className="mt-3 flex items-center gap-2 justify-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                Posted entries cannot be edited. Make sure your data is correct.
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => setStep('preview')}
                            className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-50 transition-all"
                        >
                            Back to Preview
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={loading}
                            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Import {preview.valid} Entries
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 4: Done ────────────────────────────────────────── */}
            {step === 'done' && result && (
                <div className="space-y-6 max-w-lg mx-auto text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${result.created > 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                        {result.created > 0
                            ? <CheckCircle className="h-8 w-8 text-emerald-600" />
                            : <XCircle className="h-8 w-8 text-rose-600" />
                        }
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-stone-900 mb-2">
                            {result.created > 0 ? 'Import Complete' : 'Import Failed'}
                        </h2>
                        <p className="text-stone-500 text-sm">
                            <strong className="text-emerald-700">{result.created}</strong> of{' '}
                            <strong>{result.total}</strong> entries created successfully.
                            {result.errors.length > 0 && (
                                <> <strong className="text-rose-700">{result.errors.length}</strong> failed.</>
                            )}
                        </p>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="text-left border border-rose-200 rounded-xl overflow-hidden">
                            <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
                                Failed Rows
                            </div>
                            <div className="divide-y divide-rose-100 max-h-48 overflow-y-auto">
                                {result.errors.map((err: any) => (
                                    <div key={err.row} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                                        <span className="font-mono text-rose-500 font-bold text-xs mt-0.5">Row {err.row}</span>
                                        <span className="text-rose-700">{err.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={reset}
                            className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-50 transition-all"
                        >
                            Import Another File
                        </button>
                        <button
                            onClick={() => router.push('/finance/ledger')}
                            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-700 transition-all"
                        >
                            View Ledger
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
