'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  getInventoryGroup, getInventoryGroupSummary, updateInventoryGroup,
  deleteInventoryGroup, addInventoryGroupMember, removeInventoryGroupMember,
} from '@/app/actions/inventory/grouping'
import { erpFetch } from '@/lib/erp-api'
import {
  ArrowLeft, Package, Globe, BarChart3, Trash2, Plus, Edit3, Save,
  RefreshCw, AlertTriangle, CheckCircle2, X, Search, Link2, Zap,
  Boxes, TrendingUp, TrendingDown, DollarSign, Users, Hash, Eye,
  Shield, ChevronDown, Activity, Settings2,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EXACT: { label: 'Exact Twins', color: 'var(--app-primary)', icon: <Link2 size={14} /> },
  SIMILAR: { label: 'Similar Substitute', color: 'var(--app-warning)', icon: <Zap size={14} /> },
  FAMILY: { label: 'Product Family', color: 'var(--app-info)', icon: <Boxes size={14} /> },
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; fg: string; desc: string }> = {
  PRIMARY: { label: 'Primary', bg: 'rgba(59,130,246,0.12)', fg: 'var(--app-info)', desc: 'Default/preferred variant' },
  TWIN: { label: 'Twin', bg: 'rgba(34,197,94,0.12)', fg: 'var(--app-success)', desc: 'Identical, different source' },
  SUBSTITUTE: { label: 'Substitute', bg: 'rgba(251,191,36,0.12)', fg: 'var(--app-warning)', desc: 'Interchangeable alternative' },
  NOT_SUB: { label: 'No Sub', bg: 'rgba(107,114,128,0.12)', fg: 'var(--app-muted-foreground)', desc: 'Analytics only' },
}

// ═══════════════════════════════════════════════════════════════════
// DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════
export default function ProductGroupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [group, setGroup] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({ name: '', group_type: '', commercial_size_label: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [gRes, sRes] = await Promise.all([
        getInventoryGroup(id),
        getInventoryGroupSummary(id),
      ])
      if (gRes.success) {
        setGroup(gRes.data)
        setEditFields({
          name: gRes.data.name || '',
          group_type: gRes.data.group_type || 'EXACT',
          commercial_size_label: gRes.data.commercial_size_label || '',
          description: gRes.data.description || '',
        })
      }
      if (sRes.success) setSummary(sRes.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const res = await updateInventoryGroup(id, editFields)
    if (res.success) {
      toast.success('Group updated')
      setEditing(false)
      loadAll()
    } else {
      toast.error(res.error || 'Update failed')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${group?.name}"? This removes the group but not the products.`)) return
    const res = await deleteInventoryGroup(id)
    if (res.success) {
      toast.success('Group deleted')
      router.push('/inventory/product-groups')
    } else {
      toast.error(res.error || 'Delete failed')
    }
  }

  async function handleRemoveMember(memberId: number, productName: string) {
    if (!confirm(`Remove "${productName}" from this group?`)) return
    const res = await removeInventoryGroupMember(memberId)
    if (res.success) {
      toast.success(`Removed "${productName}"`)
      loadAll()
    } else {
      toast.error(res.error || 'Remove failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" style={{ color: 'var(--app-muted-foreground)' }}>
        <RefreshCw size={24} className="animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-4" style={{ color: 'var(--app-muted-foreground)' }}>Group not found</p>
        <button onClick={() => router.back()} className="px-4 py-2 rounded-xl text-sm font-bold" style={{
          background: 'var(--app-surface)', color: 'var(--app-foreground)',
        }}>Go Back</button>
      </div>
    )
  }

  const typeCfg = TYPE_CONFIG[group.group_type] || TYPE_CONFIG.EXACT
  const variants = summary?.variants || []
  const primaryVariant = variants.find((v: any) => v.substitution_role === 'PRIMARY')

  return (
    <div className="space-y-6 p-1">
      {/* ── Back + Header ── */}
      <div>
        <button
          onClick={() => router.push('/inventory/product-groups')}
          className="flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--app-muted-foreground)' }}
        >
          <ArrowLeft size={16} />
          Back to Product Groups
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
              background: `color-mix(in srgb, ${typeCfg.color} 15%, transparent)`,
              color: typeCfg.color,
              border: `1px solid color-mix(in srgb, ${typeCfg.color} 25%, transparent)`,
            }}>
              {typeCfg.icon}
            </div>
            <div>
              {editing ? (
                <input
                  value={editFields.name}
                  onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                  className="text-2xl font-black bg-transparent border-b-2 outline-none"
                  style={{ color: 'var(--app-foreground)', borderColor: 'var(--app-primary)' }}
                />
              ) : (
                <h1 style={{ color: 'var(--app-foreground)' }}>
                  {group.name}
                </h1>
              )}
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full" style={{
                  background: `color-mix(in srgb, ${typeCfg.color} 12%, transparent)`,
                  color: typeCfg.color,
                }}>
                  {typeCfg.icon}{typeCfg.label}
                </span>
                {group.brand_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: 'var(--app-surface-elevated, var(--app-muted))',
                    color: 'var(--app-muted-foreground)',
                  }}>{group.brand_name}</span>
                )}
                {group.commercial_size_label && (
                  <span className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                    {group.commercial_size_label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{
                  background: 'var(--app-surface)', color: 'var(--app-muted-foreground)',
                }}>
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{
                  background: 'var(--app-primary)', color: 'var(--app-primary-foreground, #fff)',
                }}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{
                  background: 'var(--app-surface)', color: 'var(--app-foreground)',
                }}>
                  <Edit3 size={14} /> Edit
                </button>
                <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{
                  background: 'rgba(239,68,68,0.1)', color: 'var(--app-danger, #ef4444)',
                }}>
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Form (collapsed) ── */}
      {editing && (
        <div className="rounded-2xl p-5 space-y-4" style={{
          background: 'var(--app-card, var(--app-surface))',
          border: '1px solid var(--app-border)',
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Group Type">
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button key={key}
                    onClick={() => setEditFields(f => ({ ...f, group_type: key }))}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: editFields.group_type === key ? `color-mix(in srgb, ${cfg.color} 15%, transparent)` : 'var(--app-surface)',
                      color: editFields.group_type === key ? cfg.color : 'var(--app-muted-foreground)',
                      border: editFields.group_type === key ? `2px solid color-mix(in srgb, ${cfg.color} 40%, transparent)` : '2px solid transparent',
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                ))}
              </div>
            </FieldRow>
            <FieldRow label="Size Label">
              <input
                value={editFields.commercial_size_label}
                onChange={e => setEditFields(f => ({ ...f, commercial_size_label: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
                style={{ background: 'var(--app-surface)', color: 'var(--app-foreground)', '--tw-ring-color': 'var(--app-primary)' } as React.CSSProperties}
                placeholder="e.g. Small, 5kg, 200ml"
              />
            </FieldRow>
          </div>
          <FieldRow label="Description">
            <textarea
              value={editFields.description}
              onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 rounded-xl text-sm border-0 focus:outline-none focus:ring-2 resize-none"
              style={{ background: 'var(--app-surface)', color: 'var(--app-foreground)', '--tw-ring-color': 'var(--app-primary)' } as React.CSSProperties}
              placeholder="Notes about this group..."
            />
          </FieldRow>
        </div>
      )}

      {/* ── Description (view mode) ── */}
      {!editing && group.description && (
        <div className="rounded-2xl p-4" style={{
          background: 'var(--app-card, var(--app-surface))',
          border: '1px solid var(--app-border)',
        }}>
          <p className="text-sm" style={{ color: 'var(--app-muted-foreground)' }}>{group.description}</p>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard icon={<BarChart3 size={18} />} label="Total Stock" value={Math.round(summary.total_stock)} color="var(--app-primary)" />
          <KPICard icon={<Package size={18} />} label="Variants" value={summary.member_count} color="var(--app-info)" />
          <KPICard icon={<Globe size={18} />} label="Countries" value={summary.country_count} color="var(--app-success)" sub={summary.countries?.join(', ')} />
          <KPICard icon={<DollarSign size={18} />} label="Avg Cost" value={summary.avg_cost?.toFixed(2)} color="var(--app-warning)" />
          <KPICard icon={<AlertTriangle size={18} />} label="Low Stock" value={summary.low_stock_variants} color="var(--app-danger, #ef4444)" alert={summary.low_stock_variants > 0} />
        </div>
      )}

      {/* ── Quick Intelligence Bar ── */}
      {summary && (summary.cheapest_source || summary.best_margin_source) && (
        <div className="flex flex-wrap gap-4 rounded-2xl px-5 py-3" style={{
          background: 'var(--app-card, var(--app-surface))',
          border: '1px solid var(--app-border)',
        }}>
          {summary.cheapest_source && (
            <div className="flex items-center gap-2 text-xs">
              <TrendingDown size={14} style={{ color: 'var(--app-success)' }} />
              <span style={{ color: 'var(--app-muted-foreground)' }}>Cheapest Source:</span>
              <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{summary.cheapest_source}</span>
            </div>
          )}
          {summary.best_margin_source && (
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp size={14} style={{ color: 'var(--app-info)' }} />
              <span style={{ color: 'var(--app-muted-foreground)' }}>Best Margin:</span>
              <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{summary.best_margin_source}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Members Section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ color: 'var(--app-foreground)' }}>
            Members ({variants.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="p-2 rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--app-primary)',
                color: 'var(--app-primary-foreground, #fff)',
                boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
              }}
            >
              <Plus size={14} />
              Add Member
            </button>
          </div>
        </div>

        {variants.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{
            background: 'var(--app-surface)',
            border: '1px dashed var(--app-border)',
          }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{
              background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
              color: 'var(--app-primary)',
            }}>
              <Package size={24} />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--app-foreground)' }}>No members yet</p>
            <p className="text-xs mb-4" style={{ color: 'var(--app-muted-foreground)' }}>
              Add products to this group to aggregate stock intelligence
            </p>
            <button
              onClick={() => setShowAddMember(true)}
              className="px-5 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'var(--app-primary)', color: 'var(--app-primary-foreground, #fff)' }}
            >
              <Plus size={14} className="inline mr-2" />
              Add First Member
            </button>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{
            background: 'var(--app-card, var(--app-surface))',
            border: '1px solid var(--app-border)',
          }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Origin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Size</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">Sell</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">Margin</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">Role</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v: any, i: number) => {
                  const roleCfg = ROLE_CONFIG[v.substitution_role] || ROLE_CONFIG.NOT_SUB
                  const isLow = v.is_low_stock
                  const marginColor = v.margin_pct < 0
                    ? 'var(--app-danger, #ef4444)'
                    : v.margin_pct < 10
                      ? 'var(--app-warning)'
                      : 'var(--app-foreground)'

                  return (
                    <tr key={v.product_id} style={{
                      borderTop: i > 0 ? '1px solid var(--app-border)' : undefined,
                      background: v.substitution_role === 'PRIMARY'
                        ? 'color-mix(in srgb, var(--app-primary) 3%, transparent)' : undefined,
                    }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm" style={{ color: 'var(--app-foreground)' }}>
                          {v.product_name}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>{v.product_sku}</div>
                      </td>
                      <td className="px-4 py-3">
                        {v.country ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Globe size={10} style={{ color: 'var(--app-info)' }} />
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                              background: 'rgba(59,130,246,0.1)', color: 'var(--app-info)',
                            }}>{v.country}</span>
                          </span>
                        ) : <span className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {v.size ? `${v.size}${v.size_unit || ''}` : '—'}
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-bold text-sm" style={{
                          color: isLow ? 'var(--app-danger, #ef4444)' : 'var(--app-foreground)',
                        }}>
                          {Math.round(v.stock_qty)}
                        </span>
                        {isLow && <AlertTriangle size={10} className="inline ml-1" style={{ color: 'var(--app-danger, #ef4444)' }} />}
                      </td>
                      <td className="text-right px-4 py-3 text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {v.cost_price?.toFixed(2) ?? '—'}
                      </td>
                      <td className="text-right px-4 py-3 text-sm font-semibold" style={{ color: 'var(--app-foreground)' }}>
                        {v.selling_price_ttc?.toFixed(2) ?? '—'}
                      </td>
                      <td className="text-right px-4 py-3 text-sm font-bold" style={{ color: marginColor }}>
                        {v.margin_pct?.toFixed(1)}%
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{
                          background: roleCfg.bg, color: roleCfg.fg,
                        }}>
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="text-center px-2 py-3">
                        <button
                          onClick={() => handleRemoveMember(v.product_id, v.product_name)}
                          className="p-1.5 rounded-lg transition-all hover:scale-110 opacity-40 hover:opacity-100"
                          style={{ color: 'var(--app-danger, #ef4444)' }}
                          title="Remove from group"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Member Modal ── */}
      {showAddMember && (
        <AddMemberModal
          groupId={Number(id)}
          onClose={() => setShowAddMember(false)}
          onAdded={() => { setShowAddMember(false); loadAll() }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ADD MEMBER MODAL
// ═══════════════════════════════════════════════════════════════════
function AddMemberModal({ groupId, onClose, onAdded }: {
  groupId: number; onClose: () => void; onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [role, setRole] = useState('TWIN')

  async function searchProducts(q: string) {
    if (q.length < 2) { setProducts([]); return }
    setLoading(true)
    try {
      const data = await erpFetch(`inventory/products/?search=${encodeURIComponent(q)}&page_size=20`)
      setProducts(Array.isArray(data) ? data : (data?.results || []))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function handleAdd(productId: number) {
    setAdding(productId)
    const res = await addInventoryGroupMember({
      group: groupId,
      product: productId,
      substitution_role: role,
    })
    if (res.success) {
      toast.success('Product added to group')
      onAdded()
    } else {
      toast.error(res.error || 'Failed to add')
    }
    setAdding(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col"
        style={{
          background: 'var(--app-bg)',
          border: '1px solid var(--app-border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)',
            }}>
              <Plus size={20} />
            </div>
            <div>
              <h3 style={{ color: 'var(--app-foreground)' }}>Add Member Product</h3>
              <p className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>Search for products to add to this group</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:opacity-70" style={{ color: 'var(--app-muted-foreground)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Role Selector */}
        <div className="px-5 pb-3">
          <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
            Substitution Role
          </label>
          <div className="flex gap-2">
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setRole(key)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all text-center"
                style={{
                  background: role === key ? cfg.bg : 'var(--app-surface)',
                  color: role === key ? cfg.fg : 'var(--app-muted-foreground)',
                  border: role === key ? `2px solid color-mix(in srgb, ${cfg.fg} 30%, transparent)` : '2px solid transparent',
                }}
              >
                {cfg.label}
                <div className="text-[9px] font-medium mt-0.5" style={{
                  color: role === key ? cfg.fg : 'var(--app-muted-foreground)', opacity: 0.7,
                }}>{cfg.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name, SKU, barcode..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
              style={{
                background: 'var(--app-surface)', color: 'var(--app-foreground)',
                '--tw-ring-color': 'var(--app-primary)',
              } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="text-center py-8" style={{ color: 'var(--app-muted-foreground)' }}>
              <RefreshCw size={18} className="animate-spin inline" />
            </div>
          ) : search.length < 2 ? (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
              Type at least 2 characters to search
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
              No products found for "{search}"
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:opacity-80" style={{
                  background: 'var(--app-surface)',
                }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: 'var(--app-foreground)' }}>
                      {p.name}
                    </div>
                    <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
                      <span>{p.sku}</span>
                      {p.brand_name && <span>• {p.brand_name}</span>}
                      {p.selling_price_ttc && <span>• {Number(p.selling_price_ttc).toFixed(2)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(p.id)}
                    disabled={adding === p.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-primary-foreground, #fff)' }}
                  >
                    {adding === p.id ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} className="inline mr-1" />}
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function KPICard({ icon, label, value, color, alert, sub }: {
  icon: React.ReactNode; label: string; value: any; color: string; alert?: boolean; sub?: string
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{
      background: 'var(--app-card, var(--app-surface))',
      border: alert ? `1px solid color-mix(in srgb, ${color} 40%, transparent)` : '1px solid var(--app-border)',
    }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.04]" style={{
        background: color, transform: 'translate(30%, -30%)',
      }} />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
          background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
        }}>
          {icon}
        </div>
        <div>
          <div className="text-xl font-black" style={{ color: 'var(--app-foreground)' }}>{value}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
          {sub && <div className="text-[9px] truncate max-w-[120px]" style={{ color: 'var(--app-muted-foreground)' }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase font-bold tracking-wider mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
