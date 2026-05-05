'use client'

import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { savePurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import { runTimed } from '@/lib/perf-timing'
import { fieldLabel, fieldHint, toggleBtn } from '../../_lib/constants'
import { usePASettings } from '../../_hooks/PASettingsContext'

const C = 'var(--app-accent-cyan)'

export function FlowSection() {
    const s = usePASettings()
    if (!s.cardVisible('request flow mode dialog instant cart purchase transfer button')) return null

    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: `1.5px solid color-mix(in srgb, ${C} 15%, var(--app-border))` }}>
            <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: `color-mix(in srgb, ${C} 4%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${C} 10%, transparent)` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${C} 12%, transparent)` }}>
                    <Activity size={15} style={{ color: C }} />
                </div>
                <div className="flex-1">
                    <h3>Request Flow</h3>
                    <p className="text-[9px] font-bold text-app-muted-foreground">How "Request Purchase / Transfer" buttons behave</p>
                </div>
            </div>
            <div className="px-4 py-4 space-y-5">
                <div>
                    <label className={fieldLabel}>Click Behaviour</label>
                    <div className="flex gap-2 flex-wrap">
                        {(['INSTANT', 'DIALOG', 'CART'] as const).map(mode => {
                            const label = mode === 'INSTANT' ? 'Instant create' : mode === 'DIALOG' ? 'Mini dialog' : 'Cart accumulator'
                            const active = s.val('request_flow_mode') === mode || (mode === 'DIALOG' && !s.val('request_flow_mode'))
                            return (
                                <button key={mode} type="button" className={toggleBtn(active)}
                                    onClick={async () => {
                                        if (s.editingProfile) { s.update('request_flow_mode', mode); return }
                                        s.update('request_flow_mode', mode)
                                        const r = await runTimed(
                                            'settings.purchase-analytics:save-flow-mode',
                                            () => savePurchaseAnalyticsConfig({ request_flow_mode: mode }),
                                            { mode },
                                        )
                                        if (r.success) toast.success(`Request flow set to ${label}`)
                                        else toast.error(r.message || 'Failed to save')
                                    }}>
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                    <p className={fieldHint}>
                        <strong>Instant:</strong> click → request created immediately.&nbsp;
                        <strong>Dialog:</strong> review qty, priority, reason.&nbsp;
                        <strong>Cart:</strong> batch multiple products.
                    </p>
                </div>

                <div className="pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
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
                                        const r = await runTimed(
                                            'settings.purchase-analytics:save-multi-source',
                                            () => savePurchaseAnalyticsConfig({ purchase_multi_source: opt.v }),
                                            { value: String(opt.v) },
                                        )
                                        if (r.success) toast.success(opt.v ? 'Multi-source enabled' : 'Single source restored')
                                        else toast.error(r.message || 'Failed to save')
                                    }}>
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                    <p className={fieldHint}>
                        <strong>Single:</strong> one request per product.&nbsp;
                        <strong>Multi:</strong> allow parallel requests with different suppliers.
                    </p>
                </div>
            </div>
        </div>
    )
}
