'use client'

/**
 * Shared "Package Template" form modal.
 * ======================================
 * Single source of truth for creating or editing a UnitPackage template.
 * Used by:
 *   • /inventory/packages — New/Edit template (all units)
 *   • /inventory/units    — per-unit side panel "New Template"
 *
 * Props mirror what both callers need; the modal itself doesn't care where
 * it's mounted.
 *
 * Philosophy: shape only. Templates hold name + unit + ratio + optional
 * parent-chain step + notes. They do NOT carry barcode or price — those
 * belong to each product's ProductPackaging instance.
 */

import { useEffect, useMemo, useState } from 'react'
import { Package, X, Check, Loader2, ArrowRight, Info } from 'lucide-react'
import { toast } from 'sonner'
import { peekNextCode } from '@/lib/sequences-client'

export interface TemplateShape {
    id?: number
    unit?: number
    parent?: number | null
    parent_ratio?: number | null
    name?: string
    code?: string
    ratio?: number
    is_default?: boolean
    order?: number
    notes?: string
    unit_code?: string
}

export interface UnitOption {
    id: number
    name: string
    code?: string
}

export interface TemplateFormModalProps {
    tpl?: TemplateShape | null                   // null/undefined for create
    units: UnitOption[]
    allTemplates?: TemplateShape[]               // used for parent-chain picker
    lockedUnitId?: number                        // pre-select + disable the Unit select
    onSave: (data: Record<string, any>) => Promise<any>
    onClose: () => void
}

export function TemplateFormModal({
    tpl, units, allTemplates = [], lockedUnitId, onSave, onClose,
}: TemplateFormModalProps) {
    const [form, setForm] = useState<any>({
        unit: tpl?.unit ?? lockedUnitId ?? units[0]?.id ?? 0,
        parent: tpl?.parent ?? null,
        parent_ratio: tpl?.parent_ratio ?? null,
        name: tpl?.name ?? '',
        code: tpl?.code ?? '',
        ratio: tpl?.ratio ?? 1,
        is_default: tpl?.is_default ?? false,
        order: tpl?.order ?? 0,
        notes: tpl?.notes ?? '',
    })
    const [saving, setSaving] = useState(false)
    // Code lock — same rule as LockableCodeInput:
    //   • edit: existing code is the source of truth, lock
    //   • new with a sequence-supplied code: lock, user opts out to override
    const isEdit = !!tpl?.id
    const [codeUnlocked, setCodeUnlocked] = useState(false)
    const [userTouchedCode, setUserTouchedCode] = useState(false)
    // When sequence peek fills the code on a new form, keep it locked until
    // the user explicitly unlocks.
    useEffect(() => {
        if (isEdit) { setCodeUnlocked(false); return; }
        if (form.code && !userTouchedCode) setCodeUnlocked(false);
        // Blank new form (no suggestion yet) stays editable
        if (!form.code) setCodeUnlocked(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.code, isEdit])

    // Prefill code from the UNIT_PACKAGE sequence on New (/settings/sequences).
    useEffect(() => {
        if (tpl || form.code) return;
        peekNextCode('UNIT_PACKAGE')
            .then(code => setForm((f: any) => (f.code ? f : { ...f, code })))
            .catch(() => { /* ignore — user types their own */ })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Candidate parents: same-unit templates, excluding self + descendants.
    const candidateParents = useMemo(() => {
        const all = allTemplates || []
        const myId = tpl?.id
        if (!form.unit) return []
        const descendants = new Set<number>()
        if (myId) {
            const gather = (pid: number) => {
                all.filter(t => t.parent === pid).forEach(c => {
                    if (c.id) { descendants.add(c.id); gather(c.id) }
                })
            }
            gather(myId)
        }
        return all.filter(t => t.unit === form.unit && t.id !== myId && t.id && !descendants.has(t.id!))
            .sort((a, b) => Number(a.ratio) - Number(b.ratio))
    }, [allTemplates, form.unit, tpl?.id])

    const parentTpl = candidateParents.find((t) => t.id === form.parent)
    const computedRatio = parentTpl && form.parent_ratio
        ? Number(parentTpl.ratio) * Number(form.parent_ratio)
        : null
    useEffect(() => {
        if (computedRatio != null && !isNaN(computedRatio) && computedRatio > 0) {
            setForm((f: any) => ({ ...f, ratio: computedRatio }))
        }
    }, [computedRatio])

    const submit = async () => {
        if (!form.name?.trim()) { toast.error('Name required'); return }
        if (!form.unit) { toast.error('Pick a unit'); return }
        if (!form.ratio || form.ratio < 1) { toast.error('Ratio must be ≥ 1'); return }
        if (form.parent && (!form.parent_ratio || form.parent_ratio < 1)) {
            toast.error('Parent ratio required when parent is set'); return
        }
        setSaving(true)
        try { await onSave(form) } finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">{tpl ? 'Edit Template' : 'New Template'}</h3>
                            <p className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                Shape only — products supply their own barcode + price
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                        <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                        <p className="text-tp-sm leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                            A template is a reusable shape (e.g. "Pack of 6" ×6 Piece). Each product that adopts this shape gets its own barcode and price on its product page.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Name *" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="Pack of 6" />
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>
                                Code
                                {!codeUnlocked && form.code && (
                                    <button type="button"
                                        onClick={() => {
                                            const msg = isEdit
                                                ? 'Changing this code may break existing references (products, packagings). Continue?'
                                                : 'This code was auto-assigned by your sequence (/settings/sequences). Overriding means this record will NOT follow the sequence, but the counter still advances. Continue?';
                                            if (window.confirm(msg)) { setCodeUnlocked(true); setUserTouchedCode(true); }
                                        }}
                                        className="ml-2 text-tp-xxs font-bold normal-case"
                                        style={{ color: isEdit ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)' }}>
                                        🔒 {isEdit ? 'unlock' : 'override'}
                                    </button>
                                )}
                            </label>
                            <input value={form.code || ''} readOnly={!codeUnlocked}
                                onChange={e => { setForm({ ...form, code: e.target.value }); setUserTouchedCode(true); }}
                                placeholder="PK6"
                                className={`w-full px-3 py-2 rounded-xl outline-none text-tp-md font-mono font-bold ${!codeUnlocked ? 'cursor-not-allowed opacity-80' : ''}`}
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Unit *</label>
                            <select value={form.unit}
                                disabled={!!lockedUnitId}
                                onChange={e => setForm({ ...form, unit: Number(e.target.value), parent: null, parent_ratio: null })}
                                className="w-full px-3 py-2 rounded-xl outline-none text-tp-md font-bold disabled:opacity-70"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}
                            </select>
                        </div>
                        <FormField label="Order" value={String(form.order)} onChange={(v: string) => setForm({ ...form, order: Number(v) || 0 })} mono placeholder="0" />
                    </div>

                    {/* Parent chain picker */}
                    <div className="rounded-xl p-3 space-y-2"
                        style={{ background: 'color-mix(in srgb, var(--app-accent) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-accent) 25%, transparent)' }}>
                        <div className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-accent)' }}>
                            <ArrowRight size={11} /> Packaging Chain (pipeline step)
                        </div>
                        <p className="text-tp-sm leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                            Build a chain: <strong>pc → pack → box → pallet → TC</strong>. Pick the previous step and how many of it this level contains. Total base units will auto-compute.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2">
                            <div>
                                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Parent step</label>
                                <select value={form.parent ?? ''}
                                    onChange={e => setForm({ ...form, parent: e.target.value ? Number(e.target.value) : null })}
                                    className="w-full px-3 py-2 rounded-xl outline-none text-tp-md font-bold"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="">— No parent (base-level / stand-alone) —</option>
                                    {candidateParents.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} (×{Number(p.ratio).toLocaleString()} {p.unit_code || ''})</option>
                                    ))}
                                </select>
                            </div>
                            <FormField
                                label={`× Parent${parentTpl ? ` (${parentTpl.name})` : ''}`}
                                value={form.parent_ratio != null ? String(form.parent_ratio) : ''}
                                onChange={(v: string) => setForm({ ...form, parent_ratio: v ? Number(v) : null })}
                                mono placeholder="6"
                            />
                        </div>
                        {parentTpl && form.parent_ratio ? (
                            <div className="text-tp-sm font-mono px-2 py-1.5 rounded-lg tabular-nums"
                                style={{ background: 'var(--app-background)', color: 'var(--app-foreground)' }}>
                                <span style={{ color: 'var(--app-muted-foreground)' }}>This level =</span>{' '}
                                <span style={{ color: 'var(--app-accent)' }}>{form.parent_ratio}</span> ×{' '}
                                <span>{parentTpl.name}</span>{' '}
                                <span style={{ color: 'var(--app-muted-foreground)' }}>×</span>{' '}
                                <span style={{ color: 'var(--app-info)' }}>{Number(parentTpl.ratio).toLocaleString()}</span>{' '}
                                <span style={{ color: 'var(--app-muted-foreground)' }}>base/parent =</span>{' '}
                                <span style={{ color: 'var(--app-warning)', fontWeight: 900 }}>{Number(form.ratio).toLocaleString()}</span> base units
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Total ratio (base units) *" value={String(form.ratio)} onChange={(v: string) => setForm({ ...form, ratio: Number(v) || 1 })} mono placeholder="6" />
                        <label className="flex items-center gap-2 text-tp-sm font-bold cursor-pointer mt-5">
                            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
                            Default for this unit
                        </label>
                    </div>
                    <div>
                        <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Notes</label>
                        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={2} className="w-full px-3 py-2 rounded-xl outline-none text-tp-md"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} disabled={saving} className="text-tp-sm font-bold px-3 py-2 rounded-xl" style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="flex items-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider px-4 py-2 rounded-xl"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {tpl ? 'Save Template' : 'Create Template'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function FormField({ label, value, onChange, placeholder, mono }: any) {
    return (
        <div>
            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
            <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full px-3 py-2 rounded-xl outline-none text-tp-md ${mono ? 'font-mono font-bold' : 'font-medium'}`}
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
        </div>
    )
}
