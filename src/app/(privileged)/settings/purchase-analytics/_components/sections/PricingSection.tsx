'use client'

import { ShoppingCart, X } from 'lucide-react'
import {
    card, cardHead, cardBody, cardTitle,
    fieldLabel, fieldHint, fieldSelect, toggleBtn,
    PERIOD_OPTIONS, periodLabel, contextLabel,
} from '../../_lib/constants'
import { usePASettings } from '../../_hooks/PASettingsContext'
import { FieldHelp } from '../FieldHelp'

export function PricingSection() {
    const s = usePASettings()
    if (!s.cardVisible('supplier pricing best price period purchase context retail wholesale')) return null

    return (
        <div className={card}>
            <div className={cardHead('border-amber-500')}>
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1">
                    <h3 className={cardTitle}>Supplier & Pricing</h3>
                    <p className="text-[10px] text-app-muted-foreground">Best price lookups and purchase context</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); s.resetSection('pricing') }}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                    title="Reset this section to defaults">Reset</button>
            </div>
            <div className={cardBody}>
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <label className={fieldLabel + ' mb-0'}>Best Price Period</label>
                        <FieldHelp field="best_price_period_days" />
                        {s.isOverridden('best_price_period_days') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('best_price_period_days')}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
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
                            <span className="ml-1 text-app-primary/60">Global: {periodLabel(s.globalVal('best_price_period_days'))}</span>
                        )}
                    </p>
                </div>

                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <label className={fieldLabel + ' mb-0'}>Purchase Context</label>
                        <FieldHelp field="purchase_context" />
                        {s.isOverridden('purchase_context') && (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                <button type="button" onClick={() => s.clearOverride('purchase_context')}
                                    className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                <span className="text-[8px] text-app-primary/60">Global: {contextLabel(s.globalVal('purchase_context'))}</span>
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
