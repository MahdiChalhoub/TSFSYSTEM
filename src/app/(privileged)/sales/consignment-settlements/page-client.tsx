'use client'

import { useState, useEffect } from 'react'
import { getConsignmentSettlements, getConsignmentSettlement } from '@/app/actions/inventory/locations'
import { RefreshCw, Truck, ChevronRight, CheckCircle, Clock, DollarSign, Package, User, Calendar , Handshake } from 'lucide-react'

type Settlement = {
 id: number
 settlement_number?: string
 supplier?: { id: number; name: string }
 supplier_name?: string
 status: string
 total_amount: number
 settlement_date: string
 performed_by?: { first_name: string; last_name: string }
 lines?: SettlementLine[]
}

type SettlementLine = {
 id: number
 product?: { name: string }
 product_name?: string
 quantity: number
 unit_price: number
 subtotal: number
}

const STATUS = {
 COMPLETED: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
 PENDING: 'bg-amber-900/40 text-amber-400 border-amber-700',
 DRAFT: 'bg-gray-800 text-app-text-faint border-gray-700',
}

export default function ConsignmentPage() {
 const [settlements, setSettlements] = useState<Settlement[]>([])
 const [selected, setSelected] = useState<Settlement | null>(null)
 const [detail, setDetail] = useState<Settlement | null>(null)
 const [loading, setLoading] = useState(true)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 const data = await getConsignmentSettlements()
 setSettlements(Array.isArray(data) ? data : (data?.results ?? []))
 setLoading(false)
 }

 async function openDetail(s: Settlement) {
 setSelected(s)
 const d = await getConsignmentSettlement(s.id)
 setDetail(d)
 }

 const totalAmount = settlements.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
 const pendingCount = settlements.filter(s => s.status === 'PENDING').length
 const completedCount = settlements.filter(s => s.status === 'COMPLETED').length

 return (
 <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-900/40">
 <Truck size={22} className="text-white" />
 </div>
 <div>
 <h1 className="text-4xl font-black tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
 <Handshake size={28} className="text-white" />
 </div>
 Consignment <span className="text-emerald-600">Settlements</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Partner Reconciliation</p>
 </div>
 </div>
 <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
 <RefreshCw size={14} />
 Refresh
 </button>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-3 gap-4">
 {[
 { label: 'Total Settled', value: `$${totalAmount.toFixed(2)}`, icon: DollarSign, color: 'emerald' },
 { label: 'Pending', value: pendingCount, icon: Clock, color: 'amber' },
 { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'blue' },
 ].map(s => (
 <div key={s.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
 <div className="flex items-center gap-2 text-app-text-faint text-xs mb-2"><s.icon size={14} />{s.label}</div>
 <div className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</div>
 </div>
 ))}
 </div>

 <div className="flex gap-6">
 {/* List */}
 <div className="w-1/2 flex flex-col gap-2">
 {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />) :
 settlements.length === 0 ? (
 <div className="bg-[#0F1729] rounded-2xl border border-gray-800 p-12 text-center text-app-text-muted text-sm">No consignment settlements yet.</div>
 ) : settlements.map(s => (
 <button key={s.id} onClick={() => openDetail(s)} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${selected?.id === s.id ? 'bg-orange-900/20 border-orange-700' : 'bg-[#0F1729] border-gray-800 hover:border-gray-700'}`}>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <span className="font-medium text-sm text-white">{s.settlement_number || `#${s.id}`}</span>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS[s.status as keyof typeof STATUS] || 'bg-gray-800 text-app-text-faint border-gray-700'}`}>{s.status}</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-app-text-muted mt-0.5">
 <User size={10} />
 {s.supplier?.name || s.supplier_name || '—'}
 <Calendar size={10} className="ml-1" />
 {s.settlement_date}
 </div>
 </div>
 <div className="text-sm font-semibold text-white">${Number(s.total_amount || 0).toFixed(2)}</div>
 <ChevronRight size={14} className="text-app-text-muted" />
 </button>
 ))}
 </div>

 {/* Detail */}
 <div className="w-1/2 bg-[#0F1729] rounded-2xl border border-gray-800 p-6 flex flex-col gap-4">
 {!selected ? (
 <div className="flex-1 flex flex-col items-center justify-center text-app-text-muted gap-3 py-12">
 <Truck size={48} className="opacity-20" />
 <p className="text-sm">Select a settlement to view details</p>
 </div>
 ) : (
 <>
 <div className="flex items-start justify-between">
 <div>
 <h2 className="text-lg font-bold text-white">{selected.settlement_number || `#${selected.id}`}</h2>
 <p className="text-sm text-app-text-faint">{selected.supplier?.name || selected.supplier_name} · {selected.settlement_date}</p>
 {selected.performed_by && (
 <p className="text-xs text-app-text-muted mt-0.5">By: {selected.performed_by.first_name} {selected.performed_by.last_name}</p>
 )}
 </div>
 <div className="text-xl font-bold text-white">${Number(selected.total_amount || 0).toFixed(2)}</div>
 </div>

 {detail?.lines && detail.lines.length > 0 && (
 <div>
 <h3 className="text-xs font-semibold text-app-text-faint uppercase tracking-wider mb-2">Lines</h3>
 <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
 {detail.lines.map(line => (
 <div key={line.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#070D1B] border border-gray-800">
 <Package size={13} className="text-orange-400 shrink-0" />
 <div className="flex-1">
 <div className="text-sm text-gray-200">{line.product?.name || line.product_name || '—'}</div>
 </div>
 <div className="text-right text-xs text-app-text-faint">
 <div>{line.quantity} × ${Number(line.unit_price || 0).toFixed(2)}</div>
 <div className="font-semibold text-white">${Number(line.subtotal || 0).toFixed(2)}</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 )
}
