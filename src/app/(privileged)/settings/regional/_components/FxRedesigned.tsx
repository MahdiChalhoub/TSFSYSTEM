'use client'
/**
 * FX Management — Redesigned (v3)
 * ================================
 * Three sub-tabs with single-purpose workflows. Replaces FxManagementSection.tsx.
 *
 *   1. Rate Rules         → Source-configuration card grid.
 *                           One card per pair. Each card shows the LIVE rate
 *                           prominently, source provider, freshness pip,
 *                           multiplier/markup/spread inline, and a ⋮ menu.
 *                           Click the card → side drawer for full editing.
 *
 *   2. Rate History       → Pair × time-range filter + table.
 *                           Optional manual-rate quick-add.
 *
 *   3. Revaluations       → Two-column period board.
 *                           LEFT: list of fiscal periods with status pip.
 *                           RIGHT: selected-period detail + run + history.
 *
 * Workflow / logic principles
 * ----------------------------
 *   - One primary action per tab. No buttons that require explanation.
 *   - Live rate is surfaced everywhere a policy/pair appears, never hidden in
 *     a sub-row or tooltip.
 *   - Configuration mutations go through a single drawer (one form, one
 *     submit, one error path). No inline-edit + tooltip + modal mix.
 *   - All colors are CSS variables (`var(--app-...)`); zero hex / 'white' /
 *     'black' literals. The single exception is `var(--app-primary-foreground,
 *     #fff)` which is a fallback chain built into the var system.
 *
 * Theme tokens used:  --app-foreground · --app-muted-foreground ·
 *   --app-background · --app-surface · --app-border ·
 *   --app-primary · --app-primary-foreground ·
 *   --app-success · --app-warning · --app-error · --app-info
 *
 * Implementation note (Maintainability Phase 2 split)
 * ---------------------------------------------------
 * This file is the slim public-API orchestrator. The data layer lives in
 * `_fx/_useFxState.ts`; sub-views (`RateRulesView`, `RateHistoryView`,
 * `RevaluationsView`) and modals/drawers (`PolicyDrawer`, `SetBrokerModal`,
 * `ManualRateModal`) live in `./_fx/`. The split is byte-identical
 * behaviour with zero prop / API change for `FxRedesigned`.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    createExchangeRate, updateRatePolicy, createRatePolicy,
} from '@/app/actions/finance/currency'
import { RevaluationsView } from './fx/RevaluationsView'
import { useFxState } from './_fx/_useFxState'
import { type FxView } from './_fx/constants'
import { SubTabBar } from './_fx/SubTabBar'
import { LoadErrorBanner } from './_fx/LoadErrorBanner'
import { FxSkeleton } from './_fx/atoms'
import { RateRulesView } from './_fx/RateRulesView'
import { RateHistoryView } from './_fx/RateHistoryView'
import { PolicyDrawer } from './_fx/PolicyDrawer'
import { SetBrokerModal } from './_fx/SetBrokerModal'
import { ManualRateModal } from './_fx/ManualRateModal'

/* ═══════════════════════════════════════════════════════════════════
 *  ROOT
 * ═══════════════════════════════════════════════════════════════════ */
export function FxRedesigned({ view, orgCurrencyCount, orgBaseCode }: {
    view?: FxView
    orgCurrencyCount?: number
    orgBaseCode?: string | null
} = {}) {
    const isEmbedded = !!view
    const [tabState, setTab] = useState<FxView>('rates')
    const tab = view ?? tabState

    const s = useFxState()
    const {
        currencies, rates, revals, policies, periods,
        loading, loadErrors, setLoadErrors,
        baseCurrency,
        latestRateByKey, latestSidesByKey, historyByKey,
        healthByPolicy, healthCounts, approachingStale,
        syncingId, syncingAll, syncProgress, bulkBusy,
        loadAll,
        handleSyncOne, handleSyncAll, handleDelete, handleAutoConfigure,
    } = s

    // Drawer / modal state
    const [editPolicyId, setEditPolicyId] = useState<number | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [setBrokerOpen, setSetBrokerOpen] = useState(false)
    const [manualRateOpen, setManualRateOpen] = useState(false)
    const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null)

    const editPolicy = policies.find(p => p.id === editPolicyId) ?? null
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId) ?? periods[0] ?? null

    /* ─── Keyboard shortcuts: '/' focuses search · 'n' opens new-policy
     *  drawer · Esc closes any open drawer/modal. ── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (tab !== 'policies') return
            const target = e.target as HTMLElement
            const inField = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
            if (e.key === '/' && !inField) {
                e.preventDefault()
                const input = document.querySelector<HTMLInputElement>('[data-fx-search]')
                input?.focus()
            } else if (e.key === 'n' && !inField && !createOpen && !editPolicyId && !setBrokerOpen) {
                e.preventDefault()
                setCreateOpen(true)
            } else if (e.key === 'Escape') {
                if (editPolicyId !== null) setEditPolicyId(null)
                else if (createOpen) setCreateOpen(false)
                else if (setBrokerOpen) setSetBrokerOpen(false)
                else if (manualRateOpen) setManualRateOpen(false)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [tab, createOpen, editPolicyId, setBrokerOpen, manualRateOpen])

    if (loading) return <FxSkeleton />

    // Visible diagnostic banner — appears whenever any endpoint failed in
    // loadAll. Replaces the silent "return [] on error" pattern so users see
    // exactly which slice of data is missing and why. Click Retry to refire
    // loadAll; a real error message lives in each row's tooltip.
    const hasLoadErrors = Object.keys(loadErrors).length > 0


    /* ═══════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════ */
    return (
        <div className="space-y-3 animate-in fade-in duration-300">
            {/* ── Tab strip (only standalone — parent provides nav otherwise) ── */}
            {!isEmbedded && (
                <SubTabBar tab={tab} setTab={setTab}
                    counts={{ rates: policies.length, history: rates.length, reval: revals.length }} />
            )}

            {hasLoadErrors && (
                <LoadErrorBanner
                    loadErrors={loadErrors}
                    onRetry={() => { setLoadErrors({}); void loadAll() }}
                    onDismiss={() => setLoadErrors({})}
                />
            )}

            {/* ───────────────── Rate Rules ───────────────── */}
            {tab === 'policies' && (
                <RateRulesView
                    policies={policies}
                    currencies={currencies}
                    baseCurrency={baseCurrency}
                    orgCurrencyCount={orgCurrencyCount}
                    orgBaseCode={orgBaseCode}
                    latestRateByKey={latestRateByKey}
                    latestSidesByKey={latestSidesByKey}
                    historyByKey={historyByKey}
                    healthCounts={healthCounts}
                    healthByPolicy={healthByPolicy}
                    approachingStale={approachingStale}
                    syncingId={syncingId}
                    syncingAll={syncingAll}
                    syncProgress={syncProgress}
                    bulkBusy={bulkBusy}
                    onSyncOne={handleSyncOne}
                    onSyncAll={handleSyncAll}
                    onDelete={handleDelete}
                    onAutoConfigure={handleAutoConfigure}
                    onCreate={() => {
                        console.log('[FX] New Policy clicked', {
                            hasBaseCurrency: !!baseCurrency,
                            baseCode: baseCurrency?.code,
                            currenciesLoaded: currencies.length,
                            orgBaseCode,
                            orgCurrencyCount,
                            currentLoadErrors: loadErrors,
                        })
                        setCreateOpen(true)
                    }}
                    onSetBroker={() => setSetBrokerOpen(true)}
                    onEdit={(id) => setEditPolicyId(id)}
                    onUpdate={async (id, patch) => {
                        const r = await updateRatePolicy(id, patch)
                        if (!r.success) toast.error(r.error || 'Update failed')
                        await loadAll()
                    }}
                />
            )}

            {/* ───────────────── Rate History ───────────────── */}
            {tab === 'rates' && (
                <RateHistoryView
                    rates={rates}
                    policies={policies}
                    baseCurrency={baseCurrency}
                    /* Pass the OrgCurrency-derived gating so the Add Manual
                     * Rate button shows even when the finance.Currency mirror
                     * hasn't finished materializing. */
                    orgCurrencyCount={orgCurrencyCount}
                    orgBaseCode={orgBaseCode}
                    onAddManual={() => setManualRateOpen(true)}
                    onRefresh={loadAll}
                />
            )}

            {/* ───────────────── Revaluations ───────────────── */}
            {tab === 'revaluations' && (
                <RevaluationsView
                    periods={periods}
                    revals={revals}
                    selectedPeriod={selectedPeriod}
                    setSelectedPeriodId={setSelectedPeriodId}
                    onRefresh={loadAll}
                />
            )}

            {/* ── Drawer: edit a policy ── */}
            {editPolicy && (
                <PolicyDrawer policy={editPolicy} currencies={currencies}
                    onClose={() => setEditPolicyId(null)}
                    onSubmit={async (patch) => {
                        const r = await updateRatePolicy(editPolicy.id, patch)
                        if (!r.success) { toast.error(r.error || 'Update failed'); return }
                        toast.success('Saved')
                        setEditPolicyId(null)
                        await loadAll()
                    }} />
            )}

            {/* ── Drawer: create a policy. NOT gated on `baseCurrency` —
                 the drawer falls back to currencies.find(c => c.is_base)
                 internally and self-heals via `onRefresh` if the mirror was
                 briefly empty when the user clicked. */}
            {createOpen && (
                <PolicyDrawer
                    policy={null}
                    base={baseCurrency}
                    currencies={currencies}
                    existingPairs={new Set(policies.map(p => `${p.from_currency}-${p.to_currency}-${p.rate_type}`))}
                    onRefresh={loadAll}
                    onClose={() => setCreateOpen(false)}
                    onSubmit={async (payload) => {
                        const r = await createRatePolicy(payload as any)
                        if (!r.success) { toast.error(r.error || 'Create failed'); return }
                        toast.success('Policy created')
                        setCreateOpen(false)
                        await loadAll()
                    }} />
            )}

            {/* ── Modal: set broker for many ── */}
            {setBrokerOpen && (
                <SetBrokerModal
                    policies={policies}
                    currencies={currencies}
                    onClose={() => setSetBrokerOpen(false)}
                    onApplied={async () => { setSetBrokerOpen(false); await loadAll() }}
                />
            )}

            {/* ── Modal: add a manual rate. Not gated on `baseCurrency` —
                 the modal renders even when the mirror is briefly empty
                 and resolves the base from `currencies` internally. */}
            {manualRateOpen && (
                <ManualRateModal
                    base={baseCurrency}
                    currencies={currencies}
                    onRefresh={loadAll}
                    onClose={async () => {
                        // Reload on close — fires after either single MID
                        // or three-side submissions complete. Avoids a
                        // round-trip per row when entering all three sides.
                        setManualRateOpen(false)
                        await loadAll()
                    }}
                    onSubmit={async (payload) => {
                        const r = await createExchangeRate(payload)
                        if (!r.success) { throw new Error(r.error || 'Failed'); }
                        toast.success(`Rate ${payload.rate_side ?? 'MID'} added`)
                        // Note: NOT calling loadAll() here — happens on modal close.
                    }}
                />
            )}
        </div>
    )
}
