'use client'

import { BarChart3, X, AlertTriangle } from 'lucide-react'
import {
    card, cardHead, cardBody, cardTitle,
    fieldLabel, fieldHint, fieldInput, toggleBtn,
    sourceLabel,
} from '../../_lib/constants'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp } from '../FieldHelp'

export function ScoringSection() {
    const s = usePASettings()
    if (!s.cardVisible('scoring data po count source financial weights margin velocity stock health')) return null

    return (
        <div className={card}>
            <div className={cardHead('border-purple-500')}>
                <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1">
                    <h3 className={cardTitle}>Scoring & Data Sources</h3>
                    <p className="text-[10px] text-app-muted-foreground">Financial score weights and PO count source</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('scoring') }}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                    title="Reset this section to defaults">Reset</button>
            </div>
            <div className={cardBody}>
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <label className={fieldLabel + ' mb-0'}>PO Count Source</label>
                        <FieldHelp field="po_count_source" />
                        {s.isOverridden('po_count_source') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('po_count_source')}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                <span className="text-[8px] text-app-primary/60">Global: {sourceLabel(s.globalVal('po_count_source'))}</span>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className={toggleBtn(s.val('po_count_source') === 'PURCHASE_INVOICE')}
                            onClick={() => s.update('po_count_source', 'PURCHASE_INVOICE')}>Purchase Invoices</button>
                        <button type="button" className={toggleBtn(s.val('po_count_source') === 'PURCHASE_ORDER')}
                            onClick={() => s.update('po_count_source', 'PURCHASE_ORDER')}>Purchase Orders</button>
                    </div>
                    <p className={fieldHint}>What the "PO Count" column reads from — invoices (received) or orders (placed).</p>
                </div>

                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <label className={fieldLabel + ' mb-0'}>
                            Financial Score Weights
                            <span className={`ml-2 ${s.weightTotal === 100 ? 'text-emerald-500' : 'text-red-500'}`}>(Total: {s.weightTotal}%)</span>
                        </label>
                        {s.isOverridden('financial_score_weights') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={s.clearWeightOverride}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                <span className="text-[8px] text-app-primary/60">Global: {s.globalWeight('margin')}/{s.globalWeight('velocity')}/{s.globalWeight('stock_health')}</span>
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[9px] text-app-muted-foreground uppercase">Margin</label>
                            <input type="number" min={0} max={100} className={fieldInput}
                                value={s.valWeight('margin')} onChange={e => s.updateWeight('margin', Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="text-[9px] text-app-muted-foreground uppercase">Velocity</label>
                            <input type="number" min={0} max={100} className={fieldInput}
                                value={s.valWeight('velocity')} onChange={e => s.updateWeight('velocity', Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="text-[9px] text-app-muted-foreground uppercase">Stock Health</label>
                            <input type="number" min={0} max={100} className={fieldInput}
                                value={s.valWeight('stock_health')} onChange={e => s.updateWeight('stock_health', Number(e.target.value))} />
                        </div>
                    </div>
                    <p className={fieldHint}>Weights should ideally sum to 100%.</p>
                    {s.getWarning('financial_score_weights') && (
                        <p className="text-[9px] mt-0.5 flex items-center gap-1 text-amber-600">
                            <AlertTriangle size={9} /> {s.getWarning('financial_score_weights')!.message}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
