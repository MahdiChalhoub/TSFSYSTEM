'use client'
/**
 * FX Management — PolicyDrawer "no-base-currency" empty / error panel.
 * Extracted from PolicyDrawer.tsx so the drawer body fits the line cap.
 */
import { RefreshCcw, AlertTriangle } from 'lucide-react'
import { type Currency } from '@/app/actions/finance/currency'
import { soft } from '../fx/_shared'

export function PolicyDrawerEmpty({ refreshing, currencies, onRefresh, onClose, setRefreshing }: {
    refreshing: boolean
    currencies: Currency[]
    onRefresh?: () => Promise<void>
    onClose: () => void
    setRefreshing: (v: boolean) => void
}) {
    return (
        <div className="rounded-xl p-4"
            style={{ ...soft('--app-error', 8), border: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
            <div className="font-black mb-1.5 inline-flex items-center gap-1.5"
                style={{ fontSize: 13, color: 'var(--app-error)' }}>
                {refreshing
                    ? <><RefreshCcw size={13} className="animate-spin" /> Loading currencies…</>
                    : <><AlertTriangle size={13} /> Can&apos;t create a policy yet</>}
            </div>
            {!refreshing && (
                <>
                    <p className="leading-relaxed mb-3" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                        The currency list couldn&apos;t be loaded — typically because:
                    </p>
                    <ul className="space-y-1 mb-3 ml-4 list-disc" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                        <li>You&apos;re on the SaaS root domain instead of a tenant subdomain.</li>
                        <li>Your session expired and you need to re-login.</li>
                        <li>The backend missed a migration (run <code className="font-mono">manage.py migrate finance</code>).</li>
                        <li>No base currency is set — go to the <em>Select Currency</em> tab and mark one with ⭐.</li>
                    </ul>
                    <p style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                        Currently loaded: <strong>{currencies.length}</strong> currenc{currencies.length === 1 ? 'y' : 'ies'},
                        base = <strong>{currencies.find(c => c.is_base)?.code ?? 'none'}</strong>.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                        {onRefresh && (
                            <button onClick={() => {
                                setRefreshing(true)
                                onRefresh().finally(() => setRefreshing(false))
                            }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border"
                                style={{
                                    fontSize: 11,
                                    color: 'var(--app-error)',
                                    borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)',
                                    background: 'color-mix(in srgb, var(--app-error) 6%, transparent)',
                                }}>
                                <RefreshCcw size={11} /> Retry load
                            </button>
                        )}
                        <button onClick={onClose}
                            className="px-3 py-1.5 rounded-lg font-bold border"
                            style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            Close
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
