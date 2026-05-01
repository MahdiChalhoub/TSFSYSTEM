'use client'

import { useState } from 'react'
import {
    Plus, Edit3, Save, X, Loader2, FolderTree,
    Monitor, BookOpen, Zap, ChevronDown, ChevronRight, Info
} from 'lucide-react'
import { COATreePicker } from './COATreePicker'
import { ICON_OPTIONS, COLOR_PRESETS, getIcon, DEFAULT_COLOR } from './constants'

export type CategoryFormData = {
    name: string
    code: string
    icon: string
    color: string
    description: string
    coa_parent: string
    sort_order: number
    // Defaults
    default_pos_enabled: boolean
    default_has_account_book: boolean
    // Digital
    is_digital: boolean
    digital_gateway: string   // OrgPaymentGateway ID (FK)
}

/* ── Reusable Toggle ── */
function Toggle({ on, onToggle, icon: Icon, color, title, desc }: {
    on: boolean; onToggle: () => void; icon: any; color: string; title: string; desc: string
}) {
    const c = on ? color : 'var(--app-muted-foreground)'
    return (
        <button type="button" onClick={onToggle}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all w-full"
            style={{
                background: on ? `color-mix(in srgb, ${color} 8%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                border: `1px solid color-mix(in srgb, ${on ? color : 'var(--app-border)'} ${on ? '30' : '40'}%, transparent)`,
            }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
                <Icon size={14} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black text-app-foreground">{title}</div>
                <div className="text-[9px] font-bold text-app-muted-foreground">{desc}</div>
            </div>
            <div className={`w-8 h-[18px] rounded-full flex items-center transition-all shrink-0 ${on ? 'justify-end' : 'justify-start'}`}
                style={{ background: on ? color : 'color-mix(in srgb, var(--app-border) 70%, transparent)' }}>
                <div className="w-3.5 h-3.5 rounded-full shadow mx-0.5" style={{ background: 'var(--app-bg, #fff)' }} />
            </div>
        </button>
    )
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, color, collapsed, onToggle }: {
    icon: any; title: string; color: string; collapsed?: boolean; onToggle?: () => void
}) {
    return (
        <button type="button" onClick={onToggle}
            className="flex items-center gap-2 w-full text-left py-1.5 group">
            <div className="w-5 h-5 rounded flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                <Icon size={11} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground flex-1">{title}</span>
            {onToggle && (
                collapsed
                    ? <ChevronRight size={12} className="text-app-muted-foreground opacity-50" />
                    : <ChevronDown size={12} className="text-app-muted-foreground opacity-50" />
            )}
        </button>
    )
}

/* ── Input styles ── */
const inputCls = "w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 transition-all"
const labelCls = "text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block"

/* ═══════════════════════════════════════════════════════════
 *  CATEGORY FORM MODAL — V2 Redesign (API-driven providers)
 * ═══════════════════════════════════════════════════════════ */
export function CategoryFormModal({ form, setForm, coaList, editingId, saving, onSave, onClose, orgGateways }: {
    form: CategoryFormData
    setForm: React.Dispatch<React.SetStateAction<CategoryFormData>>
    coaList: any[]
    editingId: number | null
    saving: boolean
    onSave: () => void
    onClose: () => void
    orgGateways: any[]   // OrgPaymentGateway[] from API
}) {
    const [digitalExpanded, setDigitalExpanded] = useState(form.is_digital)
    const [coaExpanded, setCoaExpanded] = useState(!!form.coa_parent)

    const selectedGw = orgGateways.find((g: any) => String(g.id) === form.digital_gateway)
    const PreviewIcon = getIcon(form.icon)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-primary) 20%, var(--app-border))' }}>

                {/* ── Modal Header ── */}
                <div className="flex justify-between items-center px-5 py-3 border-b shrink-0"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${form.color || DEFAULT_COLOR} 12%, transparent)`, color: form.color || DEFAULT_COLOR }}>
                            <PreviewIcon size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground flex items-center gap-2">
                                {editingId ? <Edit3 size={12} style={{ color: 'var(--app-primary)' }} /> : <Plus size={12} style={{ color: 'var(--app-primary)' }} />}
                                {editingId ? 'Edit Category' : 'New Category'}
                            </h3>
                            <p className="text-[9px] font-bold text-app-muted-foreground">{form.name || 'Untitled'} · {form.code || 'CODE'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground p-1.5 rounded-lg hover:bg-app-bg transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">

                    {/* ═══ SECTION 1: Identity ═══ */}
                    <div className="space-y-3">
                        <SectionHeader icon={Edit3} title="Identity" color="var(--app-primary)" />

                        {/* Name + Code */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px' }}>
                            <div>
                                <label className={labelCls}>Name <span style={{ color: 'var(--app-error, #ef4444)' }}>*</span></label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Cash Drawers, Electronic Wallets" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Code <span style={{ color: 'var(--app-error, #ef4444)' }}>*</span></label>
                                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    placeholder="CASH" className={`${inputCls} font-mono`} />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className={labelCls}>Description</label>
                            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Physical cash registers, tills, and petty cash boxes" className={inputCls} />
                        </div>

                        {/* Icon + Color + Sort */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '10px' }}>
                            <div>
                                <label className={labelCls}>Icon</label>
                                <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                                    className={`${inputCls} appearance-none`}
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                                    {ICON_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                                        className="w-8 h-8 rounded-lg border border-app-border/50 cursor-pointer shrink-0" />
                                    <div className="flex gap-1 flex-wrap">
                                        {COLOR_PRESETS.slice(0, 6).map(c => (
                                            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                                                className={`w-4 h-4 rounded-full border transition-all ${form.color === c ? 'border-app-foreground scale-125' : 'border-transparent hover:scale-110'}`}
                                                style={{ background: c }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Sort</label>
                                <input type="number" value={form.sort_order}
                                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                                    className={`${inputCls} text-center`} />
                            </div>
                        </div>
                    </div>

                    {/* ═══ SECTION 2: Child Account Defaults ═══ */}
                    <div className="space-y-3">
                        <SectionHeader icon={BookOpen} title="Child Account Defaults" color="var(--app-info, #3b82f6)" />

                        <div className="rounded-xl px-3 py-2 text-[10px] font-bold flex items-start gap-2"
                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)', color: 'var(--app-info, #3b82f6)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)' }}>
                            <Info size={12} className="shrink-0 mt-0.5" />
                            <span>These settings are inherited by new accounts in this category. Each account can override them individually.</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <Toggle
                                on={form.default_pos_enabled}
                                onToggle={() => setForm(f => ({ ...f, default_pos_enabled: !f.default_pos_enabled }))}
                                icon={Monitor}
                                color="var(--app-success, #22c55e)"
                                title="POS Enabled"
                                desc={form.default_pos_enabled ? 'New accounts visible in POS' : 'New accounts hidden from POS'}
                            />
                            <Toggle
                                on={form.default_has_account_book}
                                onToggle={() => setForm(f => ({ ...f, default_has_account_book: !f.default_has_account_book }))}
                                icon={BookOpen}
                                color="var(--app-info, #3b82f6)"
                                title="Account Book"
                                desc={form.default_has_account_book ? 'Dedicated ledger enabled' : 'No separate ledger'}
                            />
                        </div>
                    </div>

                    {/* ═══ SECTION 3: Digital Account ═══ */}
                    <div className="space-y-3">
                        <SectionHeader
                            icon={Zap} title="Digital Integration" color="#8b5cf6"
                            collapsed={!digitalExpanded}
                            onToggle={() => setDigitalExpanded(!digitalExpanded)}
                        />

                        <Toggle
                            on={form.is_digital}
                            onToggle={() => {
                                const next = !form.is_digital
                                setForm(f => ({ ...f, is_digital: next, digital_gateway: next ? f.digital_gateway : '' }))
                                if (next) setDigitalExpanded(true)
                            }}
                            icon={Zap}
                            color="#8b5cf6"
                            title="Digital Account"
                            desc={form.is_digital ? 'Child accounts can connect to a payment gateway' : 'Standard physical/manual account'}
                        />

                        {form.is_digital && digitalExpanded && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {orgGateways.length === 0 ? (
                                    <div className="rounded-xl px-3 py-3 text-[10px] font-bold text-center"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' }}>
                                        No payment gateways activated for this organization. Go to Settings → Payment Gateways to activate providers.
                                    </div>
                                ) : (
                                    <>
                                        {/* Provider Selection Grid — from API */}
                                        <div>
                                            <label className={labelCls}>Default Payment Provider</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {orgGateways.filter((g: any) => g.is_enabled).map((gw: any) => (
                                                    <button key={gw.id} type="button"
                                                        onClick={() => setForm(f => ({ ...f, digital_gateway: String(gw.id) }))}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                                                        style={{
                                                            background: form.digital_gateway === String(gw.id)
                                                                ? `color-mix(in srgb, ${gw.gateway_color || '#6366f1'} 10%, var(--app-surface))`
                                                                : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                                            border: `1.5px solid ${form.digital_gateway === String(gw.id) ? (gw.gateway_color || '#6366f1') : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                                            transform: form.digital_gateway === String(gw.id) ? 'scale(1.02)' : 'scale(1)',
                                                        }}>
                                                        <span className="text-base">{gw.gateway_emoji || '💳'}</span>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] font-black text-app-foreground truncate">{gw.gateway_name}</div>
                                                            <div className="text-[8px] font-bold text-app-muted-foreground truncate">{gw.gateway_family || gw.gateway_code}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Selected Provider Info */}
                                        {selectedGw && (
                                            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                                                style={{ background: `color-mix(in srgb, ${selectedGw.gateway_color || '#6366f1'} 6%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${selectedGw.gateway_color || '#6366f1'} 20%, transparent)` }}>
                                                <span className="text-lg shrink-0">{selectedGw.gateway_emoji || '💳'}</span>
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-black text-app-foreground">{selectedGw.gateway_name}</div>
                                                    <div className="text-[9px] font-bold text-app-muted-foreground leading-relaxed">{selectedGw.gateway_description}</div>
                                                    {selectedGw.config_schema && selectedGw.config_schema.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {selectedGw.config_schema.map((f: any) => (
                                                                <span key={f.key} className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                                                    style={{ background: `color-mix(in srgb, ${selectedGw.gateway_color || '#6366f1'} 10%, transparent)`, color: selectedGw.gateway_color || '#6366f1' }}>
                                                                    {f.label}{f.required ? ' *' : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-[8px] text-app-muted-foreground mt-1 italic">API credentials are configured per-account, not here. This sets the default provider type.</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ═══ SECTION 4: COA Parent ═══ */}
                    <div className="space-y-3">
                        <SectionHeader
                            icon={FolderTree} title="Chart of Accounts Linkage" color="var(--app-warning, #f59e0b)"
                            collapsed={!coaExpanded}
                            onToggle={() => setCoaExpanded(!coaExpanded)}
                        />

                        {form.coa_parent && (() => {
                            const sel = coaList.find((a: any) => a.id.toString() === form.coa_parent)
                            return sel ? (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)' }}>
                                    <FolderTree size={12} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <span className="text-[11px] font-black text-app-foreground">{sel.code} — {sel.name}</span>
                                    <span className="text-[9px] font-bold text-app-muted-foreground">({sel.type})</span>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, coa_parent: '' }))}
                                        className="ml-auto text-app-muted-foreground hover:text-app-error transition-colors p-0.5">
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : null
                        })()}

                        {coaExpanded && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <COATreePicker
                                    coaList={coaList}
                                    selectedId={form.coa_parent}
                                    onSelect={(id: string) => setForm(f => ({ ...f, coa_parent: id }))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-5 py-3 border-t shrink-0"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    {/* Preview */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${form.color || DEFAULT_COLOR} 15%, transparent)`, color: form.color || DEFAULT_COLOR }}>
                            <PreviewIcon size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[12px] font-black text-app-foreground truncate">{form.name || 'Preview'}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-app-muted-foreground font-mono font-bold">{form.code || 'CODE'}</span>
                                {form.default_pos_enabled && <span className="text-[7px] font-bold px-1 py-px rounded" style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>POS</span>}
                                {form.is_digital && <span className="text-[7px] font-bold px-1 py-px rounded" style={{ background: 'color-mix(in srgb, #8b5cf6 12%, transparent)', color: '#8b5cf6' }}>⚡ DIGITAL</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose}
                            className="text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground px-3 py-2 rounded-xl hover:bg-app-bg transition-all">
                            Cancel
                        </button>
                        <button type="button" onClick={onSave} disabled={saving}
                            className="flex items-center gap-2 text-[11px] font-black bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Category'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
