// @ts-nocheck
'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { erpFetch } from "@/lib/erp-api"
import {
  RotateCcw, CheckCircle, Truck, Search,
  Calendar, Building2, Loader2, Package, Clock,
  RefreshCw, Plus, ArrowLeft, ChevronRight
} from "lucide-react"
import Link from "next/link"

type PurchaseReturn = {
  id: number
  original_order?: number
  supplier_name?: string
  status: string
  total_amount?: number | string
  reason?: string
  created_at?: string
  lines?: any[]
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Pending', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  COMPLETED: { label: 'Completed', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelled', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
}

export default function PurchaseReturnsPage() {
  const { fmt } = useCurrency()
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [completing, setCompleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await erpFetch('purchase-returns/')
      setReturns(Array.isArray(data) ? data : data.results || [])
    } catch { toast.error("Failed to load returns") }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function completeReturn(id: number) {
    setCompleting(id)
    try {
      await erpFetch(`purchase-returns/${id}/complete/`, { method: 'POST' })
      toast.success("Return completed — stock destocked")
      load()
    } catch (e: any) { toast.error(e?.message || "Failed to complete return") }
    setCompleting(null)
  }

  const filtered = returns.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return `PRET-${r.id}`.toLowerCase().includes(q) || (r.supplier_name || '').toLowerCase().includes(q)
  })

  const totalValue = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const pendingCount = filtered.filter(r => r.status === 'PENDING').length
  const completedCount = filtered.filter(r => r.status === 'COMPLETED').length

  return (
    <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
      <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shadow-sm">
              <RotateCcw size={24} className="text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">Procurement</p>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                Purchase <span className="text-orange-500">Returns</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
              <RefreshCw size={14} className="mr-1.5" /> Refresh
            </Button>
          </div>
        </header>

        {/* ── KPI Strip ── */}
        <section className="grid grid-cols-3 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Returns statistics">
          {[
            { label: 'Total Returns', value: fmt(totalValue), icon: RotateCcw, accent: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
            { label: 'Pending', value: pendingCount, icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
            { label: 'Completed', value: completedCount, icon: CheckCircle, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          ].map(s => (
            <Card key={s.label} className="border shadow-sm">
              <CardContent className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon size={20} className={s.accent} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] font-black theme-text-muted uppercase tracking-wider">{s.label}</p>
                  <p className={`text-lg md:text-2xl font-black ${s.accent} mt-0.5 truncate`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Search ── */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
          <Input placeholder="Search returns, suppliers..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 min-h-[44px] md:min-h-[40px]" />
        </div>

        {/* ── Returns List ── */}
        <div className="space-y-2">
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[80px] rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
          )) : filtered.length === 0 ? (
            <Card className="border shadow-sm">
              <CardContent className="p-12 text-center">
                <RotateCcw size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
                <p className="text-sm font-medium theme-text-muted">No purchase returns found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Card className="border shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] font-black uppercase tracking-wider theme-text-muted">
                        <th className="text-left py-3 px-4">Return ID</th>
                        <th className="text-left py-3 px-4">Source PO</th>
                        <th className="text-left py-3 px-4">Supplier</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-right py-3 px-4">Amount</th>
                        <th className="text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(ret => (
                        <tr key={ret.id} className="border-b last:border-0 hover:bg-app-surface-hover dark:hover:bg-gray-900/20">
                          <td className="py-3 px-4 font-black theme-text">PRET-{ret.id}</td>
                          <td className="py-3 px-4">
                            {ret.original_order ? (
                              <Link href={`/purchases/${ret.original_order}`} className="text-blue-500 font-bold text-xs hover:underline">
                                PO #{ret.original_order}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-2 theme-text-muted">
                              <Building2 size={12} /> {ret.supplier_name || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${STATUS_CONFIG[ret.status]?.class || 'bg-app-surface theme-text-muted'}`}>
                              {STATUS_CONFIG[ret.status]?.label || ret.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black theme-text">{fmt(Number(ret.total_amount || 0))}</td>
                          <td className="py-3 px-4 text-right">
                            {ret.status === 'PENDING' && (
                              <Button size="sm" onClick={() => completeReturn(ret.id)} disabled={completing === ret.id}
                                className="min-h-[32px] bg-blue-500 hover:bg-blue-600 text-white text-xs">
                                {completing === ret.id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Truck size={12} className="mr-1" />}
                                Ship Out
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {filtered.map(ret => (
                  <Card key={ret.id} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-black theme-text">PRET-{ret.id}</span>
                          <div className="flex items-center gap-2 text-xs theme-text-muted mt-1">
                            <Building2 size={10} /> {ret.supplier_name || '—'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS_CONFIG[ret.status]?.class || ''}`}>
                          {STATUS_CONFIG[ret.status]?.label || ret.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="font-black text-orange-500">{fmt(Number(ret.total_amount || 0))}</span>
                        {ret.status === 'PENDING' && (
                          <Button size="sm" onClick={() => completeReturn(ret.id)} disabled={completing === ret.id}
                            className="min-h-[44px] bg-blue-500 hover:bg-blue-600 text-white">
                            {completing === ret.id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Truck size={12} className="mr-1" />} Complete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
