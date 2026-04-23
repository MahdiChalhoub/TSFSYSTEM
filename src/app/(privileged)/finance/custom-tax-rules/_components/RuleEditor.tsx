'use client'

import { useState } from 'react'
import { ArrowLeft, ListChecks, Loader2, Save } from 'lucide-react'

type CTR = Record<string, any>

const TRANSACTION_TYPES = ['PURCHASE', 'SALE', 'BOTH']
const MATH_BEHAVIORS = ['ADDED_TO_TTC', 'WITHHELD_FROM_AP']
const COST_TREATMENTS = ['CAPITALIZE', 'EXPENSE']
const TAX_BASE_MODES = ['HT', 'TTC', 'PREVIOUS_TAX']

const friendlyLabel: Record<string, string> = {
    PURCHASE: 'Purchase Only', SALE: 'Sale Only', BOTH: 'Purchases & Sales',
    ADDED_TO_TTC: 'Add to Invoice (like Sales Tax)', WITHHELD_FROM_AP: 'Withhold (like AIRSI)',
    CAPITALIZE: 'Capitalize into Cost', EXPENSE: 'Expense to P&L',
    HT: 'On HT (pre-tax)', TTC: 'On running gross (HT + prior taxes)', PREVIOUS_TAX: 'On a prior tax amount',
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const selectCls = inputCls
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

/* ═══════════════════════════════════════════════════════════
 *  RULE EDITOR — Form for creating/editing a custom tax rule
 * ═══════════════════════════════════════════════════════════ */
export function RuleEditor({ item, onSave, onCancel }: {
    item: CTR | null
    onSave: (data: CTR) => void
    onCancel: () => void
}) {
    const [form, setForm] = useState<CTR>(item || {
        name: '', rate: 0, transaction_type: 'BOTH', math_behavior: 'ADDED_TO_TTC',
        purchase_cost_treatment: 'EXPENSE', tax_base_mode: 'HT', base_tax_type: '',
        calculation_order: 100, compound_group: '', is_active: true,
    })
    const [saving, setSaving] = useState(false)
    const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                <button onClick={onCancel} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                    <ArrowLeft size={13} /> Back
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}><ListChecks size={20} className="text-white" /></div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-black text-app-foreground tracking-tight truncate">{item ? 'Edit Custom Tax Rule' : 'New Custom Tax Rule'}</h1>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Tax Engine · Configuration</p>
                    </div>
                </div>
                <button onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }} disabled={saving}
                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div><label className={labelCls}>Rule Name</label><input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Eco Tax, Tourism Levy" /></div>
                    <div><label className={labelCls}>Rate</label><input className={inputCls} type="number" step="0.0001" min="0" max="1" value={form.rate} onChange={e => upd('rate', e.target.value)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Decimal (0.05 = 5%)</p></div>
                    <div><label className={labelCls}>Transaction Type</label><select className={selectCls} value={form.transaction_type} onChange={e => upd('transaction_type', e.target.value)}>{TRANSACTION_TYPES.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
                    <div><label className={labelCls}>Math Behavior</label><select className={selectCls} value={form.math_behavior} onChange={e => upd('math_behavior', e.target.value)}>{MATH_BEHAVIORS.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
                    <div><label className={labelCls}>Purchase Cost Treatment</label><select className={selectCls} value={form.purchase_cost_treatment} onChange={e => upd('purchase_cost_treatment', e.target.value)}>{COST_TREATMENTS.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
                    <div><label className={labelCls}>Tax Base Mode</label><select className={selectCls} value={form.tax_base_mode} onChange={e => upd('tax_base_mode', e.target.value)}>{TAX_BASE_MODES.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
                    {form.tax_base_mode === 'PREVIOUS_TAX' && (<div><label className={labelCls}>Base Tax Type</label><input className={inputCls} value={form.base_tax_type || ''} onChange={e => upd('base_tax_type', e.target.value)} placeholder="e.g. VAT, AIRSI" /></div>)}
                    <div><label className={labelCls}>Calculation Order</label><input className={inputCls} type="number" min="1" value={form.calculation_order} onChange={e => upd('calculation_order', parseInt(e.target.value) || 100)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Core: VAT=10, AIRSI=20. Custom default=100</p></div>
                    <div><label className={labelCls}>Compound Group</label><input className={inputCls} value={form.compound_group || ''} onChange={e => upd('compound_group', e.target.value)} placeholder="e.g. brazil_composite" /></div>
                    <div><label className={labelCls}>Active</label><label className="flex items-center gap-2 cursor-pointer mt-1"><input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} className="rounded" /><span className="text-[12px] font-bold text-app-foreground">Enabled</span></label></div>
                </div>
            </div>
        </div>
    )
}
