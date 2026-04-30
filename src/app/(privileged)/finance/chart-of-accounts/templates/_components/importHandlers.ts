'use client'

import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { toast } from 'sonner'

type ActiveView = 'gallery' | 'compare' | 'migration' | 'execution'

/** After import — always go to posting rules to confirm/configure */
export const afterImport = (templateName: string) => {
    toast.success(`Imported ${templateName} — configure posting rules`)
    window.location.href = '/finance/settings/posting-rules?from=coa-import'
}

export type ImportHandlersDeps = {
    setCoaStatus: (s: any) => void
    setImportTarget: (k: string | null) => void
    setReplaceTarget: (k: string | null) => void
    setMigrationTarget: (t: { from: string; to: string } | null) => void
    setMigrationPreview: (p: import('@/app/actions/finance/coa-templates').MigrationPreview | null) => void
    setActiveView: (v: ActiveView) => void
    setIsPending: (b: boolean) => void
}

export function makeHandleImport(deps: ImportHandlersDeps) {
    return async (key: string) => {
        /**
         * 3 import cases:
         *   EMPTY          — no COA exists → direct import (confirm dialog)
         *   UNTOUCHED      — COA exists but no txns/balances/custom accounts
         *                    → safe to delete & replace (confirm dialog)
         *   NEEDS_MIGRATION — COA has txns/balances/custom accounts
         *                    → full migration flow required (always)
         */
        try {
            const { getCOAStatus, getMigrationPreview } = await import('@/app/actions/finance/coa-templates')
            const status = await getCOAStatus()
            deps.setCoaStatus(status)

            const importCase = status.import_case || (status.account_count === 0 ? 'EMPTY' : status.has_data ? 'NEEDS_MIGRATION' : 'UNTOUCHED')

            if (importCase === 'EMPTY') {
                // Case 1: No COA → direct import
                deps.setImportTarget(key)
                return
            }

            if (importCase === 'UNTOUCHED') {
                // Case 2: COA exists but untouched → replace confirmation
                if (status.current_template === key) {
                    // Re-importing same template → simple confirm
                    deps.setImportTarget(key)
                } else {
                    // Different template, but safe to replace
                    deps.setReplaceTarget(key)
                }
                return
            }

            // Case 3: NEEDS_MIGRATION — always go through migration flow
            // Even for same-template re-import: custom sub-accounts (employees,
            // contacts, bank accounts) would be deactivated by a blind reset.
            deps.setMigrationTarget({ from: status.current_template || key, to: key })
            deps.setIsPending(true)
            toast.info(`Loading migration data...`)
            const preview = await getMigrationPreview(key)
            deps.setMigrationPreview(preview)
            deps.setActiveView('execution')
            deps.setIsPending(false)
            if (preview) {
                toast.info(`Migration: ${preview.summary.with_balance} accounts with balance, ${preview.summary.custom_accounts} custom accounts`, {
                    description: `${status.journal_entry_count} journal entries need remapping`,
                })
            }
        } catch (e) {
            console.error('[COA] Status check failed:', e)
            toast.error('Failed to check COA status. Please try again.')
        }
    }
}

/** Case 1: empty COA (new user) — direct import */
export function makeHandleConfirmImport(
    importTarget: string | null,
    setImportTarget: (k: string | null) => void,
    setIsPending: (b: boolean) => void,
) {
    return async () => {
        if (!importTarget) return
        const key = importTarget
        setImportTarget(null)
        setIsPending(true)
        try {
            await importChartOfAccountsTemplate(key as any, { reset: true })
            afterImport(key.replace(/_/g, ' '))
        } catch (e: unknown) {
            toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsPending(false)
        }
    }
}

/** Case 2: Replace untouched COA with new template */
export function makeHandleConfirmReplace(
    replaceTarget: string | null,
    setReplaceTarget: (k: string | null) => void,
    setIsPending: (b: boolean) => void,
) {
    return async () => {
        if (!replaceTarget) return
        const key = replaceTarget
        setReplaceTarget(null)
        setIsPending(true)
        try {
            await importChartOfAccountsTemplate(key as any, { reset: true })
            afterImport(key.replace(/_/g, ' '))
        } catch (e: unknown) {
            toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsPending(false)
        }
    }
}
