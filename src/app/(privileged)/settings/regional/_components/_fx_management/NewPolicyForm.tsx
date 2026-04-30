'use client'

import { useState } from 'react'
import { RefreshCcw, TrendingUp, AlertTriangle } from 'lucide-react'
import type { Currency, CurrencyRatePolicy } from '@/app/actions/finance/currency'
import { INPUT_CLS, INPUT_STYLE, grad, soft } from './constants'
import { FieldLabel } from './atoms'
import { PolicySpreadPanel, PolicyBidAskPanel } from './NewPolicyForm.parts'

export function NewPolicyForm({ currencies, base, existingPairs, onCancel, onSubmit }: {
    currencies: Currency[]
    base: Currency
    /** `${from_id}-${to_id}-${rate_type}` keys already configured; blocks the
     *  unique-together violation client-side instead of failing on submit. */
    existingPairs: Set<string>
    onCancel: () => void
    onSubmit: (p: {
        from_currency: number
        to_currency: number
        rate_type: CurrencyRatePolicy['rate_type']
        provider: CurrencyRatePolicy['provider']
        auto_sync: boolean
        sync_frequency: CurrencyRatePolicy['sync_frequency']
        multiplier: string
        markup_pct: string
        bid_spread_pct?: string
        ask_spread_pct?: string
        provider_config?: Record<string, any>
    }) => Promise<void>
}) {
    const non_base = currencies.filter(c => c.id !== base.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    // ── Rate "mode" is a UI-level abstraction over `provider`. FIXED rates are
    //    `MANUAL` (operator types the rate, never auto-fetched). FLOATING are
    //    provider-fed — ECB / Frankfurter / exchangerate.host / Fixer / OXR. ──
    const [rateMode, setRateMode] = useState<'FIXED' | 'FLOATING'>('FLOATING')
    const [floatingProvider, setFloatingProvider] = useState<Exclude<CurrencyRatePolicy['provider'], 'MANUAL'>>('ECB')
    const provider: CurrencyRatePolicy['provider'] = rateMode === 'FIXED' ? 'MANUAL' : floatingProvider
    const [rateType, setRateType] = useState<CurrencyRatePolicy['rate_type']>('SPOT')
    const [syncFrequency, setSyncFrequency] = useState<CurrencyRatePolicy['sync_frequency']>('DAILY')
    const [multiplier, setMultiplier] = useState('1.000000')
    const [markupPct, setMarkupPct] = useState('0.0000')
    // Optional Bid/Ask spreads — both 0 means single-MID-row mode (default).
    const [bidSpreadPct, setBidSpreadPct] = useState('0.0000')
    const [askSpreadPct, setAskSpreadPct] = useState('0.0000')
    // Optional API key for paid providers — written to provider_config.
    const [apiKey, setApiKey] = useState('')
    const [autoSync, setAutoSync] = useState(true)
    const [busy, setBusy] = useState(false)
    if (!fromId) return <p className="text-[10px] text-app-muted-foreground">Add a non-base currency in the Currencies tab before creating a policy.</p>

    // Validation
    const mul = Number(multiplier)
    const mk = Number(markupPct)
    const bid = Number(bidSpreadPct)
    const ask = Number(askSpreadPct)
    const mulValid = isFinite(mul) && mul > 0
    const mkValid = isFinite(mk) && mk >= -50 && mk <= 50
    const bidValid = isFinite(bid) && bid >= 0 && bid <= 50
    const askValid = isFinite(ask) && ask >= 0 && ask <= 50
    const dupKey = `${fromId}-${base.id}-${rateType}`
    const isDup = existingPairs.has(dupKey)
    // Paid providers need a key; if rateMode=FLOATING && provider needs key, require apiKey
    const needsKey = provider === 'EXCHANGERATE_HOST' || provider === 'FIXER' || provider === 'OPENEXCHANGERATES'
    const keyValid = !needsKey || apiKey.trim().length > 0
    const valid = mulValid && mkValid && bidValid && askValid && !isDup && keyValid

    // Live preview: example raw rate × multiplier × (1+markup/100). Uses 1.0
    // as the synthetic raw rate so users see the adjustment math directly
    // without an extra API roundtrip.
    const previewAdjusted = mulValid
        ? (1 * mul * (mkValid ? (1 + mk / 100) : 1)).toFixed(6)
        : null

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <RefreshCcw size={11} style={{ color: 'var(--app-info)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>New Auto-Sync Policy</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                <div className="md:col-span-2">
                    <FieldLabel label="Pair">
                        <div className="flex items-center gap-2">
                            <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
                                className={INPUT_CLS + ' font-mono flex-1'} style={INPUT_STYLE}>
                                {non_base.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                            </select>
                            <span className="text-[10px] font-mono text-app-muted-foreground">→</span>
                            <span className="text-[12px] font-mono font-black text-app-foreground">{base.code}</span>
                        </div>
                    </FieldLabel>
                </div>
                <FieldLabel label="Type">
                    <select value={rateType} onChange={e => setRateType(e.target.value as CurrencyRatePolicy['rate_type'])} className={INPUT_CLS} style={INPUT_STYLE}>
                        <option value="SPOT">SPOT</option>
                        <option value="AVERAGE">AVERAGE</option>
                        <option value="CLOSING">CLOSING</option>
                    </select>
                </FieldLabel>
                <FieldLabel label="Mode">
                    <select value={rateMode} onChange={e => setRateMode(e.target.value as 'FIXED' | 'FLOATING')}
                        className={INPUT_CLS} style={INPUT_STYLE}
                        title="FIXED = manual entry only, never auto-fetched (e.g. CFA ↔ EUR peg). FLOATING = pulled from a provider.">
                        <option value="FLOATING">Floating</option>
                        <option value="FIXED">Fixed · manual</option>
                    </select>
                </FieldLabel>
                {rateMode === 'FLOATING' && (
                    <FieldLabel label="Provider">
                        <select value={floatingProvider}
                            onChange={e => setFloatingProvider(e.target.value as Exclude<CurrencyRatePolicy['provider'], 'MANUAL'>)}
                            className={INPUT_CLS} style={INPUT_STYLE}
                            title="Which broker fetches the rate. ECB & Frankfurter are free; the rest need an API key.">
                            <option value="ECB">ECB · free</option>
                            <option value="FRANKFURTER">Frankfurter · free</option>
                            <option value="EXCHANGERATE_HOST">exchangerate.host</option>
                            <option value="FIXER">Fixer.io</option>
                            <option value="OPENEXCHANGERATES">OpenExchangeRates</option>
                        </select>
                    </FieldLabel>
                )}
                <FieldLabel label="Refresh">
                    <select value={rateMode === 'FIXED' ? 'NEVER' : syncFrequency}
                        onChange={e => setSyncFrequency(e.target.value as CurrencyRatePolicy['sync_frequency'])}
                        disabled={rateMode === 'FIXED'}
                        className={INPUT_CLS} style={INPUT_STYLE}
                        title="How often the engine refreshes a FLOATING rate. Per-transaction = pulled at posting time. Daily/Weekly/Monthly = honoured by cron.">
                        {rateMode === 'FIXED'
                            ? <option value="NEVER">Never (fixed)</option>
                            : <>
                                <option value="ON_TRANSACTION">Per transaction</option>
                                <option value="DAILY">Every day</option>
                                <option value="WEEKLY">Every week</option>
                                <option value="MONTHLY">Every month</option>
                            </>}
                    </select>
                </FieldLabel>
            </div>

            {/* ── Spread adjustment panel — both knobs grouped, with affixed
                 unit labels, presets, and a live preview line. Multiplier is
                 a structural scaling factor; Markup is an operational fee. ── */}
            <PolicySpreadPanel
                multiplier={multiplier} setMultiplier={setMultiplier}
                markupPct={markupPct} setMarkupPct={setMarkupPct}
                mulValid={mulValid} mkValid={mkValid}
            />

            {/* ── Bid / Ask spreads — when EITHER is non-zero, syncs write a
                 (MID, BID, ASK) triple per snapshot. Default 0/0 = single
                 mid-rate row, backwards-compatible. ── */}
            <PolicyBidAskPanel
                bidSpreadPct={bidSpreadPct} setBidSpreadPct={setBidSpreadPct}
                askSpreadPct={askSpreadPct} setAskSpreadPct={setAskSpreadPct}
                bidValid={bidValid} askValid={askValid}
            />

            {/* ── API key (paid providers only) ── */}
            {needsKey && (
                <div className="rounded-xl p-3"
                    style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 18%, transparent)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-error)' }}>API Key required</span>
                        <span className="text-[9px] text-app-muted-foreground">stored in <code className="font-mono">provider_config</code></span>
                    </div>
                    <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                        type="password" autoComplete="off"
                        placeholder={
                            provider === 'FIXER' ? 'Fixer access_key (data.fixer.io)'
                            : provider === 'OPENEXCHANGERATES' ? 'OpenExchangeRates app_id'
                            : 'exchangerate.host access_key'
                        }
                        className="w-full px-3 py-1.5 text-[12px] rounded-lg outline-none focus:ring-2"
                        style={{
                            background: 'var(--app-background)',
                            border: keyValid ? '1px solid var(--app-border)' : '1px solid color-mix(in srgb, var(--app-error) 50%, transparent)',
                            color: 'var(--app-foreground)',
                        }} />
                </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                    {isDup && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                            <AlertTriangle size={10} /> A {rateType} policy already exists for this pair
                        </span>
                    )}
                    {!mulValid && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                            <AlertTriangle size={10} /> Multiplier must be a positive number
                        </span>
                    )}
                    {mulValid && !mkValid && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                            <AlertTriangle size={10} /> Markup must be between -50 and +50
                        </span>
                    )}
                </div>
                {previewAdjusted && valid && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md"
                        style={{ ...soft('--app-info', 8), color: 'var(--app-info)' }}
                        title={`If today's raw rate were 1.000000, this policy would store ${previewAdjusted}`}>
                        <TrendingUp size={10} /> Preview: 1.000000 × {Number(multiplier).toFixed(6)} × (1 + {Number(markupPct).toFixed(4)}%) = <strong className="font-black">{previewAdjusted}</strong>
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-app-border/30">
                <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer text-app-foreground"
                    title={rateMode === 'FIXED'
                        ? 'FIXED rates never auto-sync — toggle has no effect'
                        : syncFrequency === 'ON_TRANSACTION'
                            ? 'Per-transaction policies sync just-in-time, not via cron — toggle has no effect'
                            : `Cron will refresh this rate ${syncFrequency.toLowerCase()}`}>
                    <input type="checkbox"
                        checked={autoSync && rateMode === 'FLOATING' && syncFrequency !== 'ON_TRANSACTION'}
                        disabled={rateMode === 'FIXED' || syncFrequency === 'ON_TRANSACTION'}
                        onChange={e => setAutoSync(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-app-info" />
                    Run on cron (auto-sync)
                </label>
                <div className="flex items-center gap-2">
                    <button onClick={onCancel} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border/50 hover:bg-app-background transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button disabled={busy || !valid} onClick={async () => {
                        setBusy(true)
                        try {
                            // Each broker reads a different config key. Set all
                            // three so the policy works regardless.
                            const provider_config: Record<string, any> = {}
                            const k = apiKey.trim()
                            if (k) {
                                provider_config.access_key = k
                                provider_config.api_key = k
                                provider_config.app_id = k
                            }
                            await onSubmit({
                                from_currency: fromId!, to_currency: base.id, rate_type: rateType,
                                provider,
                                auto_sync: autoSync && provider !== 'MANUAL' && syncFrequency !== 'ON_TRANSACTION',
                                sync_frequency: rateMode === 'FIXED' ? 'DAILY' : syncFrequency,
                                multiplier, markup_pct: markupPct,
                                bid_spread_pct: bidSpreadPct, ask_spread_pct: askSpreadPct,
                                ...(Object.keys(provider_config).length ? { provider_config } : {}),
                            })
                        } finally { setBusy(false) }
                    }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                        style={!busy && valid
                            ? { ...grad('--app-info'), color: 'var(--app-primary-foreground, white)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 30%, transparent)' }
                            : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        {busy ? 'Creating…' : 'Create Policy'}
                    </button>
                </div>
            </div>
        </div>
    )
}
