'use server'

import { revalidatePath } from 'next/cache'

/**
 * COA Templates — Database-Driven
 * All template data is stored in the database (COATemplate model).
 * Seeded via: python manage.py seed_coa_templates
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MapApprovalStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED'

export type MigrationMapPair = {
    source_key: string
    source_name: string
    target_key: string
    target_name: string
    mapping_count: number
}

export type MigrationMapping = {
    source_account_code: string
    target_account_code: string
    notes?: string
    match_level: 'ROLE' | 'CODE' | 'NAME' | 'TYPE_SUBTYPE' | 'MANUAL' | 'UNMAPPED'
    confidence_score: number
    status: MapApprovalStatus | 'AUTO_MATCHED' | 'MANUAL_REVIEW' | 'REJECTED'
    mapping_type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'NO_DIRECT_MATCH'
    is_manual_override?: boolean
    mapping_reason?: string
    group_key?: string
    allocation_percent?: number
}

export type QualityReport = {
    source_key: string
    target_key: string
    quality_score: number
    total_mappings: number
    coverage: {
        source_total: number
        source_mapped: number
        source_pct: number
        target_total: number
        target_covered: number
        target_pct: number
        unmapped_sources: string[]
        unmapped_targets: string[]
    }
    match_levels: Record<string, number>
    mapping_types: Record<string, number>
    confidence: {
        high: number
        medium: number
        low: number
        unmapped: number
        avg: number
    }
    critical_roles: {
        total: number
        mapped: number
        pct: number
        unmapped: Array<{ code: string; name: string; role: string }>
    }
    risk: {
        no_direct_match: number
        manual_review: number
        risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
    }
}

export type MigrationSession = {
    id: number
    source_key: string
    source_name: string
    target_key: string
    target_name: string
    migration_date: string | null
    status: 'DRAFT' | 'DRY_RUN' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | 'PARTIAL'
    version: number
    is_locked: boolean
    dry_run_report: Record<string, any> | null
    created_at: string
}

export type MigrationPlan = {
    id: number
    source_code: string
    source_name: string
    source_type: string
    target_code: string
    target_name: string
    migration_mode: 'RENAME_IN_PLACE' | 'REPOINT_AND_ARCHIVE' | 'MERGE_FORWARD' | 'SPLIT_BY_OPENING_ENTRY' | 'DELETE_UNUSED' | 'MANUAL_REVIEW'
    is_mode_overridden: boolean
    balance: number
    journal_lines: number
    posting_rules: number
    financial_accounts: number
    children: number
    historically_locked: boolean
    allocation_percent: number | null
    group_key: string | null
    is_executed: boolean
}

export type MigrationBlocker = {
    type: string
    severity: 'BLOCKER' | 'WARNING'
    message: string
    accounts?: string[]
    [key: string]: any
}

// ─── Existing: Template import & preview ────────────────────────────────────

export async function importChartOfAccountsTemplate(templateKey: string, options?: { reset?: boolean }) {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch('coa/apply_template/', {
            method: 'POST',
            body: JSON.stringify({
                template_key: templateKey,
                reset: options?.reset || false,
            }),
        })
        try { revalidatePath('/finance/chart-of-accounts') } catch { /* ignore */ }
        return { success: true }
    } catch (error) {
        console.error(`[COA_TEMPLATE] Import failed:`, error)
        throw error
    }
}

export async function getAllTemplates(): Promise<Record<string, any>> {
    const { erpFetch } = await import('@/lib/erp-api')
    const data = await erpFetch('coa/templates/')
    const result: Record<string, any> = {}
    for (const template of data) {
        result[template.key] = template.accounts
    }
    return result
}

export async function getTemplatePreview(templateKey: string) {
    const templates = await getAllTemplates()
    return templates[templateKey] || []
}

/** Basic balance migration (legacy mapper tool) */
export async function migrateBalances(data: { mappings: Record<string, any>[]; description: string }) {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('coa/migrate/', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    } catch (error) {
        console.error(`[COA_MIGRATE] Migration failed:`, error)
        throw error
    }
}

// ─── Migration Map Builder ────────────────────────────────────────────────────

/** List all template→template migration map pairs that have been built */
export async function getMigrationMapsList(): Promise<MigrationMapPair[]> {
    const { erpFetch } = await import('@/lib/erp-api')
    try {
        const data = await erpFetch('coa/db-templates/migration-maps/')
        return Array.isArray(data) ? data : []
    } catch (error) {
        console.error('[COA_MAP] getMigrationMapsList failed:', error)
        return []
    }
}

/** Fetch the full mapping rows for a specific template pair */
export async function getMigrationMap(
    sourceKey: string,
    targetKey: string,
): Promise<{
    source_key: string
    target_key: string
    source_name: string
    target_name: string
    mappings: MigrationMapping[]
    total: number
    quality: {
        mapped: number
        unmapped: number
        by_level: Record<string, number>
        coverage_pct: number
        critical_roles_total: number
        critical_roles_mapped: number
        critical_roles_coverage_pct: number
    }
}> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch(`coa/db-templates/migration-maps/${sourceKey}/${targetKey}/`)
}

/** Persist mapping rows for a template pair (upsert) */
export async function saveMigrationMap(data: {
    source_key: string
    target_key: string
    mappings: MigrationMapping[]
}): Promise<{ message: string; created: number; updated: number }> {
    const { erpFetch } = await import('@/lib/erp-api')
    const result = await erpFetch('coa/db-templates/migration-maps/save/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
    try { revalidatePath('/finance/chart-of-accounts') } catch { /* ignore */ }
    return result
}

/** Re-run server-side 4-level auto-matching for a template pair */
export async function rematchMigrationMap(
    sourceKey: string,
    targetKey: string,
): Promise<{ message: string; created: number; updated: number }> {
    const { erpFetch } = await import('@/lib/erp-api')
    const result = await erpFetch('coa/db-templates/migration-maps/rematch/', {
        method: 'POST',
        body: JSON.stringify({ source_key: sourceKey, target_key: targetKey }),
    })
    try { revalidatePath('/finance/chart-of-accounts') } catch { /* ignore */ }
    return result
}

/** Get quality KPI report for a template migration map */
export async function getMigrationMapQuality(
    sourceKey: string,
    targetKey: string,
): Promise<QualityReport> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch(
        `coa/db-templates/migration-maps/quality/?source_key=${encodeURIComponent(sourceKey)}&target_key=${encodeURIComponent(targetKey)}`,
    )
}

/** Bulk-set approval status on all rows of a map pair */
export async function setMigrationMapStatus(
    sourceKey: string,
    targetKey: string,
    newStatus: MapApprovalStatus,
): Promise<{ source_key: string; target_key: string; status: string; updated: number; message: string }> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch('coa/db-templates/migration-maps/set-status/', {
        method: 'POST',
        body: JSON.stringify({ source_key: sourceKey, target_key: targetKey, status: newStatus }),
    })
}

// ─── Migration Session Engine ────────────────────────────────────────────────

/**
 * Create a new DRAFT migration session.
 * Returns 409 data if an active session already exists for this org.
 */
export async function createMigrationSession(
    sourceKey: string,
    targetKey: string,
    migrationDate?: string,
): Promise<{ session_id: number; status: string; source_key: string; target_key: string; error?: string }> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch('coa/coa-migration/create-session/', {
        method: 'POST',
        body: JSON.stringify({
            source_template_key: sourceKey,
            target_template_key: targetKey,
            ...(migrationDate ? { migration_date: migrationDate } : {}),
        }),
    })
}

/**
 * Run dry-run analysis — populates all COAMigrationAccountPlan rows.
 * Sets session.status = 'DRY_RUN'.
 */
export async function runMigrationDryRun(
    sessionId: number,
): Promise<{ session_id: number; status: string; report: Record<string, any> }> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch('coa/coa-migration/dry-run/', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
    })
}

/** Fetch full session detail including all account plans */
export async function getMigrationSession(
    sessionId: number,
): Promise<{ session: MigrationSession; plans: MigrationPlan[]; total: number }> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch(`coa/coa-migration/session/${sessionId}/`)
}

/** Check pre-execution blockers and warnings for a session */
export async function getMigrationBlockers(
    sessionId: number,
): Promise<{
    session_id: number
    blocker_count: number
    warning_count: number
    blockers: MigrationBlocker[]
    can_proceed: boolean
}> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch(`coa/coa-migration/blockers/${sessionId}/`)
}

/**
 * Approve a DRY_RUN session for execution.
 * Runs blocker checks — throws if real blockers exist.
 */
export async function approveMigrationSession(
    sessionId: number,
): Promise<{ session_id: number; status: string; blockers?: MigrationBlocker[]; error?: string }> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch('coa/coa-migration/approve/', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
    })
}

/**
 * Execute an APPROVED migration session.
 * This is irreversible — freezes the org, remaps all accounts, releases lock.
 */
export async function executeMigrationSession(
    sessionId: number,
): Promise<{ session_id: number; status: string; report: Record<string, any>; error?: string }> {
    const { erpFetch } = await import('@/lib/erp-api')
    const result = await erpFetch('coa/coa-migration/execute/', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
    })
    try {
        revalidatePath('/finance/chart-of-accounts')
        revalidatePath('/finance/ledger')
    } catch { /* ignore */ }
    return result
}
