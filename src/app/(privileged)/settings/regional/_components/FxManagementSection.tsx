'use client'

import { Coins, RefreshCcw } from 'lucide-react'
import {
    SUB_TABS, grad, type FxView,
} from './_fx_management/constants'
import { BasePill } from './_fx_management/atoms'
import { useFxManagement } from './_fx_management/useFxManagement'
import { RatesView } from './_fx_management/views/RatesView'
import { PoliciesView } from './_fx_management/views/PoliciesView'
import { RevaluationsView } from './_fx_management/views/RevaluationsView'
import { SetBrokerDialog } from './_fx_management/views/SetBrokerDialog'

export function FxManagementSection({ view, hideHeader, orgCurrencyCount, orgBaseCode }: {
    /** When set, renders only that sub-view (no internal tab strip).
     *  Used when this component is mounted inside the Currencies tab as
     *  an embedded sub-tab — the parent tab strip already provides nav. */
    view?: FxView;
    /** When true, suppress the internal "FX & Rates" header card too —
     *  use when the parent already shows context. */
    hideHeader?: boolean;
    /** Source-of-truth gating handed down from /settings/regional so this
     *  section doesn't disable itself when the finance.Currency mirror is
     *  lagged/empty. The parent already loaded OrgCurrencies; using them
     *  here decouples the UI gating from the mirror's freshness. */
    orgCurrencyCount?: number;
    orgBaseCode?: string | null;
} = {}) {
    const s = useFxManagement(view)

    /** Effective gating: if the parent passed OrgCurrency state, use it as the
     *  source of truth so the UI works even when the finance.Currency mirror
     *  is empty (cron lagged, mirror raised silently, etc.). The backend's
     *  bulk_create now self-heals, so we just need to *let the user click*. */
    const effectiveBaseCode = s.baseCurrency?.code ?? orgBaseCode ?? null
    const effectiveTotalCcy = Math.max(s.currencies.length, orgCurrencyCount ?? 0)
    const hasBase = !!effectiveBaseCode
    const hasNonBase = effectiveTotalCcy >= 2

    if (s.loading) {
        return (
            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-10 flex items-center justify-center">
                <RefreshCcw size={16} className="animate-spin text-app-muted-foreground" />
            </div>
        )
    }

    const subCounts: Record<typeof s.tab, number> = {
        rates: s.rates.length, policies: s.policies.length, revaluations: s.revals.length,
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* ── Section header (suppress when embedded — parent already shows context) ── */}
            {!hideHeader && !s.isEmbedded && (
                <div className="bg-app-surface rounded-2xl border border-app-border/50 px-4 py-3 flex items-center justify-between flex-wrap gap-3"
                     style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0" style={grad('--app-success')}>
                            <Coins size={14} style={{ color: 'var(--app-primary-foreground, #fff)' }} />
                        </div>
                        <div>
                            <div className="font-black uppercase tracking-widest text-app-foreground" style={{ fontSize: 11 }}>FX & Rates</div>
                            <p className="text-app-muted-foreground mt-0.5" style={{ fontSize: 9 }}>
                                Exchange rate history · Auto-sync policies · Period-end revaluation
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <BasePill base={s.baseCurrency} />
                        <button onClick={() => s.loadAll()}
                            title="Refresh"
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border/50 hover:bg-app-background transition-colors"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            <RefreshCcw size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Sub-tab pill strip (only when standalone — parent provides nav otherwise) ── */}
            {!s.isEmbedded && (
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-app-surface border border-app-border/50">
                    {SUB_TABS.map(t => {
                        const Icon = t.icon
                        const active = s.tab === t.key
                        const n = subCounts[t.key]
                        return (
                            <button key={t.key} onClick={() => s.setTab(t.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200 ${active ? 'shadow-md' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                                style={active ? { ...grad(t.color), color: 'var(--app-primary-foreground, #fff)' } : {}}>
                                <Icon size={12} /> {t.label}
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
                                    style={active
                                        ? { background: 'color-mix(in srgb, var(--app-primary-foreground, #fff) 22%, transparent)' }
                                        : { background: 'var(--app-background)' }}>{n}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Currencies are managed in the parent Currencies tab — no
                duplicate sub-tab here. The FX section just consumes them. */}

            {/* ── Rates tab ─────────────────────────────────────────── */}
            {s.tab === 'rates' && (
                <RatesView
                    currencies={s.currencies}
                    baseCurrency={s.baseCurrency}
                    ratesByPair={s.ratesByPair}
                    hasBase={hasBase}
                    hasNonBase={hasNonBase}
                    newRateOpen={s.newRateOpen}
                    setNewRateOpen={s.setNewRateOpen}
                    setPendingNewRate={s.setPendingNewRate}
                    loadAll={s.loadAll}
                />
            )}

            {/* ── Auto-Sync (policies) tab — redesigned ───────────────── */}
            {s.tab === 'policies' && (
                <PoliciesView
                    currencies={s.currencies}
                    baseCurrency={s.baseCurrency}
                    policies={s.policies}
                    latestRateByKey={s.latestRateByKey}
                    orgCurrencyCount={orgCurrencyCount}
                    orgBaseCode={orgBaseCode}
                    hasBase={hasBase}
                    hasNonBase={hasNonBase}
                    newPolicyOpen={s.newPolicyOpen}
                    setNewPolicyOpen={s.setNewPolicyOpen}
                    setPendingNewPolicy={s.setPendingNewPolicy}
                    setSetBrokerOpen={s.setSetBrokerOpen}
                    bulkBusy={s.bulkBusy}
                    handleBulkCreate={s.handleBulkCreate}
                    syncingAll={s.syncingAll}
                    syncAllProgress={s.syncAllProgress}
                    handleSyncAll={s.handleSyncAll}
                    syncingId={s.syncingId}
                    deletingId={s.deletingId}
                    handleSyncPolicy={s.handleSyncPolicy}
                    handleDeletePolicy={s.handleDeletePolicy}
                    policyQuery={s.policyQuery}
                    setPolicyQuery={s.setPolicyQuery}
                    policyHealthFilter={s.policyHealthFilter}
                    setPolicyHealthFilter={s.setPolicyHealthFilter}
                    policyProviderFilter={s.policyProviderFilter}
                    setPolicyProviderFilter={s.setPolicyProviderFilter}
                    editingPolicy={s.editingPolicy}
                    setEditingPolicy={s.setEditingPolicy}
                    savingEdit={s.savingEdit}
                    commitInlineEdit={s.commitInlineEdit}
                    loadAll={s.loadAll}
                />
            )}

            {/* ── Set-Broker dialog — handles all four scopes:
                 1) one currency  → Scope=Specific, pick 1 chip
                 2) all           → Scope=All
                 3) all except    → Scope=Exclude, pick chips to exclude
                 4) group of N    → Scope=Specific, pick N chips                ── */}
            <SetBrokerDialog
                open={s.setBrokerOpen}
                onClose={() => s.setSetBrokerOpen(false)}
                currencies={s.currencies}
                policies={s.policies}
                setBrokerProvider={s.setBrokerProvider}
                setSetBrokerProvider={s.setSetBrokerProvider}
                setBrokerScope={s.setBrokerScope}
                setSetBrokerScope={s.setSetBrokerScope}
                setBrokerCodes={s.setBrokerCodes}
                setSetBrokerCodes={s.setSetBrokerCodes}
                setBrokerKey={s.setBrokerKey}
                setSetBrokerKey={s.setSetBrokerKey}
                setBrokerBusy={s.setBrokerBusy}
                setSetBrokerBusy={s.setSetBrokerBusy}
                loadAll={s.loadAll}
            />

            {/* ── Revaluations tab ──────────────────────────────────── */}
            {s.tab === 'revaluations' && (
                <RevaluationsView
                    periods={s.periods}
                    revals={s.revals}
                    running={s.running}
                    handleRunRevaluation={s.handleRunRevaluation}
                />
            )}
        </div>
    )
}
