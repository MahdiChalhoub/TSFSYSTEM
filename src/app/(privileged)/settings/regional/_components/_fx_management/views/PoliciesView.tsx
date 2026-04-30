'use client'

import { toast } from 'sonner'
import {
    RefreshCcw, Plus, ShieldCheck, Wand2, AlertTriangle, Check,
} from 'lucide-react'
import {
    createRatePolicy,
    type Currency, type ExchangeRate, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { soft, grad, HEALTH_COLOR, policyHealth } from '../constants'
import { SectionHeader, PrimaryButton, HealthPill } from '../atoms'
import { NewPolicyForm } from '../NewPolicyForm'
import { PoliciesTable } from './PoliciesTable'

export function PoliciesView({
    currencies, baseCurrency, policies, latestRateByKey,
    orgCurrencyCount, orgBaseCode,
    hasBase, hasNonBase,
    newPolicyOpen, setNewPolicyOpen, setPendingNewPolicy,
    setSetBrokerOpen,
    bulkBusy, handleBulkCreate,
    syncingAll, syncAllProgress, handleSyncAll,
    syncingId, deletingId, handleSyncPolicy, handleDeletePolicy,
    policyQuery, setPolicyQuery,
    policyHealthFilter, setPolicyHealthFilter,
    policyProviderFilter, setPolicyProviderFilter,
    editingPolicy, setEditingPolicy, savingEdit, commitInlineEdit,
    loadAll,
}: {
    currencies: Currency[]
    baseCurrency?: Currency
    policies: CurrencyRatePolicy[]
    latestRateByKey: Map<string, ExchangeRate>
    orgCurrencyCount?: number
    orgBaseCode?: string | null
    hasBase: boolean
    hasNonBase: boolean
    newPolicyOpen: boolean
    setNewPolicyOpen: (v: boolean) => void
    setPendingNewPolicy: (v: boolean) => void
    setSetBrokerOpen: (v: boolean) => void
    bulkBusy: boolean
    handleBulkCreate: () => Promise<void>
    syncingAll: boolean
    syncAllProgress: { done: number; total: number } | null
    handleSyncAll: () => Promise<void>
    syncingId: number | null
    deletingId: number | null
    handleSyncPolicy: (id: number) => Promise<void>
    handleDeletePolicy: (p: CurrencyRatePolicy) => Promise<void>
    policyQuery: string
    setPolicyQuery: (v: string) => void
    policyHealthFilter: 'all' | 'fresh' | 'stale' | 'fail' | 'never' | 'manual'
    setPolicyHealthFilter: (v: 'all' | 'fresh' | 'stale' | 'fail' | 'never' | 'manual') => void
    policyProviderFilter: 'all' | CurrencyRatePolicy['provider']
    setPolicyProviderFilter: (v: 'all' | CurrencyRatePolicy['provider']) => void
    editingPolicy: { id: number; multiplier: string; markup_pct: string } | null
    setEditingPolicy: React.Dispatch<React.SetStateAction<{ id: number; multiplier: string; markup_pct: string } | null>>
    savingEdit: boolean
    commitInlineEdit: () => Promise<void>
    loadAll: () => Promise<void>
}) {
    // Health roll-up of all policies → drives the overview pills.
    const healthCounts = policies.reduce<Record<ReturnType<typeof policyHealth>, number>>((acc, p) => {
        const h = policyHealth(p); acc[h] = (acc[h] ?? 0) + 1; return acc
    }, { manual: 0, never: 0, fail: 0, stale: 0, fresh: 0 })
    // Use OrgCurrency-derived counts when available — the finance.Currency
    // mirror can be empty/lagged after first reaching this page, in which
    // case `currencies.length` would falsely gate everything off.
    const nonBaseFromMirror = currencies.filter(c => !c.is_base && c.is_active).length
    const nonBaseCount = Math.max(nonBaseFromMirror, Math.max(0, (orgCurrencyCount ?? 0) - (orgBaseCode ? 1 : 0)))
    const policiedFromIds = new Set(policies.map(p => p.from_currency))
    const missingCoverage = nonBaseFromMirror > 0
        ? currencies.filter(c => !c.is_base && c.is_active && !policiedFromIds.has(c.id)).length
        : nonBaseCount  // mirror empty → assume nothing covered yet

    return (
        <div className="space-y-3">
            {/* Health roll-up — at-a-glance status of every policy. */}
            {policies.length > 0 && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 p-3 grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                    <HealthPill label="Healthy"   value={healthCounts.fresh}  color="--app-success" icon={<Check size={12} />} />
                    <HealthPill label="Stale >36h" value={healthCounts.stale}  color="--app-warning" icon={<AlertTriangle size={12} />} />
                    <HealthPill label="Failing"   value={healthCounts.fail}   color="--app-error"   icon={<AlertTriangle size={12} />} />
                    <HealthPill label="Never run" value={healthCounts.never}  color="--app-muted-foreground" icon={<RefreshCcw size={12} />} />
                    <HealthPill label="Manual"    value={healthCounts.manual} color="--app-info"    icon={<ShieldCheck size={12} />} />
                </div>
            )}

            <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                <SectionHeader
                    icon={<RefreshCcw size={13} style={{ color: 'var(--app-info)' }} />}
                    title="Auto-Sync Policies"
                    subtitle={
                        policies.length === 0
                            ? 'One policy per pair · pulls a fresh rate from the provider on a daily cron'
                            : `${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}` +
                              (missingCoverage ? ` · ${missingCoverage} active currenc${missingCoverage === 1 ? 'y' : 'ies'} not covered` : ' · all active currencies covered')
                    }
                    action={
                        <div className="flex items-center gap-2 flex-wrap">
                            {missingCoverage > 0 && nonBaseCount > 0 && hasBase && (
                                <button onClick={handleBulkCreate} disabled={bulkBusy}
                                    title={`Create an ECB / SPOT / auto-sync policy for the ${missingCoverage} uncovered currenc${missingCoverage === 1 ? 'y' : 'ies'}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                                    style={{ ...soft('--app-success', 12), color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                                    <Wand2 size={11} className={bulkBusy ? 'animate-spin' : ''} />
                                    {bulkBusy ? 'Configuring…' : `Auto-configure ${missingCoverage}`}
                                </button>
                            )}
                            {policies.length > 0 && (
                                <button onClick={() => setSetBrokerOpen(true)}
                                    title="Switch the broker (ECB / Frankfurter / exchangerate.host / MANUAL) for one currency, all currencies, or a custom group"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                                    style={{ ...soft('--app-warning', 12), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                                    <ShieldCheck size={11} /> Set Broker
                                </button>
                            )}
                            <button onClick={handleSyncAll} disabled={syncingAll || policies.filter(p => p.provider !== 'MANUAL').length === 0}
                                title="Sync every active non-MANUAL policy now"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-app-border/50 hover:bg-app-background transition-all disabled:opacity-50"
                                style={{ color: 'var(--app-info)' }}>
                                <RefreshCcw size={11} className={syncingAll ? 'animate-spin' : ''} />
                                {syncingAll
                                    ? `Syncing ${syncAllProgress?.total ?? 0}…`
                                    : `Sync All${policies.filter(p => p.provider !== 'MANUAL').length ? ` (${policies.filter(p => p.provider !== 'MANUAL').length})` : ''}`}
                            </button>
                            <PrimaryButton
                                colorVar="--app-info"
                                disabled={!hasNonBase || !hasBase}
                                title={!hasBase
                                    ? 'Set a base in the Currencies tab first'
                                    : !hasNonBase
                                        ? 'Enable a non-base currency in the Currencies tab first'
                                        : 'Configure a new auto-sync pair'}
                                onClick={() => {
                                    if (!hasBase) { toast.error('Set a base currency first — Currencies tab → ⭐'); return }
                                    if (!hasNonBase) { toast.error('Enable at least one non-base currency in the Currencies tab.'); return }
                                    if (!baseCurrency) {
                                        // Form needs the mirror — open as soon as it lands.
                                        setPendingNewPolicy(true)
                                        toast.info('Resolving currencies…')
                                        void loadAll()
                                        return
                                    }
                                    setNewPolicyOpen(true)
                                }}
                            >
                                <Plus size={11} /> New Policy
                            </PrimaryButton>
                        </div>
                    }
                />
                {newPolicyOpen && baseCurrency && (
                    <div className="px-4 py-3 border-b border-app-border/50" style={soft('--app-info', 4)}>
                        <NewPolicyForm
                            currencies={currencies}
                            base={baseCurrency}
                            existingPairs={new Set(policies.map(p => `${p.from_currency}-${p.to_currency}-${p.rate_type}`))}
                            onCancel={() => setNewPolicyOpen(false)}
                            onSubmit={async (payload) => {
                                const r = await createRatePolicy(payload)
                                if (!r.success) { toast.error(r.error || 'Create failed'); return }
                                toast.success('Policy created')
                                setNewPolicyOpen(false)
                                await loadAll()
                            }}
                        />
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {/* Filter row — only when worth filtering. */}
                    {policies.length >= 4 && (() => {
                        const providers = Array.from(new Set(policies.map(p => p.provider))) as CurrencyRatePolicy['provider'][]
                        return (
                            <div className="flex items-center gap-2 flex-wrap">
                                <input value={policyQuery} onChange={e => setPolicyQuery(e.target.value)}
                                    placeholder="Filter by pair, provider, status…"
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-app-info/20 transition-all flex-1 min-w-[180px]"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-app-border/50 bg-app-surface" title="Filter by health">
                                    {(['all', 'fresh', 'stale', 'fail', 'never', 'manual'] as const).map(k => (
                                        <button key={k} onClick={() => setPolicyHealthFilter(k)}
                                            className="px-2 py-1 text-[10px] font-bold rounded-md transition-all"
                                            style={policyHealthFilter === k
                                                ? (k === 'all'
                                                    ? { background: 'var(--app-foreground)', color: 'var(--app-background)' }
                                                    : { ...soft(HEALTH_COLOR[k], 18), color: `var(${HEALTH_COLOR[k]})` })
                                                : { color: 'var(--app-muted-foreground)' }}>
                                            {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                {providers.length > 1 && (
                                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-app-border/50 bg-app-surface" title="Filter by provider">
                                        <button onClick={() => setPolicyProviderFilter('all')}
                                            className="px-2 py-1 text-[10px] font-bold rounded-md transition-all"
                                            style={policyProviderFilter === 'all'
                                                ? { background: 'var(--app-foreground)', color: 'var(--app-background)' }
                                                : { color: 'var(--app-muted-foreground)' }}>
                                            All providers
                                        </button>
                                        {providers.map(prov => (
                                            <button key={prov} onClick={() => setPolicyProviderFilter(prov)}
                                                className="px-2 py-1 text-[10px] font-bold font-mono rounded-md transition-all"
                                                style={policyProviderFilter === prov
                                                    ? { ...soft(prov === 'MANUAL' ? '--app-muted-foreground' : '--app-success', 18), color: prov === 'MANUAL' ? 'var(--app-muted-foreground)' : 'var(--app-success)' }
                                                    : { color: 'var(--app-muted-foreground)' }}>
                                                {prov}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })()}
                    {policies.length === 0 ? (
                        <div className="py-8 px-4 text-center">
                            <div className="flex justify-center"><RefreshCcw size={28} className="text-app-muted-foreground opacity-20" /></div>
                            <p className="text-[11px] font-bold text-app-foreground mt-2">No auto-sync policies yet</p>
                            <p className="text-[10px] text-app-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                                Wire ECB (free, no API key) into your active currencies in one click — or build them one at a time with <em>New Policy</em>.
                            </p>
                            {nonBaseCount > 0 && hasBase && (
                                <button onClick={handleBulkCreate} disabled={bulkBusy}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                                    style={{ ...grad('--app-success'), color: 'var(--app-primary-foreground, #fff)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                                    <Wand2 size={12} className={bulkBusy ? 'animate-spin' : ''} />
                                    {bulkBusy ? 'Configuring…' : `Auto-configure ${nonBaseCount} currenc${nonBaseCount === 1 ? 'y' : 'ies'}`}
                                </button>
                            )}
                            {!hasBase && orgCurrencyCount === 0 && (
                                <p className="text-[10px] text-app-muted-foreground mt-3">
                                    Add at least one currency in the <em>Select Currency</em> tab first, then come back here.
                                </p>
                            )}
                            {!hasBase && orgCurrencyCount && orgCurrencyCount > 0 && (
                                <p className="text-[10px] text-app-muted-foreground mt-3">
                                    Mark one of your currencies as <strong>base</strong> (⭐) in the <em>Select Currency</em> tab first.
                                </p>
                            )}
                        </div>
                    ) : (
                        <PoliciesTable
                            policies={policies}
                            latestRateByKey={latestRateByKey}
                            policyQuery={policyQuery}
                            policyHealthFilter={policyHealthFilter}
                            policyProviderFilter={policyProviderFilter}
                            editingPolicy={editingPolicy}
                            setEditingPolicy={setEditingPolicy}
                            savingEdit={savingEdit}
                            commitInlineEdit={commitInlineEdit}
                            syncingId={syncingId}
                            deletingId={deletingId}
                            handleSyncPolicy={handleSyncPolicy}
                            handleDeletePolicy={handleDeletePolicy}
                            loadAll={loadAll}
                        />
                    )}
                    {policies.length > 0 && (
                        <div className="rounded-lg p-3 flex items-start gap-2"
                            style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                            <RefreshCcw size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--app-info)' }} />
                            <div className="text-[10px] leading-relaxed text-app-foreground">
                                <strong className="font-black uppercase tracking-widest text-[9px]" style={{ color: 'var(--app-info)' }}>Daily cron</strong> —
                                add <code className="font-mono px-1 py-0.5 rounded" style={soft('--app-info', 12)}>python manage.py sync_currency_rates</code>
                                {' '}to a <code className="font-mono">0 9 * * *</code> schedule to refresh policies with <em>auto-sync on</em> automatically.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
