'use client'

import { ShoppingCart, X } from 'lucide-react'
import {
    fieldLabel, fieldHint, fieldSelect, toggleBtn,
    PERIOD_OPTIONS, periodLabel, contextLabel,
} from '../../_lib/constants'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp } from '../FieldHelp'

const C = '#f59e0b'

export function PricingSection() {
    const s = usePASettings()
    if (!s.cardVisible('supplier pricing best price period purchase context retail wholesale')) return null

    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: `1.5px solid color-mix(in srgb, ${C} 15%, var(--app-border))` }}>
            <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: `color-mix(in srgb, ${C} 4%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${C} 10%, transparent)` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${C} 12%, transparent)` }}>
                    <ShoppingCart size={15} style={{ color: C }} />
                </div>
                <div className="flex-1">
                    <h3 className="text-[13px] font-black text-app-foreground">Supplier & Pricing</h3>
                    <p className="text-[9px] font-bold text-app-muted-foreground">Best price lookups and purchase context</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('pricing') }}
                    className="text-[8px] font-black px-2 py-1 rounded-lg transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 6%, transparent)', color: 'var(--app-muted-foreground)' }}>Reset</button>
            </div>
            <div className="px-4 py-4 space-y-5">
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>Best Price Period</label>
                        <FieldHelp field="best_price_period_days" />
                        {s.isOverridden('best_price_period_days') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('best_price_period_days')}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors"><X size={9} /></button>
                            </>
                        )}
                    </div>
                    <select className={fieldSelect}
                        value={s.val('best_price_period_days')}
                        onChange={e => s.update('best_price_period_days', Number(e.target.value))}>
                        {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <p className={fieldHint}>
                        Best price considers supplier prices within this window.
                        {s.isOverridden('best_price_period_days') && (
                            <span className="ml-1" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {periodLabel(s.globalVal('best_price_period_days'))}</span>
                        )}
                    </p>
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <label className={fieldLabel + ' mb-0'}>Purchase Context</label>
                        <FieldHelp field="purchase_context" />
                        {s.isOverridden('purchase_context') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('purchase_context')}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors"><X size={9} /></button>
                                <span className="text-[8px] font-bold" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Global: {contextLabel(s.globalVal('purchase_context'))}</span>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className={toggleBtn(s.val('purchase_context') === 'RETAIL')}
                            onClick={() => s.update('purchase_context', 'RETAIL')}>Retail</button>
                        <button type="button" className={toggleBtn(s.val('purchase_context') === 'WHOLESALE')}
                            onClick={() => s.update('purchase_context', 'WHOLESALE')}>Wholesale</button>
                    </div>
                    <p className={fieldHint}>Retail: individual unit analysis. Wholesale: bulk pricing & volume.</p>
                </div>
            </div>
        </div>
    )
}
