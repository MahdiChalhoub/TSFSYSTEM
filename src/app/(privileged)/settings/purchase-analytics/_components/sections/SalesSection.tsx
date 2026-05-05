'use client'

import { TrendingUp, X, Lock, Unlock, AlertTriangle } from 'lucide-react'
import {
    fieldLabel, fieldHint, fieldSelect, toggleBtn,
    PERIOD_OPTIONS, periodLabel,
} from '../../_lib/constants'
import { getFieldStatus } from '../../_lib/validation'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp, statusDot } from '../FieldHelp'

const SECTION_COLOR = 'var(--app-info)'

export function SalesSection() {
    const s = usePASettings()
    if (!s.cardVisible('sales analysis average period window exclusion')) return null

    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: `1.5px solid color-mix(in srgb, ${SECTION_COLOR} 15%, var(--app-border))` }}>
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: `color-mix(in srgb, ${SECTION_COLOR} 4%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${SECTION_COLOR} 10%, transparent)` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${SECTION_COLOR} 12%, transparent)` }}>
                    <TrendingUp size={15} style={{ color: SECTION_COLOR }} />
                </div>
                <div className="flex-1">
                    <h3>Sales Analysis</h3>
                    <p className="text-[9px] font-bold text-app-muted-foreground">How daily/monthly averages are calculated</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('sales') }}
                    className="text-[8px] font-black px-2 py-1 rounded-lg transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 6%, transparent)', color: 'var(--app-muted-foreground)' }}>Reset</button>
            </div>

            <div className="px-4 py-4 space-y-5">
                {/* Sales Average Period */}
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>Sales Average Period</label>
                        {statusDot(getFieldStatus('sales_avg_period_days', s.config.sales_avg_period_days))}
                        <FieldHelp field="sales_avg_period_days" />
                        {s.defaultHint('sales_avg_period_days', s.config.sales_avg_period_days)}
                        {s.isOverridden('sales_avg_period_days') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('sales_avg_period_days')}
                                    className="text-app-muted-foreground hover:text-app-error transition-colors" title="Reset to global"><X size={9} /></button>
                            </>
                        )}
                    </div>
                    <div className="relative">
                        <select className={fieldSelect}
                            value={s.val('sales_avg_period_days')}
                            onChange={e => s.update('sales_avg_period_days', Number(e.target.value))}
                            disabled={s.lockedFields.has('sales_avg_period_days')}
                            style={s.lockedFields.has('sales_avg_period_days') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button type="button" onClick={() => s.toggleFieldLock('sales_avg_period_days')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-app-muted-foreground/30 hover:text-app-muted-foreground transition-colors"
                            title={s.lockedFields.has('sales_avg_period_days') ? 'Unlock field' : 'Lock field'}>
                            {s.lockedFields.has('sales_avg_period_days') ? <Lock size={9} /> : <Unlock size={9} />}
                        </button>
                    </div>
                    <p className={fieldHint}>
                        Average daily sales calculated over this window.
                        {s.isOverridden('sales_avg_period_days') && (
                            <span className="ml-1" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {periodLabel(s.globalVal('sales_avg_period_days'))}</span>
                        )}
                    </p>
                </div>

                {/* Window Size */}
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>Sales Period Window Size (Days)</label>
                        <FieldHelp field="sales_window_size_days" />
                        {s.isOverridden('sales_window_size_days') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('sales_window_size_days')}
                                    className="text-app-muted-foreground hover:text-app-error transition-colors" title="Reset to global"><X size={9} /></button>
                            </>
                        )}
                    </div>
                    <select className={fieldSelect}
                        value={s.val('sales_window_size_days') ?? 15}
                        onChange={e => s.update('sales_window_size_days', Number(e.target.value))}>
                        <option value={7}>7 Days</option>
                        <option value={15}>15 Days (Bi-weekly)</option>
                        <option value={30}>30 Days (Monthly)</option>
                    </select>
                    <p className={fieldHint}>
                        Each window covers this many days.
                        {s.isOverridden('sales_window_size_days') && (
                            <span className="ml-1" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {s.globalVal('sales_window_size_days') ?? 15} days</span>
                        )}
                    </p>
                </div>

                {/* Exclude types */}
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>Exclude Sale Types from Average</label>
                        <FieldHelp field="sales_type_exclusions" />
                        {s.isOverridden('sales_avg_exclude_types') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('sales_avg_exclude_types')}
                                    className="text-app-muted-foreground hover:text-app-error transition-colors" title="Reset to global"><X size={9} /></button>
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['WHOLESALE', 'ONE_TIME', 'INTERNAL'].map(type => {
                            const excludes = s.val('sales_avg_exclude_types') || []
                            const active = excludes.includes(type)
                            return (
                                <button key={type} type="button" className={toggleBtn(active)}
                                    onClick={() => {
                                        const next = active ? excludes.filter((t: string) => t !== type) : [...excludes, type]
                                        s.update('sales_avg_exclude_types', next)
                                    }}>
                                    {type.replace('_', ' ')}
                                </button>
                            )
                        })}
                    </div>
                    <p className={fieldHint}>Selected types excluded from sales averages.</p>
                </div>
            </div>
        </div>
    )
}
