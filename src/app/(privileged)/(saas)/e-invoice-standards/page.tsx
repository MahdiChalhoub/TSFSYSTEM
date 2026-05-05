'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Zap, Plus, Trash2, Loader2, FileText, ChevronDown,
  Save, ArrowLeft, Check, Globe, Key, Image, Edit2,
  Link as LinkIcon, AlertTriangle, GripVertical, X
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

const SectionCard = ({ title, icon, color, children, action }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="rounded-xl overflow-hidden mb-2" style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
    <div className="px-3 py-2 flex items-center justify-between" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${color} 12%, transparent)` }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] font-black text-app-foreground tracking-tight">{title}</span>
      </div>
      {action}
    </div>
    <div className="px-3 py-2.5">{children}</div>
  </div>
)

type FieldDef = { key: string; label: string; type: string; required: boolean; placeholder?: string; help?: string }
type EInvoiceStandard = {
  id?: number; code: string; name: string; description: string; region: string;
  invoice_format: string; schema_version: string;
  required_credentials: FieldDef[]; branding_fields: FieldDef[];
  setup_guide: string; portal_url: string; documentation_url: string;
  is_active: boolean; created_at?: string; updated_at?: string;
}

const inputCls = "w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 focus:border-app-border transition-all"
const EMPTY: EInvoiceStandard = {
  code: '', name: '', description: '', region: '', invoice_format: 'XML', schema_version: '',
  required_credentials: [], branding_fields: [],
  setup_guide: '', portal_url: '', documentation_url: '', is_active: true,
}
const FIELD_TYPES = ['text', 'password', 'url', 'email', 'file', 'image', 'textarea']
const FORMAT_LABELS: Record<string,string> = { XML: 'XML (UBL/CII)', JSON: 'JSON', PDF_A3: 'PDF/A-3', HYBRID: 'Hybrid (XML+PDF)' }

/* ── Field Builder Component ─────────────────────── */
function FieldBuilder({ fields, onChange, label, color }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void; label: string; color: string }) {
  const add = () => onChange([...fields, { key: '', label: '', type: 'text', required: true }])
  const rm = (i: number) => onChange(fields.filter((_, j) => j !== i))
  const upd = (i: number, key: keyof FieldDef, val: any) => {
    const nf = [...fields]; nf[i] = { ...nf[i], [key]: val }; onChange(nf)
  }
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{label} ({fields.length})</span>
        <button onClick={add} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 text-white"
          style={{ background: color }}><Plus size={10} /> Add Field</button>
      </div>
      {fields.length === 0 ? (
        <p className="text-[11px] text-app-muted-foreground italic py-3 text-center">No fields defined — click "Add Field" to start</p>
      ) : (
        <div className="space-y-1.5">
          {fields.map((f, i) => (
            <div key={i} className="rounded-lg overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
              {/* Summary row — always visible */}
              <div className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer hover:bg-app-surface/50 transition-colors"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
                <GripVertical size={10} className="text-app-muted-foreground flex-shrink-0 opacity-40" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-app-foreground truncate">
                      {f.label || <span className="italic text-app-muted-foreground">Untitled field</span>}
                    </span>
                    {f.key && (
                      <span className="text-[8px] font-bold text-app-muted-foreground px-1 py-px rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>{f.key}</span>
                    )}
                  </div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>{f.type}</span>
                <label className="flex items-center gap-0.5 flex-shrink-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={f.required} onChange={e => upd(i, 'required', e.target.checked)} className="rounded" />
                  <span className="text-[8px] font-bold text-app-muted-foreground">REQ</span>
                </label>
                <button onClick={e => { e.stopPropagation(); rm(i) }} className="p-0.5 hover:bg-app-border/50 rounded transition-colors" style={{ color: 'var(--app-error)' }}><X size={11} /></button>
                <ChevronDown size={10} className="text-app-muted-foreground flex-shrink-0 transition-transform"
                  style={{ transform: expandedIdx === i ? 'rotate(180deg)' : undefined }} />
              </div>

              {/* Expanded edit row */}
              {expandedIdx === i && (
                <div className="px-2.5 pb-2.5 pt-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '6px' }}>
                    <div>
                      <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5 block">Key</label>
                      <input className={inputCls + ' !text-[10px] !px-1.5 !py-1'} placeholder="api_key" value={f.key} onChange={e => upd(i, 'key', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5 block">Label</label>
                      <input className={inputCls + ' !text-[10px] !px-1.5 !py-1'} placeholder="Display label" value={f.label} onChange={e => upd(i, 'label', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5 block">Type</label>
                      <select className={inputCls + ' !text-[10px] !px-1 !py-1'} value={f.type} onChange={e => upd(i, 'type', e.target.value)}>
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }} className="mt-1.5">
                    <div>
                      <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5 block">Placeholder</label>
                      <input className={inputCls + ' !text-[10px] !px-1.5 !py-1'} placeholder="Example value..." value={f.placeholder || ''} onChange={e => upd(i, 'placeholder', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5 block">Help Text</label>
                      <input className={inputCls + ' !text-[10px] !px-1.5 !py-1'} placeholder="Instructions for the tenant..." value={f.help || ''} onChange={e => upd(i, 'help', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function EInvoiceStandardsPage() {
  const [standards, setStandards] = useState<EInvoiceStandard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EInvoiceStandard | null>(null)
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [refCountries, setRefCountries] = useState<{ iso2: string; name: string }[]>([])

  useEffect(() => {
    erpFetch('reference/countries/?limit=300').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      setRefCountries(list.map((c: any) => ({ iso2: c.iso2 || c.code || '', name: c.name || c.country_name || '' })))
    }).catch(() => {})
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await erpFetch('finance/einvoice-standards/')
      setStandards(Array.isArray(data) ? data : data?.results || [])
    } catch { toast.error('Failed to load standards') }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSave = async () => {
    if (!editing) return
    if (!editing.code || !editing.name) { toast.error('Code and name are required'); return }
    setSaving(true)
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const url = editing.id ? `finance/einvoice-standards/${editing.id}/` : 'finance/einvoice-standards/'
      const result = await erpFetch(url, { method, body: JSON.stringify(editing) })
      toast.success(editing.id ? 'Standard updated' : 'Standard created')
      if (!editing.id && result?.id) setEditing({ ...editing, id: result.id })
      else setEditing(null)
      fetchAll()
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this e-invoice standard?')) return
    try {
      await erpFetch(`finance/einvoice-standards/${id}/`, { method: 'DELETE' })
      toast.success('Standard deleted')
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  const filtered = standards.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)
  })

  /* ── EDITOR VIEW ─────────────────── */
  if (editing) {
    const upd = (k: keyof EInvoiceStandard, v: any) => setEditing(e => e ? { ...e, [k]: v } : e)
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
              <ArrowLeft size={12} /> Back
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}>
              <Zap size={14} style={{ color: 'var(--app-accent)' }} />
            </div>
            <div>
              <div className="text-[14px] font-black text-app-foreground">{editing.id ? editing.name : 'New Standard'}</div>
              <div className="text-[10px] font-bold text-app-muted-foreground">{editing.id ? `Code: ${editing.code}` : 'Define a new e-invoicing standard'}</div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 rounded-xl p-3"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          
          {/* Identity */}
          <SectionCard title="Identity" icon={<Globe size={12} />} color="var(--app-accent)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Code</label>
                <input className={inputCls} value={editing.code} placeholder="ZATCA" onChange={e => upd('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} />
              </div>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Display Name</label>
                <input className={inputCls} value={editing.name} placeholder="ZATCA FATOORA (Saudi Arabia)" onChange={e => upd('name', e.target.value)} />
              </div>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Region / Country</label>
                <select className={inputCls} value={editing.region} onChange={e => upd('region', e.target.value)}>
                  <option value="">— Select Country —</option>
                  {refCountries.map(c => <option key={c.iso2} value={c.name}>{c.iso2} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Invoice Format</label>
                <select className={inputCls} value={editing.invoice_format} onChange={e => upd('invoice_format', e.target.value)}>
                  {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Schema Version</label>
                <input className={inputCls} value={editing.schema_version} placeholder="UBL 2.1" onChange={e => upd('schema_version', e.target.value)} />
              </div>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Status</label>
                <label className="flex items-center gap-1.5 cursor-pointer mt-1.5">
                  <input type="checkbox" checked={editing.is_active !== false} onChange={e => upd('is_active', e.target.checked)} className="rounded" />
                  <span className="text-[12px] font-bold text-app-foreground">Active</span>
                </label>
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Description</label>
              <textarea className={inputCls + ' min-h-[40px]'} value={editing.description} placeholder="When and why this standard is used..."
                onChange={e => upd('description', e.target.value)} />
            </div>
          </SectionCard>

          {/* Credentials */}
          <SectionCard title="Required Credentials" icon={<Key size={12} />} color="var(--app-warning, #f59e0b)">
            <p className="text-[10px] text-app-muted-foreground mb-2">Define the fields tenants must fill to activate e-invoicing. Each field becomes an input in the tenant's settings.</p>
            <FieldBuilder fields={editing.required_credentials} onChange={f => upd('required_credentials', f)} label="Credential Fields" color="var(--app-warning, #f59e0b)" />
          </SectionCard>

          {/* Branding */}
          <SectionCard title="Branding Customization" icon={<Image size={12} />} color="var(--app-info, #3b82f6)">
            <p className="text-[10px] text-app-muted-foreground mb-2">Optional fields tenants can customize (logo, invoice header, footer text, etc).</p>
            <FieldBuilder fields={editing.branding_fields} onChange={f => upd('branding_fields', f)} label="Branding Fields" color="var(--app-info, #3b82f6)" />
          </SectionCard>

          {/* Setup Guide */}
          <SectionCard title="Setup Guide & Links" icon={<FileText size={12} />} color="var(--app-success, #22c55e)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Portal URL</label>
                <input className={inputCls} value={editing.portal_url} placeholder="https://portal.example.gov/" onChange={e => upd('portal_url', e.target.value)} />
              </div>
              <div>
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Documentation URL</label>
                <input className={inputCls} value={editing.documentation_url} placeholder="https://docs.example.gov/" onChange={e => upd('documentation_url', e.target.value)} />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Setup Instructions (for tenant onboarding)</label>
              <textarea className={inputCls + ' min-h-[80px]'} value={editing.setup_guide}
                placeholder="Step-by-step instructions...&#10;1. Register at the portal&#10;2. Get API credentials&#10;3. Upload certificate"
                onChange={e => upd('setup_guide', e.target.value)} />
            </div>
          </SectionCard>
        </div>
      </div>
    )
  }

  /* ── LISTING VIEW ─────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--app-accent) 0%, #6d28d9 100%)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-accent) 30%, transparent)' }}>
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h1>E-Invoice Standards</h1>
            <p className="text-[10px] font-bold text-app-muted-foreground">Manage e-invoicing standards. Tenants inherit these from their country template.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <input ref={searchRef} className={inputCls + ' !w-44 !text-[11px]'} placeholder="⌘K Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setEditing({ ...EMPTY })}
            className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
            <Plus size={12} /> New Standard
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Zap size={40} className="text-app-muted-foreground mb-3 opacity-20" />
            <p className="text-[14px] font-bold text-app-muted-foreground">{search ? 'No matching standards' : 'No standards yet'}</p>
            <p className="text-[11px] text-app-muted-foreground mt-1">Create standards like ZATCA, UBL/PEPPOL, Factur-X</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {filtered.map(s => (
              <div key={s.id} className="group rounded-xl cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                onClick={() => setEditing({ ...s })}
                style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="px-3.5 py-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', color: 'var(--app-accent)' }}>
                      <Zap size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black text-app-foreground truncate">{s.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-black px-1.5 py-px rounded-md" style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', color: 'var(--app-accent)' }}>{s.code}</span>
                        <span className="text-[9px] font-bold text-app-muted-foreground">{FORMAT_LABELS[s.invoice_format] || s.invoice_format}</span>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); if (s.id) handleDelete(s.id) }}
                      className="p-1 hover:bg-app-border/50 rounded-md opacity-0 group-hover:opacity-100 transition-all" style={{ color: 'var(--app-error)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {s.region && <div className="text-[10px] font-bold text-app-muted-foreground mb-1.5"><Globe size={9} className="inline mr-1" />{s.region}</div>}
                  <div className="flex items-center gap-2 text-[9px] font-bold text-app-muted-foreground">
                    <span><Key size={9} className="inline mr-0.5" />{s.required_credentials.length} credentials</span>
                    <span><Image size={9} className="inline mr-0.5" />{s.branding_fields.length} branding</span>
                    {s.schema_version && <span className="truncate max-w-[100px]">{s.schema_version}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
