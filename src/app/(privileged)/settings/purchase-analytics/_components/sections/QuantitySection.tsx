'use client'

import { Calculator, X, AlertTriangle } from 'lucide-react'
import {
    fieldLabel, fieldHint, fieldInput, toggleBtn,
    formulaLabel,
} from '../../_lib/constants'
import { getFieldStatus } from '../../_lib/validation'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp, statusDot } from '../FieldHelp'

const SECTION_COLOR = '#22c55e'

export function QuantitySection() {
    const s = usePASettings()
    if (!s.cardVisible('proposed quantity formula lead days safety multiplier replenishment')) return null

    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: `1.5px solid color-mix(in srgb, ${SECTION_COLOR} 15%, var(--app-border))` }}>
            <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: `color-mix(in srgb, ${SECTION_COLOR} 4%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${SECTION_COLOR} 10%, transparent)` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${SECTION_COLOR} 12%, transparent)` }}>
                    <Calculator size={15} style={{ color: SECTION_COLOR }} />
                </div>
                <div className="flex-1">
                    <h3 className="text-[13px] font-black text-app-foreground">Proposed Quantity</h3>
                    <p className="text-[9px] font-bold text-app-muted-foreground">How the system suggests order quantities</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('proposed') }}
                    className="text-[8px] font-black px-2 py-1 rounded-lg transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 6%, transparent)', color: 'var(--app-muted-foreground)' }}>Reset</button>
            </div>
            <div className="px-4 py-4 space-y-5">
                {/* Formula */}
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>Formula</label>
                        <FieldHelp field="proposed_qty_formula" />
                        {s.isOverridden('proposed_qty_formula') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('proposed_qty_formula')}
                                    className="text-app-muted-foreground hover:text-app-error transition-colors"><X size={9} /></button>
                                <span className="text-[8px] font-bold" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {formulaLabel(s.globalVal('proposed_qty_formula'))}</span>
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
                    {/* Lead Days */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
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
                                        className="text-app-muted-foreground hover:text-app-error transition-colors"><X size={9} /></button>
                                </>
                            )}
                        </div>
                        <input type="number" min={1} max={365} className={fieldInput}
                            value={s.val('proposed_qty_lead_days')}
                            onChange={e => s.update('proposed_qty_lead_days', Number(e.target.value))} />
                        <p className={fieldHint}>
                            Days of stock coverage
                            {s.isOverridden('proposed_qty_lead_days') && (
                                <span className="ml-1" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {s.globalVal('proposed_qty_lead_days')}</span>
                            )}
                        </p>
                        {s.getWarning('proposed_qty_lead_days') && (
                            <p className="text-[9px] mt-1 flex items-center gap-1" style={{ color: s.getWarning('proposed_qty_lead_days')!.severity === 'danger' ? 'var(--app-error, #ef4444)' : '#f59e0b' }}>
                                <AlertTriangle size={9} /> {s.getWarning('proposed_qty_lead_days')!.message}
                            </p>
                        )}
                    </div>

                    {/* Safety Multiplier */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <label className={fieldLabel + ' mb-0'}>Safety Multiplier</label>
                            {statusDot(getFieldStatus('proposed_qty_safety_multiplier', s.val('proposed_qty_safety_multiplier')))}
                            <FieldHelp field="proposed_qty_safety_multiplier" />
                            {s.defaultHint('proposed_qty_safety_multiplier', s.val('proposed_qty_safety_multiplier'))}
                            {s.isOverridden('proposed_qty_safety_multiplier') && (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                    <button type="button" onClick={() => s.clearOverride('proposed_qty_safety_multiplier')}
                                        className="text-app-muted-foreground hover:text-app-error transition-colors"><X size={9} /></button>
                                </>
                            )}
                        </div>
                        <input type="number" min={1.0} max={3.0} step={0.1} className={fieldInput}
                            value={s.val('proposed_qty_safety_multiplier')}
                            onChange={e => s.update('proposed_qty_safety_multiplier', Number(e.target.value))} />
                        <p className={fieldHint}>
                            1.0 = exact, 1.5 = 50% buffer
                            {s.isOverridden('proposed_qty_safety_multiplier') && (
                                <span className="ml-1" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {s.globalVal('proposed_qty_safety_multiplier')}</span>
                            )}
                        </p>
                        {s.getWarning('proposed_qty_safety_multiplier') && (
                            <p className="text-[9px] mt-1 flex items-center gap-1" style={{ color: s.getWarning('proposed_qty_safety_multiplier')!.severity === 'danger' ? 'var(--app-error, #ef4444)' : '#f59e0b' }}>
                                <AlertTriangle size={9} /> {s.getWarning('proposed_qty_safety_multiplier')!.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Formula preview */}
                <div className="rounded-xl px-4 py-2.5"
                    style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    <p className="text-[10px] font-mono font-bold text-app-muted-foreground">
                        {s.val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS'
                            ? `Proposed = (avg_daily × ${s.val('proposed_qty_lead_days')} × ${s.val('proposed_qty_safety_multiplier')}) − current_stock`
                            : `Proposed = (monthly_avg × ${(s.val('proposed_qty_lead_days') / 30).toFixed(1)}mo × ${s.val('proposed_qty_safety_multiplier')}) − current_stock`}
                    </p>
                </div>
            </div>
        </div>
    )
}
