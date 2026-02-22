'use client'

import { useState, useEffect } from 'react'
import { getInvoices } from '@/app/actions/finance/invoices'
import { submitEInvoice, getEInvoiceStatus, getEInvoiceQR } from '@/app/actions/finance/einvoice'
import { FileCheck, Send, QrCode, RefreshCw, CheckCircle, XCircle, Clock, Search, ChevronRight, Shield , Zap } from 'lucide-react'

type Invoice = {
    id: string | number
    invoice_number: string
    type: string
    status: string
    contact_name: string
    total_amount: number
    issue_date: string
    fne_status?: string
    fne_reference?: string
    invoice_hash?: string
}

type EInvoiceDetail = {
    invoice_id: string
    fne_status: string
    fne_reference: string
    fne_token: string
    fne_error: string
    invoice_hash: string
}

export default function EInvoicingPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [selected, setSelected] = useState<Invoice | null>(null)
    const [detail, setDetail] = useState<EInvoiceDetail | null>(null)
    const [qr, setQr] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    useEffect(() => {
        loadInvoices()
    }, [])

    async function loadInvoices() {
        setLoading(true)
        try {
            const data = await getInvoices('SALES')
            setInvoices(Array.isArray(data) ? data : (data?.results ?? []))
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(inv: Invoice) {
        setSelected(inv)
        setQr(null)
        try {
            const s = await getEInvoiceStatus(inv.id)
            setDetail(s)
        } catch {
            setDetail(null)
        }
    }

    async function handleSubmit() {
        if (!selected) return
        setSubmitting(true)
        try {
            await submitEInvoice(selected.id)
            const s = await getEInvoiceStatus(selected.id)
            setDetail(s)
            showToast('Invoice submitted for e-invoicing certification', 'ok')
            loadInvoices()
        } catch (e: any) {
            showToast(e?.message || 'Submission failed', 'err')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleQR() {
        if (!selected) return
        try {
            const res = await getEInvoiceQR(selected.id)
            setQr(res?.qr_data || null)
        } catch {
            showToast('QR code not available for this invoice', 'err')
        }
    }

    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    const statusBadge = (s?: string) => {
        if (!s) return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400">—</span>
        const map: Record<string, string> = {
            CERTIFIED: 'bg-emerald-900/40 text-emerald-400 border border-emerald-700',
            PENDING: 'bg-amber-900/40 text-amber-400 border border-amber-700',
            FAILED: 'bg-red-900/40 text-red-400 border border-red-700',
            SUBMITTED: 'bg-blue-900/40 text-blue-400 border border-blue-700',
        }
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${map[s] || 'bg-gray-800 text-gray-300'}`}>
                {s}
            </span>
        )
    }

    const filtered = invoices.filter(i =>
        (i.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.contact_name || '').toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-emerald-900/80 border-emerald-700 text-emerald-300' : 'bg-red-900/80 border-red-700 text-red-300'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/40">
                        <FileCheck size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Zap size={28} className="text-white" />
                            </div>
                            E- <span className="text-indigo-600">Invoicing</span>
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">ZATCA & FNE Compliance</p>
                    </div>
                </div>
                <button onClick={loadInvoices} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Compliance badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'ZATCA Phase 1', country: '🇸🇦 Saudi Arabia', status: 'Ready', color: 'emerald' },
                    { label: 'ZATCA Phase 2', country: '🇸🇦 Clearance', status: 'Ready', color: 'emerald' },
                    { label: 'FNE-CI v1.1', country: '🇨🇮 Côte d\'Ivoire', status: 'Ready', color: 'emerald' },
                    { label: 'UBL 2.1 XML', country: '🌍 Standard', status: 'Enabled', color: 'blue' },
                ].map((b) => (
                    <div key={b.label} className="bg-[#0F1729] rounded-2xl p-4 border border-gray-800 flex items-center gap-3">
                        <Shield size={18} className={`text-${b.color}-400 shrink-0`} />
                        <div>
                            <div className="text-xs font-semibold text-white">{b.label}</div>
                            <div className="text-xs text-gray-500">{b.country}</div>
                        </div>
                        <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-${b.color}-900/40 text-${b.color}-400 border border-${b.color}-800`}>{b.status}</span>
                    </div>
                ))}
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Invoice list */}
                <div className="w-1/2 flex flex-col gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search invoices..."
                            className="w-full bg-[#0F1729] border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-600"
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[60vh]">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No invoices found</div>
                        ) : filtered.map(inv => (
                            <button
                                key={inv.id}
                                onClick={() => openDetail(inv)}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${selected?.id === inv.id ? 'bg-violet-900/30 border-violet-700' : 'bg-[#0F1729] border-gray-800 hover:border-gray-700'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm text-white font-medium">{inv.invoice_number || `INV-${inv.id}`}</span>
                                        {statusBadge(inv.fne_status)}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5 truncate">{inv.contact_name}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-semibold text-white">${Number(inv.total_amount || 0).toFixed(2)}</div>
                                    <div className="text-xs text-gray-500">{inv.issue_date}</div>
                                </div>
                                <ChevronRight size={14} className="text-gray-600 shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Detail panel */}
                <div className="w-1/2 bg-[#0F1729] rounded-2xl border border-gray-800 p-6 flex flex-col gap-5">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
                            <FileCheck size={48} className="opacity-20" />
                            <p className="text-sm">Select an invoice to view e-invoicing details</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selected.invoice_number || `INV-${selected.id}`}</h2>
                                    <p className="text-sm text-gray-400">{selected.contact_name} · {selected.issue_date}</p>
                                </div>
                                <span className="text-xl font-bold text-white">${Number(selected.total_amount || 0).toFixed(2)}</span>
                            </div>

                            {detail && (
                                <div className="bg-[#070D1B] rounded-xl p-4 border border-gray-800 flex flex-col gap-3">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">E-Invoice Status</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-300">Status:</span>
                                        {statusBadge(detail.fne_status)}
                                    </div>
                                    {detail.fne_reference && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-300">Reference:</span>
                                            <span className="font-mono text-sm text-violet-400">{detail.fne_reference}</span>
                                        </div>
                                    )}
                                    {detail.invoice_hash && (
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">Invoice Hash</div>
                                            <div className="font-mono text-xs text-gray-400 break-all bg-gray-900 rounded-lg p-2">{detail.invoice_hash}</div>
                                        </div>
                                    )}
                                    {detail.fne_error && (
                                        <div className="flex items-start gap-2 text-red-400 bg-red-900/20 rounded-lg p-3 border border-red-900/40">
                                            <XCircle size={14} className="shrink-0 mt-0.5" />
                                            <span className="text-xs">{detail.fne_error}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {qr && (
                                <div className="bg-[#070D1B] rounded-xl p-4 border border-gray-800">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">QR Code Data</div>
                                    <div className="font-mono text-xs text-emerald-400 break-all bg-gray-900 rounded-lg p-2">{qr}</div>
                                </div>
                            )}

                            <div className="flex gap-3 mt-auto">
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                    {submitting ? 'Submitting...' : 'Submit for Certification'}
                                </button>
                                <button
                                    onClick={handleQR}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                                >
                                    <QrCode size={14} />
                                    QR Code
                                </button>
                                <button
                                    onClick={() => openDetail(selected)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
