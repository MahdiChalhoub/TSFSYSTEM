'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  getInventoryGroups, getInventoryGroupSummary,
  createInventoryGroup, deleteInventoryGroup, updateInventoryGroup,
  getGroupingRules, createGroupingRule, deleteGroupingRule, approveInventoryGroup,
} from '@/app/actions/inventory/grouping'
import {
  getPricingGroups, checkBrokenGroup, syncPricingGroupPrices, marginAnalysis,
} from '@/app/actions/inventory/grouping'
import {
  Layers, Tag, Package, ChevronDown, ChevronRight, Plus, Trash2,
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, ShieldAlert,
  BarChart3, Globe, Search, Sparkles, ArrowUpDown, Settings2, Eye,
  TrendingUp, TrendingDown, Users, Activity, Filter, X, Boxes,
  ArrowRight, Zap, SquareStack, Link2, DollarSign, Shield, Hash,
  ShieldCheck, ShieldX, Cog, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────
type Tab = 'pricing' | 'inventory' | 'rules'
type SortField = 'name' | 'members' | 'stock' | 'created'
type SortDir = 'asc' | 'desc'

interface PricingGroupItem {
  id: number
  name: string
  brand_name?: string
  pricing_mode: string
  base_selling_price_ttc: number | null
  price_sync_enabled: boolean
  override_policy: string
  last_synced_at: string | null
  member_count: number
  broken_count: number
}

interface InventoryGroupItem {
  id: number
  name: string
  group_type: string
  brand_name?: string
  commercial_size_label?: string
  member_count: number
  total_stock: number
  country_count: number
  low_stock_variants: number
  is_active: boolean
  approval_status?: string
  is_auto_generated?: boolean
}

interface GroupingRuleItem {
  id: number
  name: string
  match_brand: boolean
  match_category: boolean
  match_parfum: boolean
  match_packaging_family: boolean
  match_size_range: boolean
  default_group_type: string
  auto_approve: boolean
  auto_name_template: string
  is_active: boolean
  groups_created_count: number
  last_executed_at: string | null
}

// ─── Mode Labels ─────────────────────────────────────────────────
const MODE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  FIXED: { label: 'Fixed Price', color: 'var(--app-success)', icon: <DollarSign size={11} /> },
  MARGIN_RULE: { label: 'Margin Rule', color: 'var(--app-info)', icon: <TrendingUp size={11} /> },
  CEILING: { label: 'Ceiling', color: 'var(--app-warning)', icon: <Shield size={11} /> },
  BAND: { label: 'Price Band', color: 'var(--app-accent)', icon: <Activity size={11} /> },
  MANUAL: { label: 'Manual', color: 'var(--app-muted-foreground)', icon: <Settings2 size={11} /> },
}

const SYNC_STATUS_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  SYNCED: { label: 'Synced', bg: 'rgba(34,197,94,0.12)', color: 'var(--app-success)' },
  BROKEN: { label: 'Broken Group', bg: 'rgba(239,68,68,0.12)', color: 'var(--app-danger, #ef4444)' },
  LOCAL_OVERRIDE: { label: 'Local Override', bg: 'rgba(251,191,36,0.12)', color: 'var(--app-warning)' },
  PENDING: { label: 'Pending Sync', bg: 'rgba(59,130,246,0.12)', color: 'var(--app-info)' },
  'N/A': { label: '—', bg: 'transparent', color: 'var(--app-muted-foreground)' },
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EXACT: { label: 'Exact Twins', color: 'var(--app-primary)', icon: <Link2 size={11} /> },
  SIMILAR: { label: 'Similar Substitute', color: 'var(--app-warning)', icon: <Zap size={11} /> },
  FAMILY: { label: 'Product Family', color: 'var(--app-info)', icon: <Boxes size={11} /> },
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function ProductGroupingPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('inventory')
  const [pricingGroups, setPricingGroups] = useState<PricingGroupItem[]>([])
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroupItem[]>([])
  const [groupingRules, setGroupingRules] = useState<GroupingRuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [modeFilter, setModeFilter] = useState<string | null>(null)
  const [approvalFilter, setApprovalFilter] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => { loadData() }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'pricing') {
        const res = await getPricingGroups()
        if (res.success) setPricingGroups(res.data)
      } else if (activeTab === 'rules') {
        const res = await getGroupingRules()
        if (res.success) setGroupingRules(res.data)
      } else {
        const res = await getInventoryGroups()
        if (res.success) setInventoryGroups(res.data)
      }
    } catch (e) {
      console.error('Load failed:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtering & Sorting ──
  type GroupItem = PricingGroupItem | InventoryGroupItem | GroupingRuleItem
  const filtered = useMemo(() => {
    let items: GroupItem[] = activeTab === 'pricing'
      ? pricingGroups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
      : activeTab === 'rules'
        ? groupingRules.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
        : inventoryGroups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))

    // Type filter for inventory groups
    if (activeTab === 'inventory' && typeFilter) {
      items = (items as InventoryGroupItem[]).filter(g => g.group_type === typeFilter)
    }
    // Approval filter
    if (activeTab === 'inventory' && approvalFilter) {
      items = (items as InventoryGroupItem[]).filter(g => g.approval_status === approvalFilter)
    }
    // Mode filter for pricing groups
    if (activeTab === 'pricing' && modeFilter) {
      items = (items as PricingGroupItem[]).filter(g => g.pricing_mode === modeFilter)
    }

    // Sort — all 3 group types share name/member_count; only inventory has total_stock
    items.sort((a, b) => {
      const A = a as InventoryGroupItem & PricingGroupItem & GroupingRuleItem
      const B = b as InventoryGroupItem & PricingGroupItem & GroupingRuleItem
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = (A.name || '').localeCompare(B.name || ''); break
        case 'members': cmp = (A.member_count || 0) - (B.member_count || 0); break
        case 'stock': cmp = (A.total_stock || 0) - (B.total_stock || 0); break
        default: cmp = (A.name || '').localeCompare(B.name || '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [activeTab, pricingGroups, inventoryGroups, groupingRules, search, typeFilter, modeFilter, approvalFilter, sortField, sortDir])

  const pendingCount = useMemo(() => inventoryGroups.filter(g => g.approval_status === 'PENDING').length, [inventoryGroups])

  // ── KPI Computations ──
  type Kpis = { total: number; members: number; broken: number; synced: number; stock: number; lowStock: number }
  const kpis = useMemo<Kpis>(() => {
    if (activeTab === 'pricing') {
      const totalMembers = pricingGroups.reduce((s, g) => s + g.member_count, 0)
      const brokenGroups = pricingGroups.filter(g => g.broken_count > 0).length
      const syncedGroups = pricingGroups.filter(g => g.broken_count === 0 && g.member_count > 0).length
      return { total: pricingGroups.length, members: totalMembers, broken: brokenGroups, synced: syncedGroups, stock: 0, lowStock: 0 }
    }
    const totalMembers = inventoryGroups.reduce((s, g) => s + g.member_count, 0)
    const totalStock = inventoryGroups.reduce((s, g) => s + (g.total_stock || 0), 0)
    const lowStockGroups = inventoryGroups.filter(g => g.low_stock_variants > 0).length
    return { total: inventoryGroups.length, members: totalMembers, broken: 0, synced: 0, stock: Math.round(totalStock), lowStock: lowStockGroups }
  }, [activeTab, pricingGroups, inventoryGroups])

  function toggleSort(field: SortField) {
    if (sortField === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortField(field); setSortDir('asc') }
  }

  return (
    <div className="space-y-6 p-1">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-accent, #8b5cf6)))',
            boxShadow: '0 4px 20px color-mix(in srgb, var(--app-primary) 30%, transparent)',
          }}>
            <SquareStack size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
              Product Grouping
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
              Stock intelligence, substitution tracking & pricing policies
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'var(--app-primary)',
            color: 'var(--app-primary-foreground, #fff)',
            boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
          }}
        >
          <Plus size={16} />
          New Group
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {activeTab === 'pricing' ? (
          <>
            <KPICard icon={<Tag size={18} />} label="Pricing Groups" value={kpis.total} color="var(--app-primary)" />
            <KPICard icon={<Package size={18} />} label="Total Products" value={kpis.members} color="var(--app-info)" />
            <KPICard icon={<AlertTriangle size={18} />} label="Broken Groups" value={kpis.broken} color="var(--app-danger, #ef4444)" alert={kpis.broken > 0} />
            <KPICard icon={<CheckCircle2 size={18} />} label="Fully Synced" value={kpis.synced} color="var(--app-success)" />
          </>
        ) : (
          <>
            <KPICard icon={<Boxes size={18} />} label="Inventory Groups" value={kpis.total} color="var(--app-primary)" />
            <KPICard icon={<Package size={18} />} label="Total Members" value={kpis.members} color="var(--app-info)" />
            <KPICard icon={<BarChart3 size={18} />} label="Virtual Stock" value={kpis.stock} color="var(--app-success)" />
            <KPICard icon={<AlertTriangle size={18} />} label="Low Stock Groups" value={kpis.lowStock} color="var(--app-warning)" alert={kpis.lowStock > 0} />
          </>
        )}
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'var(--app-surface)' }}>
        <TabButton
          active={activeTab === 'inventory'}
          onClick={() => { setActiveTab('inventory'); setSearch(''); setTypeFilter(null); setModeFilter(null); setApprovalFilter(null) }}
          icon={<Package size={16} />}
          label="Inventory Groups"
          count={inventoryGroups.length}
        />
        <TabButton
          active={activeTab === 'pricing'}
          onClick={() => { setActiveTab('pricing'); setSearch(''); setTypeFilter(null); setModeFilter(null) }}
          icon={<Tag size={16} />}
          label="Pricing Groups"
          count={pricingGroups.length}
        />
        <TabButton
          active={activeTab === 'rules'}
          onClick={() => { setActiveTab('rules'); setSearch(''); setTypeFilter(null); setModeFilter(null) }}
          icon={<Cog size={16} />}
          label="Grouping Rules"
          count={groupingRules.length}
        />
      </div>

      {/* ── Toolbar: Search + Filters + Sort ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
          <input
            type="text"
            placeholder={activeTab === 'pricing' ? 'Search pricing groups...' : 'Search inventory groups...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-0 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--app-surface)',
              color: 'var(--app-foreground)',
              '--tw-ring-color': 'var(--app-primary)',
            } as React.CSSProperties}
          />
        </div>

        {/* Type/Mode Filter Chips */}
        {activeTab === 'inventory' && (
          <>
            <div className="flex gap-1.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(typeFilter === key ? null : key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: typeFilter === key ? `color-mix(in srgb, ${cfg.color} 20%, transparent)` : 'var(--app-surface)',
                    color: typeFilter === key ? cfg.color : 'var(--app-muted-foreground)',
                    border: typeFilter === key ? `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)` : '1px solid transparent',
                  }}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <span className="w-px h-5 mx-0.5" style={{ background: 'var(--app-border)' }} />
              {[{ key: 'PENDING', label: 'Pending', color: 'var(--app-warning)', icon: <Clock size={11} /> },
              { key: 'APPROVED', label: 'Approved', color: 'var(--app-success)', icon: <ShieldCheck size={11} /> },
              { key: 'REJECTED', label: 'Rejected', color: 'var(--app-danger, #ef4444)', icon: <ShieldX size={11} /> },
              ].map(af => (
                <button
                  key={af.key}
                  onClick={() => setApprovalFilter(approvalFilter === af.key ? null : af.key)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: approvalFilter === af.key ? `color-mix(in srgb, ${af.color} 20%, transparent)` : 'var(--app-surface)',
                    color: approvalFilter === af.key ? af.color : 'var(--app-muted-foreground)',
                    border: approvalFilter === af.key ? `1px solid color-mix(in srgb, ${af.color} 30%, transparent)` : '1px solid transparent',
                  }}
                >
                  {af.icon}
                  {af.label}
                  {af.key === 'PENDING' && pendingCount > 0 && (
                    <span className="ml-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: af.color, color: '#fff' }}>{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === 'pricing' && (
          <div className="flex gap-1.5">
            {Object.entries(MODE_LABELS).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setModeFilter(modeFilter === key ? null : key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: modeFilter === key ? `color-mix(in srgb, ${cfg.color} 20%, transparent)` : 'var(--app-surface)',
                  color: modeFilter === key ? cfg.color : 'var(--app-muted-foreground)',
                  border: modeFilter === key ? `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)` : '1px solid transparent',
                }}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            ))}
          </div>
        )}

        {/* Sort */}
        <div className="flex gap-1.5 ml-auto">
          {(['name', 'members', ...(activeTab === 'inventory' ? ['stock'] : [])] as SortField[]).map(f => (
            <button
              key={f}
              onClick={() => toggleSort(f)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: sortField === f ? 'var(--app-surface-elevated, var(--app-muted))' : 'var(--app-surface)',
                color: sortField === f ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
              }}
            >
              <ArrowUpDown size={11} />
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {sortField === f && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl transition-all hover:scale-105"
          style={{ background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--app-muted-foreground)' }}>
          <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading groups...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={activeTab === 'pricing' ? <Tag size={48} /> : <Package size={48} />}
          title={`No ${activeTab === 'pricing' ? 'Pricing' : 'Inventory'} Groups`}
          description={activeTab === 'pricing'
            ? 'Create pricing groups to unify selling prices across products'
            : 'Create inventory groups to aggregate stock across origin variants'}
          actionLabel="Create Group"
          onAction={() => setShowCreateModal(true)}
        />
      ) : activeTab === 'pricing' ? (
        <PricingGroupsList groups={filtered as PricingGroupItem[]} onReload={loadData} />
      ) : activeTab === 'rules' ? (
        <GroupingRulesList rules={filtered as GroupingRuleItem[]} onReload={loadData} />
      ) : (
        <InventoryGroupsList groups={filtered as InventoryGroupItem[]} onReload={loadData} />
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <CreateGroupModal
          tab={activeTab}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadData() }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════
function KPICard({ icon, label, value, color, alert }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; alert?: boolean
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{
      background: 'var(--app-card, var(--app-surface))',
      border: alert ? `1px solid color-mix(in srgb, ${color} 40%, transparent)` : '1px solid var(--app-border)',
    }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.04]" style={{
        background: color,
        transform: 'translate(30%, -30%)',
      }} />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          color: color,
        }}>
          {icon}
        </div>
        <div>
          <div className="text-xl font-black" style={{ color: 'var(--app-foreground)' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TAB BUTTON
// ═══════════════════════════════════════════════════════════════════
function TabButton({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: active ? 'var(--app-primary)' : 'transparent',
        color: active ? 'var(--app-primary-foreground, #fff)' : 'var(--app-muted-foreground)',
      }}
    >
      {icon}
      {label}
      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{
        background: active ? 'rgba(255,255,255,0.2)' : 'var(--app-surface-elevated, var(--app-muted))',
        color: active ? 'var(--app-primary-foreground, #fff)' : 'var(--app-muted-foreground)',
      }}>
        {count}
      </span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PRICING GROUPS TAB
// ═══════════════════════════════════════════════════════════════════
type GroupMember = {
  id?: number
  name?: string
  sku?: string
  product?: string
  product_id?: number
  cost?: number
  current_price?: number
  expected_price?: number
  selling_price_ttc?: number
  selling_price_ht?: number
  group_price_ttc?: number
  status?: string
  reason?: string
}
type ExpandedGroupData = {
  synced?: GroupMember[]
  broken?: GroupMember[]
  overridden?: GroupMember[]
  synced_count?: number
  broken_count?: number
  overridden_count?: number
  expected_price?: number | null
}
type SyncWarning = { product?: string; margin_pct?: number; floor?: number }
type SyncResultData = { synced?: number; warnings?: SyncWarning[] }

function PricingGroupsList({ groups, onReload }: { groups: PricingGroupItem[]; onReload: () => void }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedData, setExpandedData] = useState<ExpandedGroupData | null>(null)
  const [syncing, setSyncing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleExpand = useCallback(async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setExpandedData(null); return }
    setExpandedId(id)
    const res = await checkBrokenGroup(id)
    if (res.success) setExpandedData(res.data as ExpandedGroupData)
  }, [expandedId])

  const handleSync = useCallback(async (id: number) => {
    setSyncing(id)
    const res = await syncPricingGroupPrices(id)
    if (res.success) {
      const data = res.data as SyncResultData
      toast.success(`Synced ${data.synced ?? 0} products`)
      if (data.warnings?.length) {
        data.warnings.forEach((w) =>
          toast.warning(`${w.product}: margin ${w.margin_pct}% (floor: ${w.floor}%)`)
        )
      }
      onReload()
      if (expandedId === id) handleExpand(id)
    } else {
      toast.error(res.error || 'Sync failed')
    }
    setSyncing(null)
  }, [expandedId, onReload, handleExpand])

  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.id} className="rounded-2xl overflow-hidden transition-all" style={{
          background: 'var(--app-card, var(--app-surface))',
          border: g.broken_count > 0
            ? '1px solid color-mix(in srgb, var(--app-danger, #ef4444) 30%, var(--app-border))'
            : '1px solid var(--app-border)',
        }}>
          {/* ── Group Row ── */}
          <div
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => handleExpand(g.id)}
          >
            <div className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>
              {expandedId === g.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-sm" style={{ color: 'var(--app-foreground)' }}>{g.name}</span>
                {g.brand_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: 'var(--app-surface-elevated, var(--app-muted))',
                    color: 'var(--app-muted-foreground)',
                  }}>{g.brand_name}</span>
                )}
                <ModeChip mode={g.pricing_mode} />
              </div>
              {g.last_synced_at && (
                <div className="text-[10px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                  Last synced: {new Date(g.last_synced_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 text-xs">
              <Stat label="Price" value={g.base_selling_price_ttc != null ? `${Number(g.base_selling_price_ttc).toFixed(2)}` : '—'} icon={<DollarSign size={11} />} />
              <Stat label="Members" value={String(g.member_count)} icon={<Package size={11} />} />
              {g.broken_count > 0 ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{
                  background: 'rgba(239,68,68,0.12)',
                  color: 'var(--app-danger, #ef4444)',
                }}>
                  <AlertTriangle size={12} />
                  {g.broken_count} Broken
                </span>
              ) : g.member_count > 0 ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                  background: 'rgba(34,197,94,0.12)',
                  color: 'var(--app-success)',
                }}>
                  <CheckCircle2 size={12} />
                  Synced
                </span>
              ) : null}
            </div>

            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleSync(g.id)}
                disabled={syncing === g.id}
                className="p-2 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--app-primary)', color: 'var(--app-primary-foreground, #fff)' }}
                title="Sync prices"
              >
                <RefreshCw size={14} className={syncing === g.id ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => router.push(`/inventory/product-groups/${g.id}`)}
                className="p-2 rounded-xl transition-all hover:scale-105"
                style={{ background: 'var(--app-surface-elevated, var(--app-muted))', color: 'var(--app-foreground)' }}
                title="View details"
              >
                <Eye size={14} />
              </button>
            </div>
          </div>

          {/* ── Expanded Detail ── */}
          {expandedId === g.id && expandedData && (
            <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid var(--app-border)' }}>
              <div className="flex gap-4 mb-4 text-xs">
                <MiniStat value={expandedData.synced_count ?? 0} label="Synced" color="var(--app-success)" />
                <MiniStat value={expandedData.broken_count ?? 0} label="Broken" color="var(--app-danger, #ef4444)" />
                <MiniStat value={expandedData.overridden_count ?? 0} label="Overridden" color="var(--app-warning)" />
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}>
                      <th className="text-left px-3 py-2.5 font-semibold">Product</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Current Price</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Group Price</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Margin</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(expandedData.synced ?? []), ...(expandedData.broken ?? []), ...(expandedData.overridden ?? [])].map((m) => {
                      const badge = (m.status ? SYNC_STATUS_BADGES[m.status] : undefined) ?? SYNC_STATUS_BADGES['N/A']
                      const cur = m.current_price ?? 0
                      const margin = cur > 0
                        ? (((cur - (m.cost || 0)) / cur) * 100).toFixed(1)
                        : '—'
                      return (
                        <tr key={m.id} style={{ borderTop: '1px solid var(--app-border)' }}>
                          <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--app-foreground)' }}>
                            {m.name}
                            <span className="ml-2 text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>{m.sku}</span>
                          </td>
                          <td className="text-right px-3 py-2.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            {m.cost?.toFixed(2) ?? '—'}
                          </td>
                          <td className="text-right px-3 py-2.5 font-semibold" style={{
                            color: m.status === 'BROKEN' ? 'var(--app-danger, #ef4444)' : 'var(--app-foreground)'
                          }}>
                            {m.current_price?.toFixed(2) ?? '—'}
                          </td>
                          <td className="text-right px-3 py-2.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            {m.expected_price?.toFixed(2) ?? expandedData.expected_price?.toFixed(2) ?? '—'}
                          </td>
                          <td className="text-right px-3 py-2.5" style={{
                            color: Number(margin) < 0 ? 'var(--app-danger, #ef4444)' : 'var(--app-foreground)'
                          }}>
                            {margin}%
                          </td>
                          <td className="text-center px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                              background: badge.bg, color: badge.color,
                            }}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// INVENTORY GROUPS TAB
// ═══════════════════════════════════════════════════════════════════
type Variant = {
  product_id: number
  product_name?: string
  product_sku?: string
  country?: string
  size?: string | number
  size_unit?: string
  stock?: number
  stock_qty?: number
  is_low_stock?: boolean
  cost?: number
  cost_price?: number
  selling_price_ttc?: number
  margin_pct?: number
  role?: string
  substitution_role?: string
}
type SummaryData = {
  variants?: Variant[]
  total_stock?: number
  country_count?: number
  countries?: string[]
  avg_cost?: number
  cheapest_source?: string
  best_margin_source?: string
}

function InventoryGroupsList({ groups, onReload }: { groups: InventoryGroupItem[]; onReload: () => void }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleExpand = useCallback(async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setSummaryData(null); return }
    setExpandedId(id)
    const res = await getInventoryGroupSummary(id)
    if (res.success) setSummaryData(res.data as SummaryData)
  }, [expandedId])

  const handleDelete = useCallback(async (id: number, name: string) => {
    if (!confirm(`Delete inventory group "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const res = await deleteInventoryGroup(id)
    if (res.success) {
      toast.success(`Deleted "${name}"`)
      onReload()
    } else {
      toast.error(res.error || 'Delete failed')
    }
    setDeleting(null)
  }, [onReload])

  return (
    <div className="space-y-3">
      {groups.map(g => {
        const typeCfg = TYPE_CONFIG[g.group_type] || { label: g.group_type, color: 'var(--app-muted-foreground)', icon: <Hash size={11} /> }

        return (
          <div key={g.id} className="rounded-2xl overflow-hidden transition-all" style={{
            background: 'var(--app-card, var(--app-surface))',
            border: g.low_stock_variants > 0
              ? '1px solid color-mix(in srgb, var(--app-warning) 30%, var(--app-border))'
              : '1px solid var(--app-border)',
            opacity: g.is_active ? 1 : 0.6,
          }}>
            {/* ── Group Row ── */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => handleExpand(g.id)}
            >
              <div className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>
                {expandedId === g.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-sm" style={{ color: 'var(--app-foreground)' }}>{g.name}</span>
                  {g.brand_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: 'var(--app-surface-elevated, var(--app-muted))',
                      color: 'var(--app-muted-foreground)',
                    }}>{g.brand_name}</span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{
                    background: `color-mix(in srgb, ${typeCfg.color} 12%, transparent)`,
                    color: typeCfg.color,
                  }}>
                    {typeCfg.icon}
                    {typeCfg.label}
                  </span>
                  {/* Approval Status Badge */}
                  {g.approval_status && g.approval_status !== 'APPROVED' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                      background: g.approval_status === 'PENDING' ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)',
                      color: g.approval_status === 'PENDING' ? 'var(--app-warning)' : 'var(--app-danger, #ef4444)',
                    }}>
                      {g.approval_status === 'PENDING' ? <Clock size={10} /> : <ShieldX size={10} />}
                      {g.approval_status}
                    </span>
                  )}
                  {g.is_auto_generated && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{
                      background: 'rgba(139,92,246,0.1)',
                      color: 'var(--app-accent, #8b5cf6)',
                    }}>Auto</span>
                  )}
                  {g.commercial_size_label && (
                    <span className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                      {g.commercial_size_label}
                    </span>
                  )}
                  {!g.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{
                      background: 'rgba(107,114,128,0.12)',
                      color: 'var(--app-muted-foreground)',
                    }}>Inactive</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <Stat label="Stock" value={String(Math.round(g.total_stock || 0))} icon={<BarChart3 size={11} />} />
                <Stat label="Variants" value={String(g.member_count)} icon={<Package size={11} />} />
                <Stat label="Countries" value={String(g.country_count)} icon={<Globe size={11} />} />
                {g.low_stock_variants > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{
                    background: 'rgba(251,191,36,0.12)',
                    color: 'var(--app-warning)',
                  }}>
                    <AlertTriangle size={12} />
                    {g.low_stock_variants} Low
                  </span>
                )}
              </div>

              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                {g.approval_status === 'PENDING' && (
                  <>
                    <button
                      onClick={async () => {
                        const res = await approveInventoryGroup(g.id, 'approve')
                        if (res.success) { toast.success(`Approved "${g.name}"`); onReload() }
                        else toast.error(res.error || 'Approval failed')
                      }}
                      className="p-2 rounded-xl transition-all hover:scale-105"
                      style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--app-success)' }}
                      title="Approve group"
                    >
                      <ShieldCheck size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        const res = await approveInventoryGroup(g.id, 'reject')
                        if (res.success) { toast.success(`Rejected "${g.name}"`); onReload() }
                        else toast.error(res.error || 'Rejection failed')
                      }}
                      className="p-2 rounded-xl transition-all hover:scale-105"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--app-danger, #ef4444)' }}
                      title="Reject group"
                    >
                      <ShieldX size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => router.push(`/inventory/product-groups/${g.id}`)}
                  className="p-2 rounded-xl transition-all hover:scale-105"
                  style={{ background: 'var(--app-primary)', color: 'var(--app-primary-foreground, #fff)' }}
                  title="View details"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(g.id, g.name)}
                  disabled={deleting === g.id}
                  className="p-2 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--app-danger, #ef4444)' }}
                  title="Delete group"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* ── Expanded Summary ── */}
            {expandedId === g.id && summaryData && (
              <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid var(--app-border)' }}>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <SummaryCard label="Total Stock" value={Math.round(summaryData.total_stock ?? 0)} icon={<BarChart3 size={14} />} />
                  <SummaryCard label="Countries" value={summaryData.country_count ?? 0} sub={summaryData.countries?.join(', ')} icon={<Globe size={14} />} />
                  <SummaryCard label="Avg Cost" value={summaryData.avg_cost?.toFixed(2) ?? '—'} icon={<DollarSign size={14} />} />
                  <SummaryCard label="Cheapest" value={summaryData.cheapest_source || '—'} small icon={<TrendingDown size={14} />} />
                  <SummaryCard label="Best Margin" value={summaryData.best_margin_source || '—'} small icon={<TrendingUp size={14} />} />
                </div>

                {/* Variants Table */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}>
                        <th className="text-left px-3 py-2.5 font-semibold">Variant</th>
                        <th className="text-left px-3 py-2.5 font-semibold">Country</th>
                        <th className="text-left px-3 py-2.5 font-semibold">Size</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Stock</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Sell Price</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Margin</th>
                        <th className="text-center px-3 py-2.5 font-semibold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.variants?.map((v) => (
                        <tr key={v.product_id} style={{ borderTop: '1px solid var(--app-border)' }}>
                          <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--app-foreground)' }}>
                            {v.product_name}
                            <span className="ml-2 text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>{v.product_sku}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {v.country && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                                background: 'rgba(59,130,246,0.1)',
                                color: 'var(--app-info)',
                              }}>
                                {v.country}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            {v.size ? `${v.size}${v.size_unit || ''}` : '—'}
                          </td>
                          <td className="text-right px-3 py-2.5 font-semibold" style={{
                            color: v.is_low_stock ? 'var(--app-danger, #ef4444)' : 'var(--app-foreground)',
                          }}>
                            {Math.round(v.stock_qty ?? 0)}
                            {v.is_low_stock && <AlertTriangle size={10} className="inline ml-1" />}
                          </td>
                          <td className="text-right px-3 py-2.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            {v.cost_price?.toFixed(2)}
                          </td>
                          <td className="text-right px-3 py-2.5 font-semibold" style={{ color: 'var(--app-foreground)' }}>
                            {v.selling_price_ttc?.toFixed(2)}
                          </td>
                          <td className="text-right px-3 py-2.5" style={{
                            color: (v.margin_pct ?? 0) < 0 ? 'var(--app-danger, #ef4444)' : 'var(--app-foreground)',
                          }}>
                            {v.margin_pct?.toFixed(1)}%
                          </td>
                          <td className="text-center px-3 py-2.5">
                            <RoleBadge role={v.substitution_role ?? ''} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CREATE GROUP MODAL
// ═══════════════════════════════════════════════════════════════════
function CreateGroupModal({ tab, onClose, onCreated }: {
  tab: Tab; onClose: () => void; onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [groupType, setGroupType] = useState('EXACT')
  const [sizeLabel, setSizeLabel] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setCreating(true)
    try {
      const res = await createInventoryGroup({
        name: name.trim(),
        group_type: groupType,
        commercial_size_label: sizeLabel || null,
        description: description || null,
      })
      if (res.success) {
        toast.success(`Created "${name}"`)
        onCreated()
      } else {
        toast.error(res.error || 'Failed')
      }
    } catch (e) {
      toast.error('Create failed')
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'var(--app-bg)',
          border: '1px solid var(--app-border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
              color: 'var(--app-primary)',
            }}>
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black" style={{ color: 'var(--app-foreground)' }}>
                New {tab === 'pricing' ? 'Pricing' : 'Inventory'} Group
              </h3>
              <p className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                {tab === 'pricing'
                  ? 'Unify pricing across similar products'
                  : 'Group products for stock aggregation & substitution'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: 'var(--app-muted-foreground)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <FormField label="Group Name" required>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g. "Persil Small", "Rice 5kg Equivalent"'
              className="w-full px-4 py-2.5 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
              style={{
                background: 'var(--app-surface)',
                color: 'var(--app-foreground)',
                '--tw-ring-color': 'var(--app-primary)',
              } as React.CSSProperties}
              autoFocus
            />
          </FormField>

          {tab === 'inventory' && (
            <FormField label="Group Type">
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setGroupType(key)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: groupType === key
                        ? `color-mix(in srgb, ${cfg.color} 15%, transparent)`
                        : 'var(--app-surface)',
                      color: groupType === key ? cfg.color : 'var(--app-muted-foreground)',
                      border: groupType === key
                        ? `2px solid color-mix(in srgb, ${cfg.color} 40%, transparent)`
                        : '2px solid transparent',
                    }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          <FormField label="Commercial Size Label" hint="Optional tier: Small / Medium / Large">
            <input
              value={sizeLabel}
              onChange={e => setSizeLabel(e.target.value)}
              placeholder="e.g. Small, 5kg, Family Pack"
              className="w-full px-4 py-2.5 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
              style={{
                background: 'var(--app-surface)',
                color: 'var(--app-foreground)',
                '--tw-ring-color': 'var(--app-primary)',
              } as React.CSSProperties}
            />
          </FormField>

          <FormField label="Description" hint="Optional notes about this group">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the purpose of this group..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl text-sm border-0 focus:outline-none focus:ring-2 resize-none"
              style={{
                background: 'var(--app-surface)',
                color: 'var(--app-foreground)',
                '--tw-ring-color': 'var(--app-primary)',
              } as React.CSSProperties}
            />
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
            style={{
              background: 'var(--app-surface)',
              color: 'var(--app-muted-foreground)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'var(--app-primary)',
              color: 'var(--app-primary-foreground, #fff)',
              boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
            }}
          >
            {creating ? (
              <RefreshCw size={14} className="animate-spin inline mr-2" />
            ) : (
              <Plus size={14} className="inline mr-2" />
            )}
            Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// GROUPING RULES TAB
// ═══════════════════════════════════════════════════════════════════
function GroupingRulesList({ rules, onReload }: { rules: GroupingRuleItem[]; onReload: () => void }) {
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDelete = useCallback(async (id: number, name: string) => {
    if (!confirm(`Delete rule "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const res = await deleteGroupingRule(id)
    if (res.success) {
      toast.success(`Deleted rule "${name}"`)
      onReload()
    } else {
      toast.error(res.error || 'Delete failed')
    }
    setDeleting(null)
  }, [onReload])

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Cog size={48} />}
        title="No Grouping Rules"
        description="Create rules to auto-generate inventory groups based on Brand, Country, Attribute, Size, and Packaging patterns."
        actionLabel="Create Rule"
        onAction={() => toast.info('Rule creation coming soon!')}
      />
    )
  }

  return (
    <div className="space-y-3">
      {rules.map(r => {
        const typeCfg = TYPE_CONFIG[r.default_group_type] || { label: r.default_group_type, color: 'var(--app-muted-foreground)', icon: <Hash size={11} /> }
        const matchCriteria = [
          r.match_brand && 'Brand',
          r.match_category && 'Category',
          r.match_parfum && 'Parfum',
          r.match_packaging_family && 'Packaging',
          r.match_size_range && 'Size Range',
        ].filter(Boolean)

        return (
          <div key={r.id} className="rounded-2xl overflow-hidden transition-all" style={{
            background: 'var(--app-card, var(--app-surface))',
            border: '1px solid var(--app-border)',
            opacity: r.is_active ? 1 : 0.6,
          }}>
            <div className="flex items-center gap-4 px-5 py-4">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                color: 'var(--app-primary)',
              }}>
                <Cog size={18} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm" style={{ color: 'var(--app-foreground)' }}>{r.name}</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{
                    background: `color-mix(in srgb, ${typeCfg.color} 12%, transparent)`,
                    color: typeCfg.color,
                  }}>
                    {typeCfg.icon}
                    {typeCfg.label}
                  </span>
                  {r.auto_approve && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                      background: 'rgba(34,197,94,0.1)',
                      color: 'var(--app-success)',
                    }}>Auto-Approve</span>
                  )}
                  {!r.is_active && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                      background: 'rgba(107,114,128,0.12)',
                      color: 'var(--app-muted-foreground)',
                    }}>Inactive</span>
                  )}
                </div>
                {/* Match criteria pills */}
                <div className="flex gap-1.5 mt-1.5">
                  {matchCriteria.map(mc => (
                    <span key={mc as string} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                      background: 'var(--app-surface-elevated, var(--app-muted))',
                      color: 'var(--app-muted-foreground)',
                    }}>
                      {mc}
                    </span>
                  ))}
                </div>
                {/* Template */}
                <div className="text-[10px] mt-1 font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                  Template: {r.auto_name_template}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 text-xs">
                <Stat label="Created" value={String(r.groups_created_count)} icon={<Boxes size={11} />} />
                <div className="text-center">
                  <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                    {r.last_executed_at
                      ? `Last: ${new Date(r.last_executed_at).toLocaleDateString()}`
                      : 'Never executed'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(r.id, r.name)}
                  disabled={deleting === r.id}
                  className="p-2 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--app-danger, #ef4444)' }}
                  title="Delete rule"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="font-bold text-sm flex items-center justify-center gap-1" style={{ color: 'var(--app-foreground)' }}>
        {icon && <span style={{ color: 'var(--app-muted-foreground)' }}>{icon}</span>}{value}
      </div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
        {label}
      </div>
    </div>
  )
}

function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-bold" style={{ color }}>{value}</span>
      <span style={{ color: 'var(--app-muted-foreground)' }}>{label}</span>
    </div>
  )
}

function ModeChip({ mode }: { mode: string }) {
  const config = MODE_LABELS[mode] || { label: mode, color: 'var(--app-muted-foreground)', icon: <Settings2 size={11} /> }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{
      background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
      color: config.color,
    }}>
      {config.icon}
      {config.label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const configs: Record<string, { label: string; bg: string; fg: string }> = {
    PRIMARY: { label: 'Primary', bg: 'rgba(59,130,246,0.12)', fg: 'var(--app-info)' },
    TWIN: { label: 'Twin', bg: 'rgba(34,197,94,0.12)', fg: 'var(--app-success)' },
    SUBSTITUTE: { label: 'Substitute', bg: 'rgba(251,191,36,0.12)', fg: 'var(--app-warning)' },
    NOT_SUB: { label: 'No Sub', bg: 'rgba(107,114,128,0.12)', fg: 'var(--app-muted-foreground)' },
  }
  const c = configs[role] || configs.NOT_SUB
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
      background: c.bg, color: c.fg,
    }}>
      {c.label}
    </span>
  )
}

function SummaryCard({ label, value, sub, small, icon }: {
  label: string; value: number | string; sub?: string; small?: boolean; icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)' }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted-foreground)' }}>
        {icon} {label}
      </div>
      <div className={`font-bold ${small ? 'text-xs' : 'text-lg'}`} style={{ color: 'var(--app-foreground)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--app-muted-foreground)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function FormField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs uppercase font-bold tracking-wider mb-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
        {label}
        {required && <span style={{ color: 'var(--app-danger, #ef4444)' }}>*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</p>
      )}
    </div>
  )
}

function EmptyState({ icon, title, description, actionLabel, onAction }: {
  icon: React.ReactNode; title: string; description: string; actionLabel?: string; onAction?: () => void
}) {
  return (
    <div className="text-center py-20 rounded-2xl" style={{
      background: 'var(--app-surface)',
      border: '1px dashed var(--app-border)',
    }}>
      <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center" style={{
        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
        color: 'var(--app-primary)',
      }}>
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--app-foreground)' }}>{title}</h3>
      <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--app-muted-foreground)' }}>{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
          style={{
            background: 'var(--app-primary)',
            color: 'var(--app-primary-foreground, #fff)',
            boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
          }}
        >
          <Plus size={14} className="inline mr-2" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
