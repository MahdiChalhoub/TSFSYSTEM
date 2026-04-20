import type { ReactNode } from 'react'
import type { ClosePreview, YearSummary, YearHistoryEvent, DraftAuditEntry } from '@/app/actions/finance/fiscal-year'
import type { WizardFormData } from '../_components/WizardModal'

/** Single KPI definition for the filter strip. */
export interface KpiItem {
    label: string
    value: number
    color: string
    icon: ReactNode
    filterKey: string | null
}

/** Aggregate stats for all fiscal years. */
export interface FiscalYearStats {
    total: number
    totalPeriods: number
    openPeriods: number
    closedPeriods: number
    futurePeriods: number
    lockedYears: number
}

/** Return type of the useFiscalYears hook. */
export interface UseFiscalYearsReturn {
    // State
    years: Record<string, any>[]
    filteredYears: Record<string, any>[]
    expandedYear: number | null
    setExpandedYear: (id: number | null) => void
    focusMode: boolean
    setFocusMode: (fn: (prev: boolean) => boolean) => void
    searchQuery: string
    setSearchQuery: (q: string) => void
    statusFilter: string | null
    setStatusFilter: (f: string | null) => void
    isPending: boolean

    // KPIs + stats
    stats: FiscalYearStats
    kpis: KpiItem[]

    // Wizard
    showWizard: boolean
    wizardData: WizardFormData
    setWizardData: React.Dispatch<React.SetStateAction<WizardFormData>>
    openWizard: () => void
    handleCreateYear: (e: React.FormEvent) => void

    // Period actions
    handlePeriodStatus: (periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE', yearData?: Record<string, any>) => void
    handlePeriodAction: (periodId: number, action: 'close' | 'softLock' | 'hardLock' | 'reopen', periodName: string) => void

    // Period editing
    editingPeriod: Record<string, any> | null
    setEditingPeriod: (p: Record<string, any> | null) => void

    // Confirm dialog
    pendingAction: { type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; yearId?: number } | null
    setPendingAction: (a: { type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; yearId?: number } | null) => void
    confirmAction: () => void

    // Year tabs (summary / history)
    yearTab: Record<number, 'periods' | 'summary' | 'history'>
    setYearTab: React.Dispatch<React.SetStateAction<Record<number, 'periods' | 'summary' | 'history'>>>
    summaryCache: Record<number, YearSummary>
    historyCache: Record<number, { events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] }>
    loadSummary: (yearId: number) => void
    loadHistory: (yearId: number) => void

    // Year-end close
    closeStep: 'preview' | 'result' | null
    closePreview: ClosePreview | null
    closeResult: string | null
    closeConfirmText: string
    setCloseConfirmText: (t: string) => void
    closingYearId: number | null
    closeYearEndModal: () => void
    startYearEndClose: (yearId: number) => void
    executeYearEndClose: (isPartial: boolean) => void

    // Draft audit
    draftAudit: { drafts: DraftAuditEntry[]; total: number; periodName: string } | null
    setDraftAudit: (d: { drafts: DraftAuditEntry[]; total: number; periodName: string } | null) => void

    // Refresh
    refreshData: () => Promise<void>
}
