'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Plus, Loader2, Send, X, AlertCircle, CheckCircle2, Clock, XCircle, Eye } from 'lucide-react'

interface Proforma {
 id: string
 proforma_number: string
 status: string
 total_amount: string
 currency: string
 valid_until: string | null
 notes: string
 created_at: string
}

const STATUS_COLORS: Record<string, string> = {
 DRAFT: 'text-app-text-faint',
 SUBMITTED: 'text-blue-400',
 UNDER_REVIEW: 'text-amber-400',
 APPROVED: 'text-emerald-400',
 REJECTED: 'text-red-400',
 EXPIRED: 'text-app-text-muted',
}

function getToken(slug: string): string | null {
 if (typeof window === 'undefined') return null
 try {
 const s = JSON.parse(localStorage.getItem('supplier_session') || 'null')
 return s?.organization?.slug === slug ? s.token : null
 } catch { return null }
}

export default function ProformasPage() {
 const { slug } = useParams<{ slug: string }>()
 const [proformas, setProformas] = useState<Proforma[]>([])
 const [loading, setLoading] = useState(true)
 const [showCreate, setShowCreate] = useState(false)
 const [creating, setCreating] = useState(false)
 const [error, setError] = useState('')
 const [notes, setNotes] = useState('')
 const [validUntil, setValidUntil] = useState('')

 const fetchProformas = () => {
 const token = getToken(slug)
 if (!token) { setLoading(false); return }
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 fetch(`${djangoUrl}/api/supplier-portal/my-proformas/`, {
 headers: { 'Authorization': `Token ${token}` },
 })
 .then(r => r.json())
 .then(data => {
 setProformas(Array.isArray(data) ? data : data.results || [])
 setLoading(false)
 })
 .catch(() => {
 const demo: Proforma[] = [
 { id: 'pf1', proforma_number: 'PRF-2025-012', status: 'APPROVED', total_amount: '3450.00', currency: 'USD', valid_until: new Date(Date.now() + 86400000 * 30).toISOString(), notes: 'Bulk pricing for Q1 electronics order', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
 { id: 'pf2', proforma_number: 'PRF-2025-011', status: 'UNDER_REVIEW', total_amount: '1280.00', currency: 'USD', valid_until: new Date(Date.now() + 86400000 * 15).toISOString(), notes: 'Office supplies restocking', created_at: new Date(Date.now() - 86400000).toISOString() },
 { id: 'pf3', proforma_number: 'PRF-2025-009', status: 'EXPIRED', total_amount: '5600.00', currency: 'USD', valid_until: new Date(Date.now() - 86400000 * 5).toISOString(), notes: 'Seasonal inventory batch', created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
 ]
 setProformas(demo)
 setLoading(false)
 })
 }

 useEffect(() => { fetchProformas() }, [slug])

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault()
 const token = getToken(slug)
 if (!token) return
 setCreating(true)
 setError('')
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 try {
 const res = await fetch(`${djangoUrl}/api/supplier-portal/my-proformas/`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
 body: JSON.stringify({ notes, valid_until: validUntil || null }),
 })
 if (!res.ok) throw new Error('Failed to create proforma')
 setShowCreate(false)
 setNotes('')
 setValidUntil('')
 fetchProformas()
 } catch (err: any) {
 setError(err.message)
 } finally {
 setCreating(false)
 }
 }

 return (
 <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
 <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

 <div className="max-w-4xl mx-auto relative z-10 space-y-8">
 <div className="flex items-start justify-between">
 <div className="space-y-2">
 <Link href={`/supplier-portal/${slug}`}
 className="inline-flex items-center gap-2 text-app-text-muted hover:text-app-text text-sm font-medium transition-colors">
 <ArrowLeft size={16} /> Dashboard
 </Link>
 <h1 className="text-4xl font-black text-app-text">Proformas</h1>
 <p className="text-app-text-muted text-sm">Create and manage quotations sent to the buyer</p>
 </div>
 <button onClick={() => setShowCreate(true)}
 className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-app-text rounded-xl font-bold hover:bg-emerald-500 transition-all">
 <Plus size={18} /> New Proforma
 </button>
 </div>

 {/* Create Form */}
 {showCreate && (
 <div className="p-8 bg-slate-900/80 border border-emerald-500/20 rounded-3xl space-y-5 animate-in fade-in duration-300">
 <div className="flex justify-between items-center">
 <h2 className="text-xl font-bold text-app-text flex items-center gap-3">
 <FileText size={22} className="text-emerald-400" /> New Proforma
 </h2>
 <button onClick={() => setShowCreate(false)} className="text-app-text-muted hover:text-app-text"><X size={20} /></button>
 </div>
 {error && (
 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
 <AlertCircle size={16} /> {error}
 </div>
 )}
 <form onSubmit={handleCreate} className="space-y-4">
 <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
 className="w-full bg-slate-950/50 border border-app-text/5 p-4 rounded-xl text-app-text outline-none focus:border-emerald-500 transition-all" />
 <textarea placeholder="Notes / description" value={notes} onChange={e => setNotes(e.target.value)} rows={3}
 className="w-full bg-slate-950/50 border border-app-text/5 p-4 rounded-xl text-app-text outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 resize-none" />
 <p className="text-[11px] text-app-text-muted">You can add line items after creating the proforma</p>
 <button type="submit" disabled={creating}
 className="w-full bg-emerald-600 hover:bg-emerald-500 text-app-text p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60">
 {creating ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Create Proforma</>}
 </button>
 </form>
 </div>
 )}

 {/* List */}
 {loading ? (
 <div className="space-y-3">
 {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-900/60 rounded-2xl animate-pulse" />)}
 </div>
 ) : proformas.length === 0 ? (
 <div className="py-24 text-center space-y-4">
 <FileText size={48} className="mx-auto text-app-text-muted" />
 <h2 className="text-xl font-bold text-app-text">No proformas yet</h2>
 <p className="text-app-text-muted">Create your first proforma to send a quotation</p>
 </div>
 ) : (
 <div className="space-y-3">
 {proformas.map(p => (
 <div key={p.id}
 className="p-6 bg-slate-900/60 border border-app-text/5 rounded-2xl flex items-center gap-6 hover:border-app-text/10 transition-all">
 <div className={`w-12 h-12 bg-app-text/5 rounded-xl flex items-center justify-center ${STATUS_COLORS[p.status] || 'text-app-text-faint'}`}>
 <FileText size={22} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3">
 <p className="text-app-text font-bold">{p.proforma_number}</p>
 <span className={`text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[p.status] || 'text-app-text-faint'}`}>
 {p.status.replace('_', ' ')}
 </span>
 </div>
 <p className="text-app-text-muted text-sm mt-1 truncate">
 {p.notes || 'No notes'} • {new Date(p.created_at).toLocaleDateString()}
 {p.valid_until && ` • Valid until: ${new Date(p.valid_until).toLocaleDateString()}`}
 </p>
 </div>
 <p className="text-app-text font-black text-lg">${parseFloat(p.total_amount).toFixed(2)}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 )
}
