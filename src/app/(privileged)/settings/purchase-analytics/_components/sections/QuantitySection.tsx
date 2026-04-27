'use client'

import { Calculator, X, AlertTriangle } from 'lucide-react'
import {
    card, cardHead, cardBody, cardTitle,
    fieldLabel, fieldHint, fieldInput, toggleBtn,
    formulaLabel,
} from '../../_lib/constants'
import { getFieldStatus } from '../../_lib/validation'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp, statusDot } from '../FieldHelp'

export function QuantitySection() {
    const s = usePASettings()
    if (!s.cardVisible('proposed quantity formula lead days safety multiplier replenishment')) return null

    return (
        <div className={card}>
            <div className={cardHead('border-emerald-500')}>
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <Calculator className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1">
                    <h3 className={cardTitle}>Proposed Quantity</h3>
                    <p className="text-[10px] text-app-muted-foreground">How the system suggests quantities to order</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('proposed') }}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                    title="Reset this section to defaults">Reset</button>
            </div>
            <div className={cardBody}>
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <label className={fieldLabel + ' mb-0'}>Formula</label>
                        <FieldHelp field="proposed_qty_formula" />
                        {s.isOverridden('proposed_qty_formula') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('proposed_qty_formula')}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                <span className="text-[8px] text-app-primary/60">Global: {formulaLabel(s.globalVal('proposed_qty_formula'))}</span>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className={toggleBtn(s.val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS')}
                            onClick={() => s.update('proposed_qty_formula', 'AVG_DAILY_x_LEAD_DAYS')}>
                            Daily Avg × Lead Days
                        </button>
                        <button type="button" className={toggleBtn(s.val('proposed_qty_formula') === 'MONTHLY_AVG_x_MONTHS')}
                            onClick={() => s.update('proposed_qty_formula', 'MONTHLY_AVG_x_MONTHS')}>
                            Monthly Avg × Months
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <label className={fieldLabel + ' mb-0'}>
                                {s.val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS' ? 'Lead Days' : 'Lead Days (÷30 = months)'}
                            </label>
                            {statusDot(getFieldStatus('proposed_qty_lead_days', s.val('proposed_qty_lead_days')))}
                            <FieldHelp field="proposed_qty_lead_days" />
                            {s.defaultHint('proposed_qty_lead_days', s.val('proposed_qty_lead_days'))}
                            {s.isOverridden('proposed_qty_lead_days') && (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                    <button type="button" onClick={() => s.clearOverride('proposed_qty_lead_days')}
                                        className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                </>
                            )}
                        </div>
                        <input type="number" min={1} max={365} className={fieldInput}
                            value={s.val('proposed_qty_lead_days')}
                            onChange={e => s.update('proposed_qty_lead_days', Number(e.target.value))} />
                        <p className={fieldHint}>
                            Days of stock coverage
                            {s.isOverridden('proposed_qty_lead_days') && (
                                <span className="ml-1 text-app-primary/60">Global: {s.globalVal('proposed_qty_lead_days')}</span>
                            )}
                        </p>
                        {s.getWarning('proposed_qty_lead_days') && (
                            <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${s.getWarning('proposed_qty_lead_days')!.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                                <AlertTriangle size={9} /> {s.getWarning('proposed_qty_lead_days')!.message}
                            </p>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <label className={fieldLabel + ' mb-0'}>Safety Multiplier</label>
                            {statusDot(getFieldStatus('proposed_qty_safety_multiplier', s.val('proposed_qty_safety_multiplier')))}
                            <FieldHelp field="proposed_qty_safety_multiplier" />
                            {s.defaultHint('proposed_qty_safety_multiplier', s.val('proposed_qty_safety_multiplier'))}
                            {s.isOverridden('proposed_qty_safety_multiplier') && (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                    <button type="button" onClick={() => s.clearOverride('proposed_qty_safety_multiplier')}
                                        className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                </>
                            )}
                        </div>
                        <input type="number" min={1.0} max={3.0} step={0.1} className={fieldInput}
                            value={s.val('proposed_qty_safety_multiplier')}
                            onChange={e => s.update('proposed_qty_safety_multiplier', Number(e.target.value))} />
                        <p className={fieldHint}>
                            1.0 = exact, 1.5 = 50% buffer
                            {s.isOverridden('proposed_qty_safety_multiplier') && (
                                <span className="ml-1 text-app-primary/60">Global: {s.globalVal('proposed_qty_safety_multiplier')}</span>
                            )}
                        </p>
                        {s.getWarning('proposed_qty_safety_multiplier') && (
                            <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${s.getWarning('proposed_qty_safety_multiplier')!.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                                <AlertTriangle size={9} /> {s.getWarning('proposed_qty_safety_multiplier')!.message}
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-app-background/50 rounded-lg p-3 border border-app-border/50">
                    <p className="text-[10px] font-mono text-app-muted-foreground">
                        {s.val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS'
                            ? `Proposed = (avg_daily × ${s.val('proposed_qty_lead_days')} × ${s.val('proposed_qty_safety_multiplier')}) − current_stock`
                            : `Proposed = (monthly_avg × ${(s.val('proposed_qty_lead_days') / 30).toFixed(1)}mo × ${s.val('proposed_qty_safety_multiplier')}) − current_stock`}
                    </p>
                </div>
            </div>
        </div>
    )
}
