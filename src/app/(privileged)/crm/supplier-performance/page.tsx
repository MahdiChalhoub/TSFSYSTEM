'use client'
import { useCurrency } from '@/lib/utils/currency'
import { safeDateSort } from '@/lib/utils/safe-date'
import { useState, useEffect, useMemo } from "react"
import { Contact } from "@/types/erp"
import { toast } from "sonner"
import {
  Truck, DollarSign, Package, Star, Search, TrendingUp,
  Clock, Award, ChevronRight, ArrowUpRight, BarChart3,
  Target, Zap, CheckCircle2, AlertCircle, ShieldCheck
} from "lucide-react"
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SupplierPerformancePage() {
  const { fmt } = useCurrency()
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { erpFetch } = await import("@/lib/erp-api")
      const [contactsData, ordersData] = await Promise.all([
        erpFetch('crm/contacts/'),
        erpFetch('pos/purchase/'),
      ])
      const contacts = Array.isArray(contactsData) ? contactsData : contactsData.results || []
      setSuppliers(contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER' || c.type === 'BOTH'))
      setOrders(Array.isArray(ordersData) ? ordersData : ordersData.results || [])
    } catch {
      toast.error("Failed to load supplier data")
    } finally {
      setLoading(false)
    }
  }

  const enriched = useMemo(() => {
    return suppliers.map(s => {
      const sOrders = orders.filter(o =>
        o.contact === s.id || o.contact_id === s.id
      )
      const totalSpent = sOrders.reduce((sum, o) => sum + parseFloat((o as any).total_amount || 0), 0)
      const completedOrders = sOrders.filter(o => (o as any).status === 'COMPLETED')
      const completionRate = sOrders.length > 0 ? (completedOrders.length / sOrders.length * 100) : 0
      const lastOrder = sOrders.sort((a: any, b: any) => safeDateSort(b.created_at) - safeDateSort(a.created_at))[0]

      // Calculate derived scores if not from backend
      const rawObjScore = s.objective_score || completionRate.toFixed(1)

      return {
        ...s,
        orderCount: sOrders.length,
        totalSpent,
        completedOrders: completedOrders.length,
        completionRate,
        lastOrderDate: (lastOrder as any)?.created_at,
        avgOrderValue: sOrders.length > 0 ? totalSpent / sOrders.length : 0,
        displayObjScore: rawObjScore,
        displaySubjScore: s.subjective_score || '0.0',
        displayCompScore: s.composite_score || rawObjScore
      }
    }).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [suppliers, orders])

  const filtered = useMemo(() => {
    if (!search) return enriched
    const s = search.toLowerCase()
    return enriched.filter(sup =>
      (sup.name || '').toLowerCase().includes(s) ||
      (sup.email || '').toLowerCase().includes(s)
    )
  }, [enriched, search])

  const topScoreSuppliers = useMemo(() => {
    return enriched
      .filter(s => parseFloat(s.displayCompScore) > 0)
      .sort((a, b) => parseFloat(b.displayCompScore) - parseFloat(a.displayCompScore))
      .slice(0, 3)
  }, [enriched])

  const totalPurchaseValue = enriched.reduce((s, sup) => s + sup.totalSpent, 0)
  const activeSuppliers = enriched.filter(s => s.orderCount > 0).length
  const avgCompletionRate = enriched.length > 0
    ? enriched.reduce((s, sup) => s + sup.completionRate, 0) / enriched.length : 0

  if (loading) {
    return (
      <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
        <div className="fade-in-up" style={{ height: '3rem', width: '20rem', background: 'var(--app-surface-2)', marginBottom: '1.5rem', borderRadius: 'var(--app-radius-sm)' }} />
        <div className="grid grid-cols-4 gap-4 mb-10">
          {[1, 2, 3, 4].map(i => <div key={i} className="app-card" style={{ height: '8rem' }} />)}
        </div>
        <div className="app-card" style={{ height: '30rem' }} />
      </div>
    )
  }

  return (
    <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-app-info to-app-primary flex items-center justify-center shadow-lg shadow-app-info/20">
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <p className="text-[0.625rem] font-black uppercase tracking-[0.15em] text-app-muted-foreground/60 mb-0.5">Procurement Intelligence</p>
            <h1 className="text-2xl font-black tracking-tighter text-app-foreground italic uppercase">
              Supplier <span className="text-app-primary">Performance Center</span>
            </h1>
          </div>
        </div>

        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers by name or email..."
            className="w-full pl-10 pr-4 py-2 bg-app-surface border border-app-border rounded-xl text-sm outline-none focus:border-app-primary transition-all"
          />
        </div>
      </header>

      {/* ── KPI Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 fade-in-up" style={{ animationDelay: '50ms' }}>
        {[
          { label: 'Network Size', value: suppliers.length, icon: Truck, color: 'var(--app-info)', sub: 'Active partners' },
          { label: 'Active Reach', value: activeSuppliers, icon: Zap, color: 'var(--app-success)', sub: 'Placed POs' },
          { label: 'Total Volume', value: fmt(totalPurchaseValue), icon: DollarSign, color: 'var(--app-primary)', sub: 'Cumulative spent' },
          { label: 'Avg Fulfillment', value: `${avgCompletionRate.toFixed(1)}%`, icon: CheckCircle2, color: 'var(--app-warning)', sub: 'Completion rate' },
        ].map((kpi, i) => (
          <div key={i} className="app-card border-l-4" style={{ padding: '1.25rem', borderLeftColor: kpi.color }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}10` }}>
                <kpi.icon size={18} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-app-muted-foreground/60">{kpi.label}</p>
                <p className="text-xl font-black text-app-foreground tracking-tight leading-none mt-0.5">{kpi.value}</p>
                <p className="text-[0.625rem] text-app-muted-foreground mt-1">{kpi.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Surface: High Performance Scorecards ────────────── */}
      <div className="mb-10 fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-3 mb-6">
          <Award size={18} className="text-app-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest text-app-foreground italic">Elite <span className="text-app-primary">Scorecards</span></h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topScoreSuppliers.map((s, i) => (
            <div key={s.id} className="app-card relative overflow-hidden group hover:border-app-primary/40 transition-all p-6" style={{ animationDelay: `${150 + i * 50}ms` }}>
              <Zap className="absolute -right-6 -bottom-6 w-24 h-24 text-app-primary opacity-[0.03] group-hover:scale-125 transition-transform duration-1000" />
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-app-primary/10 flex items-center justify-center text-app-primary font-black text-lg">
                    {s.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-app-text leading-tight group-hover:text-app-primary transition-colors">{s.name}</h3>
                    <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1">Tier: {s.supplier_category || 'Regular'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-app-primary uppercase tracking-tighter italic">Composite</p>
                  <p className="text-2xl font-black text-app-foreground italic tabular-nums leading-none tracking-tighter">{s.displayCompScore}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Obj', value: s.displayObjScore, icon: Target, color: 'var(--app-info)' },
                  { label: 'Subj', value: s.displaySubjScore, icon: Star, color: 'var(--app-warning)' },
                  { label: 'Lead', value: s.avg_lead_time_days ? `${s.avg_lead_time_days}d` : '—', icon: Clock, color: 'var(--app-success)' },
                ].map((m, idx) => (
                  <div key={idx} className="bg-app-surface-2/50 rounded-xl p-3 text-center border border-app-border/10">
                    <p className="text-[9px] font-bold text-app-muted-foreground uppercase mb-1">{m.label}</p>
                    <p className="text-sm font-black text-app-foreground">{m.value}</p>
                  </div>
                ))}
              </div>
              <Link href={`/crm/contacts/${s.id}`}>
                <Button variant="ghost" className="w-full mt-6 text-[10px] font-black uppercase tracking-widest text-app-primary gap-2 h-10 rounded-xl group-hover:bg-app-primary/10">
                  Full Audit Profile <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
          ))}
          {topScoreSuppliers.length === 0 && (
            <div className="col-span-3 py-10 text-center app-card border-dashed opacity-50">
              <p className="text-xs font-bold uppercase tracking-widest text-app-muted-foreground">No elite scorecards found yet</p>
              <p className="text-[10px] mt-1">Start placing orders to generate performance metrics.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Operational Registry (Table) ──────────────────── */}
      <div className="flex items-center gap-3 mb-6 fade-in-up" style={{ animationDelay: '300ms' }}>
        <BarChart3 size={18} className="text-app-muted-foreground/60" />
        <h2 className="text-sm font-black uppercase tracking-widest text-app-foreground italic">Supply <span className="text-app-muted-foreground/40">Chain Performance</span></h2>
      </div>

      <div className="app-card overflow-hidden fade-in-up" style={{ animationDelay: '350ms' }}>
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-app-muted-foreground opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest text-app-muted-foreground">No records matched</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-app-surface-2/50 border-b border-app-border">
                  {['Supplier', 'Spend Profile', 'Order Frequency', 'Fulfillment', 'Audit Score', ''].map((h, i) => (
                    <th key={i} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-app-muted-foreground/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/30">
                {filtered.map((s, i) => {
                  const compScore = parseFloat(s.displayCompScore)
                  const scoreColor = compScore >= 80 ? 'text-app-success' : compScore >= 50 ? 'text-app-warning' : 'text-app-error'
                  return (
                    <tr
                      key={s.id}
                      className="group hover:bg-app-surface-2/40 transition-colors cursor-pointer"
                      onClick={() => router.push(`/crm/contacts/${s.id}`)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-app-surface border border-app-border group-hover:border-app-primary/30 flex items-center justify-center font-black text-app-muted-foreground group-hover:text-app-primary transition-all">
                            {s.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-app-foreground leading-tight">{s.name}</p>
                            <p className="text-[10px] font-bold text-app-muted-foreground uppercase mt-1 tracking-tight">{s.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-black text-app-primary">{fmt(s.totalSpent)}</p>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase mt-1">Avg: {fmt(s.avgOrderValue)}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-app-muted-foreground" />
                          <span className="text-sm font-bold text-app-text">{s.orderCount} POs</span>
                        </div>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase mt-1">Last: {s.lastOrderDate ? new Date(s.lastOrderDate).toLocaleDateString() : 'Never'}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[100px] h-1.5 bg-app-surface border border-app-border rounded-full overflow-hidden">
                            <div className="h-full bg-app-success rounded-full" style={{ width: `${s.completionRate}%` }} />
                          </div>
                          <span className="text-xs font-black text-app-success">{s.completionRate.toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase mt-1">{s.completedOrders} received</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Badge className={`${scoreColor} bg-current/10 border-none text-[10px] font-black h-6 px-3`}>
                            {s.displayCompScore} / 100
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <ChevronRight size={18} className="text-app-muted-foreground/30 group-hover:text-app-primary transition-colors ml-auto" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
