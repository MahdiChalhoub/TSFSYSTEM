'use client'
/**
 * FX Management — SET BROKER MODAL (bulk re-assignment).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCcw, Settings, X, Check } from 'lucide-react'
import {
    bulkUpdateRatePolicyProvider,
    type Currency, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import {
    grad, soft, FG_PRIMARY,
    INPUT_CLS, INPUT_STYLE,
} from '../fx/_shared'
import { PROVIDER_META } from './constants'

/* ═══════════════════════════════════════════════════════════════════
 *  SET BROKER MODAL — bulk re-assignment
 * ═══════════════════════════════════════════════════════════════════ */
export function SetBrokerModal({ policies, currencies, onClose, onApplied }: {
    policies: CurrencyRatePolicy[]
    currencies: Currency[]
    onClose: () => void
    onApplied: () => Promise<void>
}) {
    const [provider, setProvider] = useState<CurrencyRatePolicy['provider']>('FRANKFURTER')
    const [scope, setScope] = useState<'all' | 'include' | 'exclude'>('all')
    const [codes, setCodes] = useState<string[]>([])
    const [apiKey, setApiKey] = useState('')
    const [busy, setBusy] = useState(false)

    const meta = PROVIDER_META[provider]
    const policyCodes = new Set(policies.map(p => p.from_code))
    const fromMirror = currencies.filter(c => !c.is_base && c.is_active).map(c => c.code)
    const allCodes = Array.from(new Set([...fromMirror, ...policyCodes])).sort()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, var(--app-border))' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-warning)' }} />
                <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                        <Settings size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>Set Broker</div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            Re-assign the rate provider for one, all, or a custom group of currencies
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>

                <div className="px-5 pb-4 space-y-4">
                    {/* Provider */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>1. Pick provider</div>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(PROVIDER_META) as Array<keyof typeof PROVIDER_META>).map(code => {
                                const m = PROVIDER_META[code]; const active = provider === code
                                return (
                                    <button key={code} type="button" onClick={() => setProvider(code)}
                                        className="text-left px-3 py-2 rounded-lg transition-all"
                                        style={active
                                            ? { ...soft('--app-warning', 12), border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)' }
                                            : { background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-black"
                                                style={{ fontSize: 11, color: active ? 'var(--app-warning)' : 'var(--app-foreground)' }}>{m.label}</span>
                                            {active && <Check size={11} style={{ color: 'var(--app-warning)' }} />}
                                        </div>
                                        <div className="mt-0.5 leading-tight"
                                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                            {m.needsKey ? 'API key required' : 'Free · no auth'}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {meta.needsKey && (
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>API key</div>
                            <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                                type="password" autoComplete="off" placeholder="access_key / api_key / app_id"
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </div>
                    )}

                    {/* Scope */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>2. Apply to</div>
                        <div className="inline-flex items-stretch rounded-xl overflow-hidden border h-9 w-full"
                            style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            {([
                                { key: 'all', label: 'All currencies' },
                                { key: 'include', label: 'Specific' },
                                { key: 'exclude', label: 'All except' },
                            ] as const).map((opt, idx) => {
                                const active = scope === opt.key
                                return (
                                    <button key={opt.key} type="button" onClick={() => setScope(opt.key)}
                                        className="flex-1 inline-flex items-center justify-center font-bold transition-all"
                                        style={{
                                            fontSize: 11,
                                            color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)',
                                            background: active ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)' : 'transparent',
                                            borderLeft: idx === 0 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        }}>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Currencies */}
                    {scope !== 'all' && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {scope === 'include' ? '3. Pick currencies to switch' : '3. Pick currencies to KEEP unchanged'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => setCodes(allCodes)}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                                        style={{ color: 'var(--app-warning)' }}>Select all</button>
                                    <button type="button" onClick={() => setCodes([])}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                                        style={{ color: 'var(--app-warning)' }}>Clear</button>
                                </div>
                            </div>
                            {allCodes.length === 0 ? (
                                <p className="text-[10px] italic" style={{ color: 'var(--app-muted-foreground)' }}>
                                    No active currencies — enable some in the Select Currency tab first.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {allCodes.map(code => {
                                        const active = codes.includes(code)
                                        const hasPolicy = policyCodes.has(code)
                                        return (
                                            <button key={code} type="button"
                                                onClick={() => setCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])}
                                                title={hasPolicy ? `Existing policy will be re-pointed to ${provider}` : `No policy yet — a new one will be created with ${provider}`}
                                                className="px-2 py-1 rounded-md font-mono font-bold inline-flex items-center gap-1"
                                                style={active
                                                    ? { ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)', fontSize: 11 }
                                                    : { background: 'var(--app-background)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)', fontSize: 11 }}>
                                                {active && <Check size={9} className="-mt-px" />}
                                                {code}
                                                {!hasPolicy && (
                                                    <span className="ml-0.5 font-bold uppercase tracking-widest"
                                                        style={{ fontSize: 8, color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}>· new</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Impact */}
                    <div className="rounded-md p-2.5"
                        style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                        <div className="text-[10px] leading-relaxed" style={{ color: 'var(--app-foreground)' }}>
                            {(() => {
                                const codesNow = new Set(policies.map(p => p.from_code))
                                let upd = 0, made = 0
                                if (scope === 'all') upd = policies.length
                                else if (scope === 'include') {
                                    upd = policies.filter(p => codes.includes(p.from_code)).length
                                    made = codes.filter(c => !codesNow.has(c)).length
                                } else {
                                    upd = policies.filter(p => !codes.includes(p.from_code)).length
                                }
                                return (
                                    <>
                                        <strong className="font-black uppercase tracking-widest"
                                            style={{ color: 'var(--app-info)', fontSize: 9 }}>Impact</strong>
                                        {upd > 0 && <> · <strong>{upd}</strong> updated</>}
                                        {made > 0 && <> · <strong style={{ color: 'var(--app-success)' }}>{made} new</strong> created</>}
                                        {' '}with <strong>{provider}</strong>.
                                        {(upd === 0 && made === 0) && ' Nothing selected — pick currencies or change scope.'}
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <button onClick={onClose}
                        className="px-3.5 py-1.5 rounded-xl font-bold border"
                        style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        Cancel
                    </button>
                    <button disabled={busy} onClick={async () => {
                        setBusy(true)
                        try {
                            const provider_config: Record<string, any> = {}
                            const k = apiKey.trim()
                            if (k) { provider_config.access_key = k; provider_config.api_key = k; provider_config.app_id = k }
                            const r = await bulkUpdateRatePolicyProvider({
                                provider, provider_config: Object.keys(provider_config).length ? provider_config : undefined,
                                scope, from_currency_codes: scope === 'all' ? undefined : codes,
                                create_if_missing: scope === 'include',
                            })
                            if (!r.success) { toast.error(r.error || 'Failed'); return }
                            const created = r.created?.length ?? 0
                            const updated = (r.count ?? 0) - created
                            toast.success(`Broker = ${provider}` + (updated ? ` · ${updated} updated` : '') + (created ? ` · ${created} created` : ''))
                            await onApplied()
                        } finally { setBusy(false) }
                    }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                        style={{ ...grad('--app-warning'), color: FG_PRIMARY, fontSize: 11, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                        {busy && <RefreshCcw size={11} className="animate-spin" />}
                        {busy ? 'Applying…' : 'Apply broker'}
                    </button>
                </div>
            </div>
        </div>
    )
}
