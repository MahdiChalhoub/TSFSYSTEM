'use client'

import { toast } from 'sonner'
import { RefreshCcw, Plus, ShieldCheck, Check } from 'lucide-react'
import {
    bulkUpdateRatePolicyProvider,
    type Currency, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { grad, soft } from '../constants'
import { BrokerChipPicker, BrokerImpactPreview } from './SetBrokerDialog.parts'

export function SetBrokerDialog({
    open, onClose, currencies, policies,
    setBrokerProvider, setSetBrokerProvider,
    setBrokerScope, setSetBrokerScope,
    setBrokerCodes, setSetBrokerCodes,
    setBrokerKey, setSetBrokerKey,
    setBrokerBusy, setSetBrokerBusy,
    loadAll,
}: {
    open: boolean
    onClose: () => void
    currencies: Currency[]
    policies: CurrencyRatePolicy[]
    setBrokerProvider: CurrencyRatePolicy['provider']
    setSetBrokerProvider: (p: CurrencyRatePolicy['provider']) => void
    setBrokerScope: 'all' | 'include' | 'exclude'
    setSetBrokerScope: (s: 'all' | 'include' | 'exclude') => void
    setBrokerCodes: string[]
    setSetBrokerCodes: React.Dispatch<React.SetStateAction<string[]>>
    setBrokerKey: string
    setSetBrokerKey: (s: string) => void
    setBrokerBusy: boolean
    setSetBrokerBusy: (b: boolean) => void
    loadAll: () => Promise<void>
}) {
    if (!open) return null

    async function handleSetBroker() {
        if ((setBrokerScope === 'include' || setBrokerScope === 'exclude') && setBrokerCodes.length === 0) {
            toast.error(setBrokerScope === 'include'
                ? 'Pick at least one currency to include.'
                : 'Pick at least one currency to exclude.')
            return
        }
        setSetBrokerBusy(true)
        try {
            const provider_config: Record<string, any> = {}
            const key = setBrokerKey.trim()
            // Each broker reads a slightly different config key. We set them
            // all to the same value so the policy works regardless of which
            // provider it ends up assigned to.
            if (key) {
                provider_config.access_key = key   // exchangerate.host
                provider_config.api_key = key      // FIXER
                provider_config.app_id = key       // OpenExchangeRates
            }
            const res = await bulkUpdateRatePolicyProvider({
                provider: setBrokerProvider,
                provider_config: Object.keys(provider_config).length ? provider_config : undefined,
                scope: setBrokerScope,
                from_currency_codes: setBrokerScope === 'all' ? undefined : setBrokerCodes,
                // For 'include' scope, create policies for picked codes that
                // don't have one yet — that's what makes first-time setup work.
                create_if_missing: setBrokerScope === 'include',
            })
            if (!res.success) { toast.error(res.error || 'Failed to update broker'); return }
            const createdN = res.created?.length ?? 0
            const updatedN = (res.count ?? 0) - createdN
            toast.success(
                `Broker = ${setBrokerProvider}` +
                (updatedN ? ` · ${updatedN} updated` : '') +
                (createdN ? ` · ${createdN} created` : ''),
            )
            onClose()
            setSetBrokerCodes([])
            setSetBrokerKey('')
            await loadAll()
        } finally {
            setSetBrokerBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid color-mix(in srgb, var(--app-warning) 30%, var(--app-border))',
                    boxShadow: '0 20px 60px color-mix(in srgb, var(--app-warning) 18%, transparent)',
                }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-warning)' }} />

                {/* Header */}
                <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                        <ShieldCheck size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-black text-app-foreground" style={{ fontSize: 14, lineHeight: 1.3 }}>Set Broker</div>
                        <p className="font-bold uppercase tracking-widest text-app-muted-foreground mt-0.5" style={{ fontSize: 9 }}>
                            Re-assign the rate provider for one, all, or a custom group of currencies
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors shrink-0 -m-1">
                        <Plus size={14} className="rotate-45" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 pb-4 space-y-4">
                    {/* Provider picker — visual cards instead of plain select */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">1. Pick provider</div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { code: 'ECB' as const,                label: 'ECB',                  hint: 'Free · ECB daily XML, 32 majors + pegs' },
                                { code: 'FRANKFURTER' as const,        label: 'Frankfurter',          hint: 'Free · ECB-derived JSON · no auth' },
                                { code: 'EXCHANGERATE_HOST' as const,  label: 'exchangerate.host',    hint: '~170 ccys · API access_key' },
                                { code: 'FIXER' as const,              label: 'Fixer.io',             hint: 'Paid · 170+ ccys · api_key' },
                                { code: 'OPENEXCHANGERATES' as const,  label: 'OpenExchangeRates',    hint: 'Paid · 170+ ccys · app_id' },
                                { code: 'MANUAL' as const,             label: 'Manual',               hint: 'You enter rates by hand · no fetch' },
                            ].map(opt => {
                                const active = setBrokerProvider === opt.code
                                return (
                                    <button key={opt.code} type="button"
                                        onClick={() => setSetBrokerProvider(opt.code)}
                                        className="text-left px-3 py-2 rounded-lg transition-all"
                                        style={active
                                            ? { ...soft('--app-warning', 12), border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)' }
                                            : { background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-black text-[11px]"
                                                style={{ color: active ? 'var(--app-warning)' : 'var(--app-foreground)' }}>{opt.label}</span>
                                            {active && <Check size={11} style={{ color: 'var(--app-warning)' }} />}
                                        </div>
                                        <div className="text-[9px] text-app-muted-foreground mt-0.5 leading-tight">{opt.hint}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Optional API key (paid providers) */}
                    {(setBrokerProvider === 'EXCHANGERATE_HOST' || setBrokerProvider === 'FIXER' || setBrokerProvider === 'OPENEXCHANGERATES') && (
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">API key</div>
                            <input value={setBrokerKey} onChange={e => setSetBrokerKey(e.target.value)}
                                type="password" autoComplete="off" placeholder="Provider access_key / api_key"
                                className="w-full px-3 py-1.5 text-[12px] rounded-lg outline-none focus:ring-2 focus:ring-app-warning/20"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <p className="text-[9px] text-app-muted-foreground mt-1 leading-tight">
                                Stored in each policy&apos;s <code className="font-mono">provider_config</code>. Leave blank to keep the existing key.
                            </p>
                        </div>
                    )}

                    {/* Scope picker */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">2. Apply to</div>
                        <div className="inline-flex items-stretch rounded-xl overflow-hidden border h-9 w-full"
                            style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            {([
                                { key: 'all',     label: 'All currencies',    hint: 'Every active policy switches.' },
                                { key: 'include', label: 'Specific',          hint: 'Only the picked currencies.' },
                                { key: 'exclude', label: 'All except',        hint: 'Everything except the picked.' },
                            ] as const).map((opt, idx) => {
                                const active = setBrokerScope === opt.key
                                return (
                                    <button key={opt.key} type="button"
                                        onClick={() => setSetBrokerScope(opt.key)}
                                        title={opt.hint}
                                        className="flex-1 inline-flex items-center justify-center text-[11px] font-bold transition-all"
                                        style={{
                                            color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)',
                                            background: active ? `color-mix(in srgb, var(--app-warning) 12%, transparent)` : 'transparent',
                                            borderLeft: idx === 0 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        }}>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {setBrokerScope !== 'all' && (
                        <BrokerChipPicker
                            currencies={currencies}
                            policies={policies}
                            scope={setBrokerScope}
                            codes={setBrokerCodes}
                            setCodes={setSetBrokerCodes}
                            provider={setBrokerProvider}
                        />
                    )}

                    <BrokerImpactPreview
                        policies={policies}
                        scope={setBrokerScope}
                        codes={setBrokerCodes}
                        provider={setBrokerProvider}
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-app-border/50"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <button onClick={onClose}
                        className="px-3.5 py-1.5 rounded-xl font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:bg-app-surface transition-all"
                        style={{ fontSize: 11 }}>
                        Cancel
                    </button>
                    <button onClick={handleSetBroker} disabled={setBrokerBusy}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50"
                        style={{
                            ...grad('--app-warning'),
                            color: 'var(--app-primary-foreground, white)',
                            fontSize: 11,
                            boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)',
                        }}>
                        {setBrokerBusy && <RefreshCcw size={11} className="animate-spin" />}
                        {setBrokerBusy ? 'Applying…' : 'Apply broker'}
                    </button>
                </div>
            </div>
        </div>
    )
}
