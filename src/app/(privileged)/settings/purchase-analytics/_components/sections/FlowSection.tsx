'use client'

import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { savePurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import {
    card, cardHead, cardBody, cardTitle,
    fieldLabel, fieldHint, toggleBtn,
} from '../../_lib/constants'
import { usePASettings } from '../../_hooks/PASettingsContext'

export function FlowSection() {
    const s = usePASettings()
    if (!s.cardVisible('request flow mode dialog instant cart purchase transfer button')) return null

    return (
        <div className={card}>
            <div className={cardHead('border-cyan-500')}>
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="flex-1">
                    <h3 className={cardTitle}>Request Flow</h3>
                    <p className="text-[10px] text-app-muted-foreground">How "Request Purchase / Transfer" buttons behave on the product list</p>
                </div>
            </div>
            <div className={cardBody}>
                <div>
                    <label className={fieldLabel}>Click behaviour</label>
                    <div className="flex gap-2 flex-wrap">
                        {(['INSTANT', 'DIALOG', 'CART'] as const).map(mode => {
                            const label = mode === 'INSTANT' ? 'Instant create' : mode === 'DIALOG' ? 'Mini dialog' : 'Cart accumulator'
                            const active = s.val('request_flow_mode') === mode || (mode === 'DIALOG' && !s.val('request_flow_mode'))
                            return (
                                <button key={mode} type="button" className={toggleBtn(active)}
                                    onClick={async () => {
                                        if (s.editingProfile) { s.update('request_flow_mode', mode); return }
                                        s.update('request_flow_mode', mode)
                                        const r = await savePurchaseAnalyticsConfig({ request_flow_mode: mode })
                                        if (r.success) toast.success(`Request flow set to ${label}`)
                                        else toast.error(r.message || 'Failed to save')
                                    }}>
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                    <p className={fieldHint}>
                        <strong>Instant:</strong> click → request created immediately with formula-derived qty.&nbsp;
                        <strong>Dialog:</strong> popup to review qty, priority, reason before submitting.&nbsp;
                        <strong>Cart:</strong> add multiple products to a draft, submit as a batch.
                    </p>
                </div>

                <div className="pt-3 mt-2 border-t border-app-border/40">
                    <label className={fieldLabel}>Multi-Source Purchasing</label>
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { v: false, label: 'Single source' },
                            { v: true, label: 'Multi source' },
                        ] as const).map(opt => {
                            const current = !!s.val('purchase_multi_source')
                            const active = current === opt.v
                            return (
                                <button key={String(opt.v)} type="button" className={toggleBtn(active)}
                                    onClick={async () => {
                                        if (s.editingProfile) { s.update('purchase_multi_source', opt.v); return }
                                        s.update('purchase_multi_source', opt.v)
                                        const r = await savePurchaseAnalyticsConfig({ purchase_multi_source: opt.v })
                                        if (r.success) toast.success(opt.v ? 'Multi-source enabled' : 'Single source restored')
                                        else toast.error(r.message || 'Failed to save')
                                    }}>
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                    <p className={fieldHint}>
                        <strong>Single source (default):</strong> only one open purchase request per product. Prevents the same product from being requested multiple times in parallel for the same location.&nbsp;
                        <strong>Multi source:</strong> allow multiple purchase requests for the same product as long as each picks a different supplier (useful for quoting in parallel).
                    </p>
                </div>
            </div>
        </div>
    )
}
