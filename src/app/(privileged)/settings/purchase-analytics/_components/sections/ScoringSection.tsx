'use client'

import { BarChart3, X, AlertTriangle } from 'lucide-react'
import {
    fieldLabel, fieldHint, fieldInput, toggleBtn,
    sourceLabel,
} from '../../_lib/constants'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp } from '../FieldHelp'

const C = 'var(--app-accent)'

export function ScoringSection() {
    const s = usePASettings()
    if (!s.cardVisible('scoring data po count source financial weights margin velocity stock health')) return null

    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: `1.5px solid color-mix(in srgb, ${C} 15%, var(--app-border))` }}>
            <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: `color-mix(in srgb, ${C} 4%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${C} 10%, transparent)` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${C} 12%, transparent)` }}>
                    <BarChart3 size={15} style={{ color: C }} />
                </div>
                <div className="flex-1">
                    <h3>Scoring & Data Sources</h3>
                    <p className="text-[9px] font-bold text-app-muted-foreground">Financial score weights and PO count source</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('scoring') }}
                    className="text-[8px] font-black px-2 py-1 rounded-lg transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 6%, transparent)', color: 'var(--app-muted-foreground)' }}>Reset</button>
            </div>
            <div className="px-4 py-4 space-y-5">
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>PO Count Source</label>
                        <FieldHelp field="po_count_source" />
                        {s.isOverridden('po_count_source') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('po_count_source')}
                                    className="text-app-muted-foreground hover:text-app-error transition-colors"><X size={9} /></button>
                                <span className="text-[8px] font-bold" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {sourceLabel(s.globalVal('po_count_source'))}</span>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className={toggleBtn(s.val('po_count_source') === 'PURCHASE_INVOICE')}
                            onClick={() => s.update('po_count_source', 'PURCHASE_INVOICE')}>Purchase Invoices</button>
                        <button type="button" className={toggleBtn(s.val('po_count_source') === 'PURCHASE_ORDER')}
                            onClick={() => s.update('po_count_source', 'PURCHASE_ORDER')}>Purchase Orders</button>
                    </div>
                    <p className={fieldHint}>What "PO Count" reads from — invoices (received) or orders (placed).</p>
                </div>

                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>
                            Financial Score Weights
                            <span className="ml-2 font-black" style={{ color: s.weightTotal === 100 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>(Total: {s.weightTotal}%)</span>
                        </label>
                        {s.isOverridden('financial_score_weights') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={s.clearWeightOverride}
                                    className="text-app-muted-foreground hover:text-app-error transition-colors"><X size={9} /></button>
                                <span className="text-[8px] font-bold" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {s.globalWeight('margin')}/{s.globalWeight('velocity')}/{s.globalWeight('stock_health')}</span>
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {['margin', 'velocity', 'stock_health'].map(key => (
                            <div key={key}>
                                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">{key.replace('_', ' ')}</label>
                                <input type="number" min={0} max={100} className={fieldInput}
                                    value={s.valWeight(key)} onChange={e => s.updateWeight(key, Number(e.target.value))} />
                            </div>
                        ))}
                    </div>
                    <p className={fieldHint}>Weights should ideally sum to 100%.</p>
                    {s.getWarning('financial_score_weights') && (
                        <p className="text-[9px] mt-1 flex items-center gap-1" style={{ color: 'var(--app-warning)' }}>
                            <AlertTriangle size={9} /> {s.getWarning('financial_score_weights')!.message}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
