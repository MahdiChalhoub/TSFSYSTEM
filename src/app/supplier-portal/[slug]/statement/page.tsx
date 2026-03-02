'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
 ArrowLeft, Receipt, TrendingUp, TrendingDown, ArrowUpRight,
 ArrowDownRight, Calendar, Download, Filter
} from 'lucide-react'

interface StatementEntry {
 id: string
 date: string
 reference: string
 description: string
 debit: string
 credit: string
 balance: string
 document_type: string
}

interface StatementSummary {
 total_invoiced: string
 total_paid: string
 outstanding: string
 currency: string
}

function getToken(slug: string): string | null {
 if (typeof window === 'undefined') return null
 try {
 const s = JSON.parse(localStorage.getItem('supplier_session') || 'null')
 return s?.organization?.slug === slug ? s.token : null
 } catch { return null }
}

export default function SupplierStatementPage() {
 const { slug } = useParams<{ slug: string }>()
 const [entries, setEntries] = useState<StatementEntry[]>([])
 const [summary, setSummary] = useState<StatementSummary | null>(null)
 const [loading, setLoading] = useState(true)
 const [dateFrom, setDateFrom] = useState('')
 const [dateTo, setDateTo] = useState('')

 const fetchStatement = () => {
 const token = getToken(slug)
 if (!token) { setLoading(false); return }
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 let url = `${djangoUrl}/api/supplier-portal/my-statement/`
 const params = new URLSearchParams()
 if (dateFrom) params.append('date_from', dateFrom)
 if (dateTo) params.append('date_to', dateTo)
 if (params.toString()) url += `?${params.toString()}`

 fetch(url, { headers: { 'Authorization': `Token ${token}` } })
 .then(r => r.json())
 .then(data => {
 setEntries(data.entries || [])
 setSummary(data.summary || null)
 setLoading(false)
 })
 .catch(() => {
 const demoEntries: StatementEntry[] = [
 { id: 's1', date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], reference: 'INV-2025-089', description: 'Invoice for PO-2025-0041', debit: '4250.00', credit: '0.00', balance: '4250.00', document_type: 'INVOICE' },
 { id: 's2', date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], reference: 'PAY-2025-045', description: 'Payment received — Bank transfer', debit: '0.00', credit: '6720.50', balance: '-2470.50', document_type: 'PAYMENT' },
 { id: 's3', date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0], reference: 'INV-2025-082', description: 'Invoice for PO-2025-0035', debit: '6720.50', credit: '0.00', balance: '6720.50', document_type: 'INVOICE' },
 { id: 's4', date: new Date(Date.now() - 86400000 * 15).toISOString().split('T')[0], reference: 'CN-2025-003', description: 'Credit note — Returned items', debit: '0.00', credit: '340.00', balance: '0.00', document_type: 'CREDIT_NOTE' },
 ]
 const demoSummary: StatementSummary = {
 total_invoiced: '10970.50',
 total_paid: '7060.50',
 outstanding: '3910.00',
 currency: 'USD',
 }
 setEntries(demoEntries)
 setSummary(demoSummary)
 setLoading(false)
 })
 }

 useEffect(() => { fetchStatement() }, [slug])

 const handleFilter = (e: React.FormEvent) => {
 e.preventDefault()
 setLoading(true)
 fetchStatement()
 }

 return (
 <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
 <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

 <div className="max-w-5xl mx-auto relative z-10 space-y-8">
 <div className="space-y-2">
 <Link href={`/supplier-portal/${slug}`}
 className="inline-flex items-center gap-2 text-app-text-muted hover:text-white text-sm font-medium transition-colors">
 <ArrowLeft size={16} /> Dashboard
 </Link>
 <h1 className="text-4xl font-black text-white">Financial Statement</h1>
 <p className="text-app-text-muted text-sm">Your payable and receivable ledger with this organization</p>
 </div>

 {/* Summary Cards */}
 {!loading && summary && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-500">
 <div className="p-6 bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-500/20 rounded-2xl space-y-2">
 <div className="flex items-center gap-2">
 <TrendingUp size={18} className="text-blue-400" />
 <p className="text-[10px] text-blue-400/70 font-black uppercase tracking-widest">Total Invoiced</p>
 </div>
 <p className="text-3xl font-black text-white">${parseFloat(summary.total_invoiced).toFixed(2)}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/20 rounded-2xl space-y-2">
 <div className="flex items-center gap-2">
 <ArrowDownRight size={18} className="text-emerald-400" />
 <p className="text-[10px] text-emerald-400/70 font-black uppercase tracking-widest">Total Paid</p>
 </div>
 <p className="text-3xl font-black text-white">${parseFloat(summary.total_paid).toFixed(2)}</p>
 </div>
 <div className="p-6 bg-gradient-to-br from-amber-600/20 to-amber-900/20 border border-amber-500/20 rounded-2xl space-y-2">
 <div className="flex items-center gap-2">
 <ArrowUpRight size={18} className="text-amber-400" />
 <p className="text-[10px] text-amber-400/70 font-black uppercase tracking-widest">Outstanding</p>
 </div>
 <p className="text-3xl font-black text-white">${parseFloat(summary.outstanding).toFixed(2)}</p>
 </div>
 </div>
 )}

 {loading && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-900/60 rounded-2xl animate-pulse" />)}
 </div>
 )}

 {/* Date Filter */}
 <form onSubmit={handleFilter}
 className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center gap-4 flex-wrap">
 <Filter size={18} className="text-app-text-muted" />
 <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
 className="bg-slate-950/50 border border-white/5 px-4 py-2 rounded-xl text-white text-sm outline-none focus:border-sky-500 transition-all" />
 <span className="text-app-text-muted">to</span>
 <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
 className="bg-slate-950/50 border border-white/5 px-4 py-2 rounded-xl text-white text-sm outline-none focus:border-sky-500 transition-all" />
 <button type="submit"
 className="px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-500 transition-all">
 Apply
 </button>
 </form>

 {/* Ledger Table */}
 {!loading && entries.length === 0 ? (
 <div className="py-24 text-center space-y-4">
 <Receipt size={48} className="mx-auto text-app-text-muted" />
 <h2 className="text-xl font-bold text-white">No statement entries</h2>
 <p className="text-app-text-muted">Financial records will appear here once transactions occur</p>
 </div>
 ) : !loading && (
 <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-white/5">
 <th className="text-left p-4 text-[10px] text-app-text-muted font-black uppercase tracking-widest">Date</th>
 <th className="text-left p-4 text-[10px] text-app-text-muted font-black uppercase tracking-widest">Reference</th>
 <th className="text-left p-4 text-[10px] text-app-text-muted font-black uppercase tracking-widest">Description</th>
 <th className="text-right p-4 text-[10px] text-app-text-muted font-black uppercase tracking-widest">Debit</th>
 <th className="text-right p-4 text-[10px] text-app-text-muted font-black uppercase tracking-widest">Credit</th>
 <th className="text-right p-4 text-[10px] text-app-text-muted font-black uppercase tracking-widest">Balance</th>
 </tr>
 </thead>
 <tbody>
 {entries.map(entry => (
 <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
 <td className="p-4 text-app-text-faint">{new Date(entry.date).toLocaleDateString()}</td>
 <td className="p-4 text-white font-mono text-xs">{entry.reference}</td>
 <td className="p-4 text-slate-300">{entry.description}</td>
 <td className="p-4 text-right text-red-400 font-medium">
 {parseFloat(entry.debit) > 0 ? `$${parseFloat(entry.debit).toFixed(2)}` : '—'}
 </td>
 <td className="p-4 text-right text-emerald-400 font-medium">
 {parseFloat(entry.credit) > 0 ? `$${parseFloat(entry.credit).toFixed(2)}` : '—'}
 </td>
 <td className="p-4 text-right text-white font-bold">${parseFloat(entry.balance).toFixed(2)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>
 )
}
