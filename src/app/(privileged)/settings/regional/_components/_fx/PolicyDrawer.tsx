'use client'
/**
 * FX Management — POLICY DRAWER (single source of truth for create + edit).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
    type Currency, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import {
    grad, FG_PRIMARY,
    INPUT_CLS, INPUT_STYLE,
    Field,
} from '../fx/_shared'
import { PROVIDER_META } from './constants'
import { PanelGroup, PrefixInput } from './atoms'
import { PolicyDrawerEmpty } from './PolicyDrawerEmpty'

/* ═══════════════════════════════════════════════════════════════════
 *  POLICY DRAWER — single source of truth for create + edit
 * ═══════════════════════════════════════════════════════════════════ */
export function PolicyDrawer({ policy, base, currencies, existingPairs, onRefresh, onClose, onSubmit }: {
    policy: CurrencyRatePolicy | null
    base?: Currency
    currencies: Currency[]
    existingPairs?: Set<string>
    /** Same self-heal as ManualRateModal — refreshes parent state when the
     *  drawer opens to a missing-base condition. */
    onRefresh?: () => Promise<void>
    onClose: () => void
    onSubmit: (patch: any) => Promise<void>
}) {
    const isCreate = policy === null
    const baseCcy = base ?? currencies.find(c => c.is_base)
    const non_base = currencies.filter(c => c.id !== baseCcy?.id && c.is_active)
    const [refreshing, setRefreshing] = useState(false)
    // Stable ref to onRefresh so it doesn't churn the effect deps. Parent's
    // loadAll is recreated on every render (not memoized) — keeping it in deps
    // re-runs this effect on every parent re-render, and even though
    // didRefresh guards the body, the dep churn was visibly thrashing on
    // first open. Ref-based deref is the clean fix.
    const onRefreshRef = useRef(onRefresh)
    onRefreshRef.current = onRefresh
    const didRefresh = useRef(false)
    useEffect(() => {
        if (isCreate && !baseCcy && !didRefresh.current && onRefreshRef.current) {
            didRefresh.current = true
            setRefreshing(true)
            onRefreshRef.current().finally(() => { setRefreshing(false) })
        }
    }, [isCreate, baseCcy])

    const [fromId, setFromId] = useState<number | null>(policy?.from_currency ?? non_base[0]?.id ?? null)
    const [rateType, setRateType] = useState<CurrencyRatePolicy['rate_type']>(policy?.rate_type ?? 'SPOT')
    const [provider, setProvider] = useState<CurrencyRatePolicy['provider']>(policy?.provider ?? 'ECB')
    const [syncFrequency, setSyncFrequency] = useState<CurrencyRatePolicy['sync_frequency']>(policy?.sync_frequency ?? 'DAILY')
    const [autoSync, setAutoSync] = useState(policy?.auto_sync ?? true)
    const [multiplier, setMultiplier] = useState(policy?.multiplier ?? '1.000000')
    const [markupPct, setMarkupPct] = useState(policy?.markup_pct ?? '0.0000')
    const [bidSpreadPct, setBidSpreadPct] = useState(policy?.bid_spread_pct ?? '0.0000')
    const [askSpreadPct, setAskSpreadPct] = useState(policy?.ask_spread_pct ?? '0.0000')
    const [apiKey, setApiKey] = useState('')
    const [busy, setBusy] = useState(false)

    const meta = PROVIDER_META[provider]
    const mul = Number(multiplier); const mk = Number(markupPct)
    const bid = Number(bidSpreadPct); const ask = Number(askSpreadPct)
    const mulValid = isFinite(mul) && mul > 0
    const mkValid  = isFinite(mk) && mk >= -50 && mk <= 50
    const bidValid = isFinite(bid) && bid >= 0 && bid <= 50
    const askValid = isFinite(ask) && ask >= 0 && ask <= 50
    const dupKey = `${fromId}-${baseCcy?.id}-${rateType}`
    const isDup = isCreate && existingPairs?.has(dupKey)
    const valid = mulValid && mkValid && bidValid && askValid && !isDup && !!fromId
    // For paid providers, require key only on create. On edit, leaving key
    // blank means "keep existing", so we accept blank.
    const needsKey = meta.needsKey && (isCreate ? !apiKey.trim() : false)

    const previewAdjusted = mulValid ? (1 * mul * (mkValid ? (1 + mk / 100) : 1)).toFixed(6) : null

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-md flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                {/* Header */}
                <div className="px-5 py-4 flex items-start justify-between gap-3"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div>
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                            {isCreate ? 'New rate source' : `${policy?.from_code} → ${policy?.to_code}`}
                        </div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            {isCreate ? 'Configure how a pair is sourced' : 'Edit policy'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Cant-create state — replaces a half-broken form when the
                        currency list isn't available. Surfaces refresh status
                        and a retry button so the user has a path forward. */}
                    {isCreate && !baseCcy && (
                        <PolicyDrawerEmpty
                            refreshing={refreshing}
                            currencies={currencies}
                            onRefresh={onRefresh}
                            onClose={onClose}
                            setRefreshing={setRefreshing}
                        />
                    )}

                    {/* Pair (create only) */}
                    {isCreate && baseCcy && (
                        <Field label="Pair" hint={isDup ? 'A policy for this pair already exists' : undefined} error={isDup}>
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                <select value={fromId ?? ''} onChange={e => setFromId(Number(e.target.value))}
                                    className={INPUT_CLS} style={INPUT_STYLE}>
                                    {non_base.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                                </select>
                                <span className="text-[12px] font-mono font-black text-center" style={{ color: 'var(--app-muted-foreground)' }}>→</span>
                                <div className="px-3 py-1.5 rounded-lg font-mono font-black text-center"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)', fontSize: 12 }}>
                                    {baseCcy.code}
                                </div>
                            </div>
                        </Field>
                    )}

                    {/* Suppress the rest of the form in the no-base error state — the
                        user has nothing to configure until currencies load. */}
                    {(!isCreate || baseCcy) && (
                    <>

                    {/* Provider + rate type + frequency */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Provider">
                            <select value={provider} onChange={e => setProvider(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="ECB">ECB · free</option>
                                <option value="FRANKFURTER">Frankfurter · free</option>
                                <option value="EXCHANGERATE_HOST">exchangerate.host</option>
                                <option value="FIXER">Fixer.io</option>
                                <option value="OPENEXCHANGERATES">OpenExchangeRates</option>
                                <option value="MANUAL">Manual entry</option>
                            </select>
                        </Field>
                        <Field label="Rate type">
                            <select value={rateType} onChange={e => setRateType(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="SPOT">SPOT</option>
                                <option value="AVERAGE">AVERAGE</option>
                                <option value="CLOSING">CLOSING</option>
                            </select>
                        </Field>
                    </div>

                    {provider !== 'MANUAL' && (
                        <Field label="Refresh">
                            <select value={syncFrequency} onChange={e => setSyncFrequency(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="ON_TRANSACTION">Per transaction (just-in-time)</option>
                                <option value="DAILY">Every day</option>
                                <option value="WEEKLY">Every week</option>
                                <option value="MONTHLY">Every month</option>
                            </select>
                        </Field>
                    )}

                    {/* API key (paid providers) */}
                    {meta.needsKey && (
                        <Field label="API key" hint={!isCreate ? 'Leave blank to keep existing key' : undefined}>
                            <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                                type="password" autoComplete="off"
                                placeholder={provider === 'FIXER' ? 'Fixer access_key'
                                    : provider === 'OPENEXCHANGERATES' ? 'OXR app_id' : 'access_key'}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </Field>
                    )}

                    {/* Multiplier × Markup */}
                    <PanelGroup tone="--app-info" title="Spread Adjustment" hint="Optional. Default = no spread.">
                        <div className="grid grid-cols-2 gap-2">
                            <PrefixInput tone="--app-info" prefix="×" suffix=""
                                value={multiplier} onChange={setMultiplier} valid={mulValid}
                                placeholder="1.000000" />
                            <PrefixInput tone="--app-info" prefix="+" suffix="%"
                                value={markupPct} onChange={setMarkupPct} valid={mkValid}
                                placeholder="0.0000" />
                        </div>
                        {previewAdjusted && valid && (
                            <p className="font-mono mt-2" style={{ fontSize: 10, color: 'var(--app-info)' }}>
                                Preview: 1.000000 × {Number(multiplier).toFixed(6)} × (1 + {Number(markupPct).toFixed(4)}%) = <strong>{previewAdjusted}</strong>
                            </p>
                        )}
                    </PanelGroup>

                    {/* Bid / Ask spread */}
                    <PanelGroup tone="--app-warning" title="Bid / Ask Spread" hint="Non-zero = sync writes (MID, BID, ASK) triple.">
                        <div className="grid grid-cols-2 gap-2">
                            <PrefixInput tone="--app-warning" prefix="−" suffix="%"
                                value={bidSpreadPct} onChange={setBidSpreadPct} valid={bidValid}
                                placeholder="0.0000" />
                            <PrefixInput tone="--app-warning" prefix="+" suffix="%"
                                value={askSpreadPct} onChange={setAskSpreadPct} valid={askValid}
                                placeholder="0.0000" />
                        </div>
                    </PanelGroup>

                    {provider !== 'MANUAL' && syncFrequency !== 'ON_TRANSACTION' && (
                        <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer"
                            style={{ color: 'var(--app-foreground)' }}>
                            <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-app-info" />
                            Run on cron (auto-sync)
                        </label>
                    )}
                    </>
                    )}{/* end suppression when isCreate && !baseCcy */}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-between gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                        {!valid && (isDup ? 'Pair already covered'
                            : !mulValid ? 'Invalid multiplier'
                            : !mkValid ? 'Markup out of range'
                            : !bidValid || !askValid ? 'Bid/ask out of range'
                            : 'Fix errors above')}
                        {needsKey && ' · API key required'}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose}
                            className="px-3.5 py-1.5 rounded-xl font-bold border"
                            style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            Cancel
                        </button>
                        <button disabled={busy || !valid || needsKey || (isCreate && !baseCcy)}
                            onClick={async () => {
                                setBusy(true)
                                try {
                                    const provider_config: Record<string, any> = policy?.provider_config ?? {}
                                    const k = apiKey.trim()
                                    if (k) { provider_config.access_key = k; provider_config.api_key = k; provider_config.app_id = k }
                                    const payload: any = {
                                        rate_type: rateType, provider,
                                        sync_frequency: provider === 'MANUAL' ? 'DAILY' : syncFrequency,
                                        auto_sync: autoSync && provider !== 'MANUAL' && syncFrequency !== 'ON_TRANSACTION',
                                        multiplier, markup_pct: markupPct,
                                        bid_spread_pct: bidSpreadPct, ask_spread_pct: askSpreadPct,
                                    }
                                    if (Object.keys(provider_config).length) payload.provider_config = provider_config
                                    if (isCreate) {
                                        payload.from_currency = fromId!
                                        payload.to_currency = baseCcy!.id
                                    }
                                    await onSubmit(payload)
                                } finally { setBusy(false) }
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                            style={!busy && valid && !needsKey
                                ? { ...grad('--app-primary'), color: FG_PRIMARY, fontSize: 11, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }
                                : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                            {busy ? 'Saving…' : (isCreate ? 'Create policy' : 'Save changes')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
