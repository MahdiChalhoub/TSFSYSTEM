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
            </div>
        </div>
    )
}
