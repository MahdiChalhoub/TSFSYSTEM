// @ts-nocheck
import { erpFetch } from "@/lib/erp-api"
import {
  TrendingDown, Clock, ShieldCheck, ArrowRight,
  Search, ChevronRight, BarChart3, Users, Building2, Package
} from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

async function getOrgCurrency(): Promise<string> {
  try {
    const me = await erpFetch('me/')
    return me?.organization?.currency || 'USD'
  } catch { return 'USD' }
}

async function getSourcingData() {
  try {
    return await erpFetch('product-suppliers/')
  } catch { return { results: [] } }
}

export default async function SourcingDashboardPage() {
  const [currency, sourcingData] = await Promise.all([getOrgCurrency(), getSourcingData()])
  const suppliers = Array.isArray(sourcingData) ? sourcingData : (sourcingData?.results ?? [])

  // Group by supplier
  const supplierMap: Record<string, { name: string; products: number; avg_lead_time: number }> = {}
  suppliers.forEach((s: any) => {
    const name = s.supplier?.name || s.supplier_name || 'Unknown'
    if (!supplierMap[name]) supplierMap[name] = { name, products: 0, avg_lead_time: 0 }
    supplierMap[name].products++
    supplierMap[name].avg_lead_time = s.lead_time_days || 0
  })
  const topSuppliers = Object.values(supplierMap).sort((a, b) => b.products - a.products).slice(0, 10)

  return (
    <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
      <div className="layout-container-padding max-w-[1400px] mx-auto space-y-[var(--layout-section-spacing)]">

        <Link href="/purchases" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors">
          ← Back to Procurement Center
        </Link>

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shadow-sm">
              <BarChart3 size={24} className="text-indigo-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                Sourcing <span className="text-indigo-500">Hub</span>
              </h1>
              <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                Supplier relationships & product sourcing
              </p>
            </div>
          </div>
        </header>

        {/* ── KPI Strip ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Sourcing metrics">
          {[
            { label: 'Active Suppliers', value: topSuppliers.length, icon: Building2, accent: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
            { label: 'Product Links', value: suppliers.length, icon: Package, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'Avg Lead Time', value: topSuppliers.length > 0 ? `${Math.round(topSuppliers.reduce((s, t) => s + t.avg_lead_time, 0) / topSuppliers.length)} d` : '—', icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
            { label: 'Coverage', value: `${suppliers.length > 0 ? '✓' : '—'}`, icon: ShieldCheck, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          ].map(s => (
            <div key={s.label} className="rounded-xl shadow-sm p-4 md:p-5 flex items-center gap-3 md:gap-4 theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon size={20} className={s.accent} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] md:text-[10px] font-black theme-text-muted uppercase tracking-wider">{s.label}</p>
                <p className={`text-lg md:text-2xl font-black ${s.accent} mt-0.5 truncate`}>{s.value}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Quick Links ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Quick actions">
          {[
            { label: 'Quotations & RFQs', desc: 'Request pricing from suppliers', href: '/purchases/quotations', icon: TrendingDown, accent: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/30' },
            { label: 'Supplier Directory', desc: 'Manage your suppliers', href: '/contacts?type=supplier', icon: Users, accent: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
            { label: 'Price History', desc: 'Track historical pricing', href: '/purchases/sourcing', icon: BarChart3, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
          ].map(l => (
            <Link key={l.label} href={l.href}
              className="p-4 md:p-5 rounded-xl shadow-sm flex items-center gap-3 theme-surface transition-all hover:shadow-md min-h-[64px]"
              style={{ border: '1px solid var(--theme-border)' }}>
              <div className={`w-10 h-10 rounded-xl ${l.bg} flex items-center justify-center shrink-0`}>
                <l.icon size={18} className={l.accent} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold theme-text">{l.label}</div>
                <div className="text-xs theme-text-muted">{l.desc}</div>
              </div>
              <ArrowRight size={14} className="theme-text-muted shrink-0" />
            </Link>
          ))}
        </section>

        {/* ── Supplier Leaderboard ── */}
        <section>
          <h2 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 size={14} className="text-indigo-500" /> Top Suppliers by Product Coverage
          </h2>
          {topSuppliers.length === 0 ? (
            <div className="rounded-xl shadow-sm p-12 text-center theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
              <Building2 size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
              <p className="text-sm font-medium theme-text-muted">No supplier-product links found</p>
              <p className="text-xs theme-text-muted mt-1">Link suppliers to products in the Products module</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topSuppliers.map((sup, i) => (
                <div key={sup.name} className="flex items-center gap-4 p-4 rounded-xl shadow-sm theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-xs font-black text-indigo-500">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold theme-text text-sm truncate">{sup.name}</div>
                    <div className="text-xs theme-text-muted">{sup.products} product{sup.products !== 1 ? 's' : ''} linked</div>
                  </div>
                  {sup.avg_lead_time > 0 && (
                    <div className="text-xs theme-text-muted flex items-center gap-1 shrink-0">
                      <Clock size={10} /> {sup.avg_lead_time}d lead time
                    </div>
                  )}
                  <div className="w-24 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 hidden md:block">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min((sup.products / (topSuppliers[0]?.products || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
