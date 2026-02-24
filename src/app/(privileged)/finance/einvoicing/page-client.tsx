'use client'
import { useState, useEffect } from 'react'
import { getInvoices } from '@/app/actions/finance/invoices'
import { submitEInvoice, getEInvoiceStatus, getEInvoiceQR } from '@/app/actions/finance/einvoice'
import { FileCheck, Send, QrCode, RefreshCw, CheckCircle, XCircle, Clock, Search, ChevronRight, Shield, Zap, Activity, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
            {/* Header: Regulatory Intelligence Mode */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-indigo-900/50 text-indigo-300 border-indigo-700/50 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Regulatory Sync: Active
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                            <Activity size={12} /> ZATCA Phase 2 (Clearance)
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-white flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-900/20">
                            <ShieldCheck size={32} className="text-white fill-white" />
                        </div>
                        Compliance <span className="text-indigo-400">Vault</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={loadInvoices} className="h-12 px-6 rounded-2xl bg-[#0F1729] border border-gray-800 font-bold text-gray-400 flex items-center gap-2 hover:bg-gray-800 transition-all">
                        <RefreshCw size={18} /> Sync Nodes
                    </button>
                    <button className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20">
                        Audit Report <ChevronRight size={18} />
                    </button>
                </div>
            </header>
            {/* Compliance badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'ZATCA P2', country: '🇸🇦 Kingdom of Saudi Arabia', status: 'READY', color: 'indigo' },
                    { label: 'FNE-CI', country: '🇨🇮 Côte d\'Ivoire (CI)', status: 'ACTIVE', color: 'emerald' },
                    { label: 'UBL 2.1', country: '🌍 Universal Standard', status: 'ENABLED', color: 'violet' },
                    { label: 'RSA-2048', country: '🔐 Crypto Signing', status: 'SECURE', color: 'amber' },
                ].map((b) => (
                    <div key={b.label} className="bg-[#0F1729]/80 backdrop-blur-md rounded-[2rem] p-5 border border-gray-800/50 flex flex-col gap-1 hover:shadow-xl hover:shadow-indigo-900/5 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-8 h-8 rounded-xl bg-${b.color}-900/40 text-${b.color}-400 flex items-center justify-center`}>
                                <ShieldCheck size={18} />
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black bg-${b.color}-900/40 text-${b.color}-400 border border-${b.color}-800/50 tracking-widest`}>{b.status}</span>
                        </div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{b.label}</div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter line-clamp-1">{b.country}</div>
                    </div>
                ))}
            </div>
            <div className="flex gap-6 flex-1 min-h-0">
                {/* Invoice list: Registry Mode */}
                <div className="w-1/2 flex flex-col gap-4">
                    <div className="relative group">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search Registry..."
                            className="w-full bg-[#0F1729]/50 border border-gray-800 focus:border-indigo-500/50 rounded-2xl pl-12 pr-4 py-3 text-xs font-black uppercase tracking-widest text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[65vh] custom-scrollbar pr-1">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-20 bg-gray-800/30 rounded-[1.5rem] animate-pulse" />
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-4 opacity-50">
                                <Activity size={48} />
                                <p className="text-[10px] font-black uppercase tracking-widest">No matching records</p>
                            </div>
                        ) : filtered.map(inv => (
                            <button
                                key={inv.id}
                                onClick={() => openDetail(inv)}
                                className={`w-full text-left p-5 rounded-[2rem] border transition-all flex items-center gap-4 group ${selected?.id === inv.id ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-900/20' : 'bg-[#0F1729]/80 border-gray-800/50 hover:border-gray-700 hover:bg-[#161F33]'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={`font-black text-xs tracking-tight ${selected?.id === inv.id ? 'text-white' : 'text-gray-200'}`}>{inv.invoice_number || `INV-${inv.id}`}</span>
                                        {statusBadge(inv.fne_status)}
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-widest truncate ${selected?.id === inv.id ? 'text-indigo-200' : 'text-gray-500'}`}>{inv.contact_name}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`text-base font-black ${selected?.id === inv.id ? 'text-white' : 'text-indigo-400'}`}>${Number(inv.total_amount || 0).toLocaleString()}</div>
                                    <div className={`text-[9px] font-black uppercase tracking-tighter ${selected?.id === inv.id ? 'text-indigo-300' : 'text-gray-600'}`}>{inv.issue_date}</div>
                                </div>
                                <ChevronRight size={16} className={`${selected?.id === inv.id ? 'text-white' : 'text-gray-700'} group-hover:translate-x-1 transition-transform`} />
                            </button>
                        ))}
                    </div>
                </div>
                {/* Detail panel: Audit Mode */}
                <div className="w-1/2 bg-[#0F1729]/50 backdrop-blur-xl rounded-[2.5rem] border border-gray-800/50 p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-700 gap-6 opacity-40">
                            <ShieldCheck size={80} strokeWidth={1} />
                            <div className="text-center">
                                <p className="text-xs font-black uppercase tracking-[0.3em] mb-2">Registry Standby</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest">Select a record to initialize audit</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-start justify-between pb-6 border-b border-gray-800/50">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Current Subject</p>
                                    <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">{selected.invoice_number || `INV-${selected.id}`}</h2>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">{selected.contact_name} · {selected.issue_date}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Settlement</p>
                                    <span className="text-3xl font-black text-white tracking-tighter">${Number(selected.total_amount || 0).toLocaleString()}</span>
                                </div>
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
                            <div className="flex gap-4 mt-auto">
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex-1 h-14 flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40 disabled:opacity-50"
                                >
                                    {submitting ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                                    {submitting ? 'Certification in Progress' : 'Authorize Certification'}
                                </button>
                                <button
                                    onClick={handleQR}
                                    className="h-14 px-6 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all flex items-center justify-center"
                                >
                                    <QrCode size={20} />
                                </button>
                                <button
                                    onClick={() => openDetail(selected)}
                                    className="h-14 px-6 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all flex items-center justify-center"
                                >
                                    <RefreshCw size={20} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
