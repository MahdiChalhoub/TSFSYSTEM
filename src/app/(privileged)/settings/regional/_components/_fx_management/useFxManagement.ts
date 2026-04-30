'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    getCurrencies, getExchangeRates, getRevaluations,
    runRevaluation,
    getRatePolicies, updateRatePolicy, syncRatePolicy, syncAllRatePolicies,
    deleteRatePolicy, bulkCreateRatePolicies,
    type Currency, type ExchangeRate, type CurrencyRevaluation, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { erpFetch } from '@/lib/erp-api'
import type { FxView, FiscalYear } from './constants'

/** All state, memos, and handlers for the FxManagementSection.
 *  Extracted into a hook so the orchestrator file stays slim and the
 *  shape of the original (single useFxManagement().X access) is
 *  byte-equivalent at every consumer call site. */
export function useFxManagement(view: FxView | undefined) {
    const isEmbedded = !!view;
    const [tabState, setTab] = useState<FxView>('rates');
    const tab = view ?? tabState;
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [revals, setRevals] = useState<CurrencyRevaluation[]>([])
    const [policies, setPolicies] = useState<CurrencyRatePolicy[]>([])
    const [years, setYears] = useState<FiscalYear[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState<number | null>(null)
    const [syncingId, setSyncingId] = useState<number | null>(null)
    const [syncingAll, setSyncingAll] = useState(false)
    // Sync-All progress for the per-row spinner.
    const [syncAllProgress, setSyncAllProgress] = useState<{ done: number; total: number } | null>(null)
    const [bulkBusy, setBulkBusy] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    // Set-broker dialog state. Closed by default; opened from a button next
    // to "Auto-configure". Scope drives whether the codes list applies as
    // include / exclude or is ignored ("all").
    const [setBrokerOpen, setSetBrokerOpen] = useState(false)
    const [setBrokerProvider, setSetBrokerProvider] = useState<CurrencyRatePolicy['provider']>('FRANKFURTER')
    const [setBrokerScope, setSetBrokerScope] = useState<'all' | 'include' | 'exclude'>('all')
    const [setBrokerCodes, setSetBrokerCodes] = useState<string[]>([])
    const [setBrokerKey, setSetBrokerKey] = useState('')   // optional API key for paid providers
    const [setBrokerBusy, setSetBrokerBusy] = useState(false)
    // Inline-edit state: which row's multiplier/markup is being edited.
    const [editingPolicy, setEditingPolicy] = useState<{ id: number; multiplier: string; markup_pct: string } | null>(null)
    const [savingEdit, setSavingEdit] = useState(false)

    // Quick-add forms
    const [newRateOpen, setNewRateOpen] = useState(false)
    const [newPolicyOpen, setNewPolicyOpen] = useState(false)
    // Policies table filters — text + health pill + provider pill.
    const [policyQuery, setPolicyQuery] = useState('')
    const [policyHealthFilter, setPolicyHealthFilter] = useState<'all' | 'fresh' | 'stale' | 'fail' | 'never' | 'manual'>('all')
    const [policyProviderFilter, setPolicyProviderFilter] = useState<'all' | CurrencyRatePolicy['provider']>('all')
    // "Open as soon as the mirror materializes" — clicked while finance.Currency
    // hasn't synced yet. The useEffect below flips newPolicyOpen=true once
    // baseCurrency becomes available, so the click feels instant.
    const [pendingNewPolicy, setPendingNewPolicy] = useState(false)
    const [pendingNewRate, setPendingNewRate] = useState(false)

    useEffect(() => { void loadAll() }, [])

    async function loadAll() {
        setLoading(true)
        try {
            const [cs, rs, vs, ps, ys] = await Promise.all([
                getCurrencies(),
                getExchangeRates(),
                getRevaluations(),
                getRatePolicies(),
                erpFetch('fiscal-years/').then((r: any) => Array.isArray(r) ? r : (r?.results ?? [])),
            ])
            setCurrencies(cs)
            setRates(rs)
            setRevals(vs)
            setPolicies(ps)
            setYears(ys)
        } catch (e) {
            toast.error(`Failed to load: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setLoading(false)
        }
    }

    const baseCurrency = useMemo(() => currencies.find(c => c.is_base), [currencies])

    // Open the New Policy / New Rate form as soon as the mirror has produced
    // a baseCurrency. Without this the button felt broken: click → silent
    // toast → nothing happens because the form requires `base: Currency`.
    useEffect(() => {
        if (pendingNewPolicy && baseCurrency) {
            setNewPolicyOpen(true)
            setPendingNewPolicy(false)
        }
        if (pendingNewRate && baseCurrency) {
            setNewRateOpen(true)
            setPendingNewRate(false)
        }
    }, [pendingNewPolicy, pendingNewRate, baseCurrency])

    const periods = useMemo(() => years.flatMap(y => (y.periods ?? []).map(p => ({ ...p, fiscal_year_name: y.name }))), [years])

    // Group rates by from→to for tidier display
    const ratesByPair = useMemo(() => {
        const m = new Map<string, ExchangeRate[]>()
        rates.forEach(r => {
            const k = `${r.from_code}→${r.to_code}`
            const arr = m.get(k) ?? []
            arr.push(r)
            m.set(k, arr)
        })
        return Array.from(m.entries()).map(([k, list]) => ({
            pair: k,
            list: list.sort((a, b) => b.effective_date.localeCompare(a.effective_date)),
        }))
    }, [rates])

    /** Latest rate per (from_code, to_code, rate_type) — used to surface the
     *  actual stored rate on the policies row, so the operator doesn't have
     *  to cross-reference the Rate History tab to see what got synced. */
    const latestRateByKey = useMemo(() => {
        const m = new Map<string, ExchangeRate>()
        for (const r of rates) {
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const prev = m.get(k)
            if (!prev || r.effective_date > prev.effective_date) m.set(k, r)
        }
        return m
    }, [rates])

    async function handleRunRevaluation(periodId: number) {
        setRunning(periodId)
        try {
            const res = await runRevaluation({ fiscalPeriodId: periodId, scope: 'OFFICIAL' })
            if (!res.success) {
                toast.error(res.error || 'Revaluation failed')
                return
            }
            if (res.data === null) {
                toast.info(res.detail || 'No foreign-currency activity to revalue')
                return
            }
            const r = res.data!
            const sign = Number(r.net_impact) >= 0 ? '+' : ''
            toast.success(`Revaluation posted: net impact ${sign}${r.net_impact} (${r.accounts_processed} account${r.accounts_processed === 1 ? '' : 's'})`)
            await loadAll()
            setTab('revaluations')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
        } finally {
            setRunning(null)
        }
    }

    async function handleSyncPolicy(id: number) {
        setSyncingId(id)
        try {
            const res = await syncRatePolicy(id)
            if (res.success) toast.success(res.message || 'Sync OK')
            else toast.error(res.message || res.error || 'Sync failed')
            await loadAll()
        } finally {
            setSyncingId(null)
        }
    }

    async function handleSyncAll() {
        setSyncingAll(true)
        // The backend processes serially; we don't yet stream progress. To avoid
        // a misleading "0/N" placeholder, show the total only and flip to a final
        // count when the response lands.
        const eligible = policies.filter(p => p.provider !== 'MANUAL').length
        setSyncAllProgress({ done: 0, total: eligible })
        try {
            const res = await syncAllRatePolicies()
            if (!res.success) { toast.error(res.error || 'Sync-all failed'); return }
            const ok = (res.results ?? []).filter(r => r.ok).length
            const fail = (res.results ?? []).filter(r => !r.ok).length
            toast.success(`Synced ${ok} policy${ok === 1 ? '' : 'ies'}${fail > 0 ? `, ${fail} failed` : ''}`)
            await loadAll()
        } finally {
            setSyncingAll(false)
            setSyncAllProgress(null)
        }
    }

    async function handleDeletePolicy(p: CurrencyRatePolicy) {
        if (!confirm(`Delete the auto-sync policy for ${p.from_code} → ${p.to_code}? Existing rate history is kept; only the policy goes away.`)) return
        setDeletingId(p.id)
        try {
            const res = await deleteRatePolicy(p.id)
            if (!res.success) { toast.error(res.error || 'Delete failed'); return }
            toast.success(`Removed ${p.from_code} → ${p.to_code} policy`)
            await loadAll()
        } finally {
            setDeletingId(null)
        }
    }

    async function handleBulkCreate() {
        setBulkBusy(true)
        try {
            const res = await bulkCreateRatePolicies({
                provider: 'ECB', rate_type: 'SPOT', auto_sync: true,
            })
            if (!res.success) { toast.error(res.error || 'Bulk create failed'); return }
            const made = res.created?.length ?? 0
            const skipped = res.skipped?.length ?? 0
            if (made === 0 && skipped > 0) {
                toast.info('Every active currency already has a policy.')
            } else {
                toast.success(`Created ${made} polic${made === 1 ? 'y' : 'ies'}${skipped ? ` · skipped ${skipped} existing` : ''}`)
            }
            await loadAll()
        } finally {
            setBulkBusy(false)
        }
    }

    async function commitInlineEdit() {
        if (!editingPolicy) return
        const mul = Number(editingPolicy.multiplier)
        const mk = Number(editingPolicy.markup_pct)
        if (!isFinite(mul) || mul <= 0) { toast.error('Multiplier must be a positive number'); return }
        if (!isFinite(mk) || mk < -50 || mk > 50) { toast.error('Markup % must be between -50 and 50'); return }
        setSavingEdit(true)
        try {
            const r = await updateRatePolicy(editingPolicy.id, {
                multiplier: editingPolicy.multiplier,
                markup_pct: editingPolicy.markup_pct,
            })
            if (!r.success) { toast.error(r.error || 'Update failed'); return }
            setEditingPolicy(null)
            await loadAll()
        } finally {
            setSavingEdit(false)
        }
    }

    return {
        isEmbedded, tab, setTab,
        currencies, rates, revals, policies, years, loading,
        running, syncingId, syncingAll, syncAllProgress, bulkBusy, deletingId,
        setBrokerOpen, setSetBrokerOpen,
        setBrokerProvider, setSetBrokerProvider,
        setBrokerScope, setSetBrokerScope,
        setBrokerCodes, setSetBrokerCodes,
        setBrokerKey, setSetBrokerKey,
        setBrokerBusy, setSetBrokerBusy,
        editingPolicy, setEditingPolicy, savingEdit,
        newRateOpen, setNewRateOpen,
        newPolicyOpen, setNewPolicyOpen,
        policyQuery, setPolicyQuery,
        policyHealthFilter, setPolicyHealthFilter,
        policyProviderFilter, setPolicyProviderFilter,
        setPendingNewPolicy, setPendingNewRate,
        loadAll, baseCurrency, periods, ratesByPair, latestRateByKey,
        handleRunRevaluation, handleSyncPolicy, handleSyncAll,
        handleDeletePolicy, handleBulkCreate, commitInlineEdit,
    }
}
