'use client'
/**
 * FX Management — RATE RULES card grid view (sub-tab #2).
 * Extracted verbatim from FxRedesigned.tsx. Includes Search24 helper.
 */
import { useState } from 'react'
import {
    RefreshCcw, Plus, ShieldCheck, Wand2, AlertTriangle, Check,
    Settings,
} from 'lucide-react'
import {
    type Currency, type ExchangeRate, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import {
    grad, soft, FG_PRIMARY,
    Kpi, ActionBtn,
} from '../fx/_shared'
import { HEALTH, PROVIDER_META, type HealthKey } from './constants'
import { PolicyCard } from './PolicyCard'
import { SegSelect, EmptyState } from './atoms'

/* ═══════════════════════════════════════════════════════════════════
 *  RATE RULES — card grid
 * ═══════════════════════════════════════════════════════════════════ */
export function RateRulesView(props: {
    policies: CurrencyRatePolicy[]
    currencies: Currency[]
    baseCurrency: Currency | undefined
    orgCurrencyCount?: number
    orgBaseCode?: string | null
    latestRateByKey: Map<string, ExchangeRate>
    latestSidesByKey: Map<string, { MID?: ExchangeRate; BID?: ExchangeRate; ASK?: ExchangeRate }>
    historyByKey: Map<string, ExchangeRate[]>
    healthCounts: Record<HealthKey, number>
    healthByPolicy: Map<number, HealthKey>
    approachingStale: number
    syncingId: number | null
    syncingAll: boolean
    syncProgress: { done: number; total: number } | null
    bulkBusy: boolean
    onSyncOne: (id: number) => void
    onSyncAll: () => void
    onDelete: (p: CurrencyRatePolicy) => void
    onAutoConfigure: () => void
    onCreate: () => void
    onSetBroker: () => void
    onEdit: (id: number) => void
    onUpdate: (id: number, patch: Partial<CurrencyRatePolicy>) => void
}) {
    const [query, setQuery] = useState('')
    const [healthFilter, setHealthFilter] = useState<'all' | HealthKey>('all')
    const [providerFilter, setProviderFilter] = useState<'all' | CurrencyRatePolicy['provider']>('all')

    const hasBase = !!(props.baseCurrency || props.orgBaseCode)
    const totalCcy = Math.max(props.currencies.length, props.orgCurrencyCount ?? 0)
    const hasNonBase = totalCcy >= 2

    const policiedFromIds = new Set(props.policies.map(p => p.from_currency))
    const nonBaseFromMirror = props.currencies.filter(c => !c.is_base && c.is_active).length
    const missingCoverage = nonBaseFromMirror > 0
        ? props.currencies.filter(c => !c.is_base && c.is_active && !policiedFromIds.has(c.id)).length
        : Math.max(0, totalCcy - 1 - props.policies.length)

    const q = query.trim().toLowerCase()
    const filtered = props.policies.filter(p => {
        if (healthFilter !== 'all' && props.healthByPolicy.get(p.id) !== healthFilter) return false
        if (providerFilter !== 'all' && p.provider !== providerFilter) return false
        if (!q) return true
        return [p.from_code, p.to_code, p.provider, p.rate_type].some(s => s.toLowerCase().includes(q))
    })

    const usedProviders = Array.from(new Set(props.policies.map(p => p.provider))) as CurrencyRatePolicy['provider'][]
    const eligibleSyncCount = props.policies.filter(p => p.provider !== 'MANUAL').length

    return (
        <div className="space-y-3">
            {/* ── Health KPI strip ── */}
            {props.policies.length > 0 && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 p-2.5 grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                    <Kpi label="Healthy"   value={props.healthCounts.fresh}  tone="--app-success"          icon={<Check size={12} />} />
                    <Kpi label="Stale >36h" value={props.healthCounts.stale} tone="--app-warning"          icon={<AlertTriangle size={12} />} />
                    <Kpi label="Failing"   value={props.healthCounts.fail}   tone="--app-error"            icon={<AlertTriangle size={12} />} />
                    <Kpi label="Never run" value={props.healthCounts.never}  tone="--app-muted-foreground" icon={<RefreshCcw size={12} />} />
                    <Kpi label="Manual"    value={props.healthCounts.manual} tone="--app-info"             icon={<ShieldCheck size={12} />} />
                </div>
            )}

            {/* ── Toolbar (search + actions) ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[220px] relative">
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        data-fx-search
                        placeholder="Search pair, provider, status…  ( / )"
                        className="w-full pl-2.5 pr-12 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-app-primary/20"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded font-mono pointer-events-none"
                        style={{ fontSize: 9, background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>/</kbd>
                </div>

                {/* Health filter */}
                <SegSelect<'all' | HealthKey>
                    title="Health"
                    options={[
                        { key: 'all', label: 'All' },
                        { key: 'fresh', label: 'Fresh', tone: HEALTH.fresh.tone },
                        { key: 'stale', label: 'Stale', tone: HEALTH.stale.tone },
                        { key: 'fail',  label: 'Fail',  tone: HEALTH.fail.tone  },
                        { key: 'never', label: 'Never', tone: HEALTH.never.tone },
                        { key: 'manual',label: 'Manual',tone: HEALTH.manual.tone},
                    ]}
                    value={healthFilter} onChange={setHealthFilter} />

                {usedProviders.length > 1 && (
                    <SegSelect<'all' | CurrencyRatePolicy['provider']>
                        title="Provider"
                        options={[
                            { key: 'all', label: 'All providers' },
                            ...usedProviders.map(p => ({ key: p, label: p, tone: PROVIDER_META[p].tone })),
                        ]}
                        value={providerFilter} onChange={setProviderFilter} />
                )}

                <div className="flex-1" />

                {/* Primary actions */}
                {missingCoverage > 0 && hasBase && (
                    <ActionBtn icon={<Wand2 size={11} className={props.bulkBusy ? 'animate-spin' : ''} />}
                        tone="--app-success"
                        onClick={props.onAutoConfigure} disabled={props.bulkBusy}>
                        {props.bulkBusy ? 'Configuring…' : `Auto-configure ${missingCoverage}`}
                    </ActionBtn>
                )}
                {props.policies.length > 0 && (
                    <ActionBtn icon={<Settings size={11} />} tone="--app-warning"
                        onClick={props.onSetBroker}>
                        Set Broker
                    </ActionBtn>
                )}
                <ActionBtn icon={<RefreshCcw size={11} className={props.syncingAll ? 'animate-spin' : ''} />}
                    tone="--app-info" disabled={props.syncingAll || eligibleSyncCount === 0}
                    onClick={props.onSyncAll}>
                    {props.syncingAll
                        ? (props.syncProgress ? `${props.syncProgress.done}/${props.syncProgress.total}` : 'Syncing…')
                        : eligibleSyncCount > 0 ? `Sync All · ${eligibleSyncCount}` : 'Sync All'}
                </ActionBtn>
                <ActionBtn icon={<Plus size={11} />} tone="--app-primary" filled
                    disabled={!hasNonBase || !hasBase}
                    title={!hasBase
                        ? 'Set a base currency first — Currencies tab → ⭐'
                        : !hasNonBase
                            ? 'Enable at least one non-base currency'
                            : 'Add a new rate-source policy  ( n )'}
                    onClick={props.onCreate}>
                    New Policy
                </ActionBtn>
            </div>

            {/* ── Stale-approaching banner — flags policies near the 36h cliff. ── */}
            {props.approachingStale > 0 && (
                <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
                    style={{ ...soft('--app-warning', 8), border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--app-warning)' }} />
                    <span className="font-bold" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                        {props.approachingStale} polic{props.approachingStale === 1 ? 'y is' : 'ies are'} within 6h of going stale.
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                        Hit Sync All to refresh now, or wait for the next cron tick.
                    </span>
                </div>
            )}

            {/* ── Card grid ── */}
            {props.policies.length === 0 ? (
                <EmptyState
                    icon={<RefreshCcw size={28} className="text-app-muted-foreground opacity-25" />}
                    title="No rate sources yet"
                    hint="Wire ECB into all your active currencies in one click — or add them one at a time."
                    cta={hasBase && totalCcy > 1 ? (
                        <div className="mt-3 inline-flex items-center gap-2">
                            <button onClick={props.onAutoConfigure} disabled={props.bulkBusy}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-50"
                                style={{ ...grad('--app-success'), color: FG_PRIMARY, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                                <Wand2 size={12} className={props.bulkBusy ? 'animate-spin' : ''} />
                                {props.bulkBusy ? 'Configuring…' : `Auto-configure ${Math.max(1, totalCcy - 1)}`}
                            </button>
                            <button onClick={props.onCreate}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border"
                                style={{ color: 'var(--app-primary)', borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)', background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }}>
                                <Plus size={12} /> New Policy
                            </button>
                        </div>
                    ) : (
                        <p className="text-[10px] text-app-muted-foreground mt-3">
                            {!hasBase ? 'Mark a base currency first.' : 'Add at least one non-base currency.'}
                        </p>
                    )}
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<Search24 />}
                    title="No policies match the filter"
                    hint="Try a different search or clear the filters."
                />
            ) : (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                    {filtered.map(p => (
                        <PolicyCard key={p.id}
                            p={p}
                            health={props.healthByPolicy.get(p.id) ?? 'never'}
                            latest={props.latestRateByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`) ?? null}
                            sides={props.latestSidesByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`) ?? {}}
                            history={props.historyByKey.get(`${p.from_code}→${p.to_code}|${p.rate_type}`) ?? []}
                            syncing={props.syncingId === p.id}
                            onSync={() => props.onSyncOne(p.id)}
                            onEdit={() => props.onEdit(p.id)}
                            onDelete={() => props.onDelete(p)}
                            onToggleAuto={() => props.onUpdate(p.id, { auto_sync: !p.auto_sync } as any)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function Search24() { return <RefreshCcw size={28} className="text-app-muted-foreground opacity-20" /> }
