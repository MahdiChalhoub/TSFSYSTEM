'use client'

/* Sub-panels extracted from NewPolicyForm purely to keep each .tsx file
 * ≤300 lines. Each panel is a leaf render component — it owns no state,
 * the parent NewPolicyForm passes value/onChange down, so behaviour
 * (validation timing, re-render cadence, hook order) is unchanged. */

/** Spread Adjustment panel — Multiplier + Markup with presets. */
export function PolicySpreadPanel({
    multiplier, setMultiplier, markupPct, setMarkupPct, mulValid, mkValid,
}: {
    multiplier: string
    setMultiplier: (v: string) => void
    markupPct: string
    setMarkupPct: (v: string) => void
    mulValid: boolean
    mkValid: boolean
}) {
    return (
        <div className="rounded-xl p-3 space-y-2.5"
            style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 18%, transparent)' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Spread Adjustment</span>
                    <span className="text-[9px] text-app-muted-foreground">— optional. Default = no spread.</span>
                </div>
                {/* Quick presets — common bank/operator spreads */}
                <div className="inline-flex items-center gap-0.5">
                    {[
                        { label: 'None',   mul: '1.000000', mk: '0.0000' },
                        { label: '+ 1%',  mul: '1.000000', mk: '1.0000' },
                        { label: '+ 2.5%', mul: '1.000000', mk: '2.5000' },
                        { label: '+ 5%',  mul: '1.000000', mk: '5.0000' },
                    ].map(preset => (
                        <button key={preset.label} type="button"
                            onClick={() => { setMultiplier(preset.mul); setMarkupPct(preset.mk) }}
                            title={`Multiplier ${preset.mul} · Markup ${preset.mk}%`}
                            className="text-[9px] font-bold px-2 py-0.5 rounded-md hover:bg-app-info/10 transition-colors"
                            style={{ color: 'var(--app-info)' }}>
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Multiplier — structural factor */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Multiplier</span>
                        <span className="text-[9px] text-app-muted-foreground">scaling factor</span>
                    </div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={mulValid
                            ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                            : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>×</span>
                        <input value={multiplier} onChange={e => setMultiplier(e.target.value)} placeholder="1.000000"
                            inputMode="decimal"
                            title="e.g. 1.035 for a 3.5% spread above the official rate"
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                    </div>
                    <p className="text-[9px] text-app-muted-foreground mt-1 leading-tight">
                        Bare ratio. <code className="font-mono">1.0000</code> = no change.
                    </p>
                </div>

                {/* Markup — percent fee */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Markup</span>
                        <span className="text-[9px] text-app-muted-foreground">percent fee</span>
                    </div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={mkValid
                            ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                            : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>+</span>
                        <input value={markupPct} onChange={e => setMarkupPct(e.target.value)} placeholder="0.0000"
                            inputMode="decimal"
                            title="Applied AFTER multiplier. Range -50 to +50."
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>%</span>
                    </div>
                    <p className="text-[9px] text-app-muted-foreground mt-1 leading-tight">
                        Operational fee on top. <code className="font-mono">0.00</code> = none.
                    </p>
                </div>
            </div>
        </div>
    )
}

/** Bid / Ask spread panel — when EITHER is non-zero, syncs write a
 *  (MID, BID, ASK) triple per snapshot. Default 0/0 = single mid-rate
 *  row, backwards-compatible. */
export function PolicyBidAskPanel({
    bidSpreadPct, setBidSpreadPct, askSpreadPct, setAskSpreadPct, bidValid, askValid,
}: {
    bidSpreadPct: string
    setBidSpreadPct: (v: string) => void
    askSpreadPct: string
    setAskSpreadPct: (v: string) => void
    bidValid: boolean
    askValid: boolean
}) {
    return (
        <div className="rounded-xl p-3 space-y-2.5"
            style={{ background: 'color-mix(in srgb, var(--app-warning) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 18%, transparent)' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Bid / Ask Spread</span>
                    <span className="text-[9px] text-app-muted-foreground">— optional. Stays at 0 = mid-only.</span>
                </div>
                <div className="inline-flex items-center gap-0.5">
                    {[
                        { label: 'None',  bid: '0.0000', ask: '0.0000' },
                        { label: '±0.5%', bid: '0.5000', ask: '0.5000' },
                        { label: '±1%',   bid: '1.0000', ask: '1.0000' },
                        { label: '±2%',   bid: '2.0000', ask: '2.0000' },
                    ].map(p => (
                        <button key={p.label} type="button"
                            onClick={() => { setBidSpreadPct(p.bid); setAskSpreadPct(p.ask) }}
                            className="text-[9px] font-bold px-2 py-0.5 rounded-md hover:bg-app-warning/10 transition-colors"
                            style={{ color: 'var(--app-warning)' }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Bid spread</span>
                        <span className="text-[9px] text-app-muted-foreground">below mid · operator buys</span>
                    </div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={bidValid
                            ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                            : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>−</span>
                        <input value={bidSpreadPct} onChange={e => setBidSpreadPct(e.target.value)} placeholder="0.0000"
                            inputMode="decimal"
                            title="BID = mid × (1 − bid_spread/100). 0–50."
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>%</span>
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-app-foreground">Ask spread</span>
                        <span className="text-[9px] text-app-muted-foreground">above mid · operator sells</span>
                    </div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={askValid
                            ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                            : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>+</span>
                        <input value={askSpreadPct} onChange={e => setAskSpreadPct(e.target.value)} placeholder="0.0000"
                            inputMode="decimal"
                            title="ASK = mid × (1 + ask_spread/100). 0–50."
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums outline-none bg-transparent text-app-foreground" />
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 13, background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>%</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
