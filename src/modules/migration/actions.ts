'use server';

import { erpFetch } from '@/lib/erp-api';

// ─────────────────────────────────────────────────────────────────────────────
// SAFE WRAPPER — prevents uncaught throws from crossing the RSC wire
// ─────────────────────────────────────────────────────────────────────────────

function safeMsg(e: unknown): string {
    try {
        const msg = (e as any)?.message || String(e) || 'Unknown error'
        // Unwrap JSON-encoded error messages from erpFetch
        const parsed = JSON.parse(msg)
        return parsed?.error || parsed?.detail || msg
    } catch { return (e as any)?.message || String(e) || 'Unknown error' }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SERVER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadMigrationFile(formData: FormData) {
    try {
        return await erpFetch('migration/jobs/upload/', { method: 'POST', body: formData })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function connectDirectDB(params: {
    name: string; db_host: string; db_port: number;
    db_name: string; db_user: string; db_password: string;
}) {
    try {
        return await erpFetch('migration/jobs/connect/', { method: 'POST', body: JSON.stringify(params) })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function getMigrationJobs() {
    try {
        return await erpFetch('migration/jobs/')
    } catch (e) { return { results: [], error: safeMsg(e) } }
}

export async function getMigrationJobDetail(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/`)
    } catch (e) { return { error: safeMsg(e) } }
}

export async function getBusinesses(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/businesses/`)
    } catch (e) { return { businesses: [], error: safeMsg(e) } }
}

export async function previewMigration(jobId: number, businessId?: number) {
    try {
        let url = `migration/jobs/${jobId}/preview/`
        if (businessId) url += `?business_id=${businessId}`
        return await erpFetch(url)
    } catch (e) { return { error: safeMsg(e) } }
}

export async function startMigration(
    jobId: number,
    params?: { source_business_id?: number; source_business_name?: string; migration_mode?: string }
) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/start/`, {
            method: 'POST',
            body: params ? JSON.stringify(params) : undefined,
        })
    } catch (e) {
        return { success: false, error: safeMsg(e) }
    }
}

export async function getMigrationLogs(jobId: number, entityType?: string) {
    try {
        let url = `migration/jobs/${jobId}/logs/`
        if (entityType) url += `?entity_type=${entityType}`
        return await erpFetch(url)
    } catch (e) { return { results: [], error: safeMsg(e) } }
}

export async function rollbackMigration(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/rollback/`, { method: 'POST' })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function getMigrationPipeline(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/pipeline/`)
    } catch (e) { return { pipeline: null, error: safeMsg(e) } }
}

export async function resumeMigration(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/resume/`, { method: 'POST' })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function getMigrationReview(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/review/`)
    } catch (e) { return { error: safeMsg(e) } }
}

export async function approveMigrationEntity(jobId: number, entityType: string) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/review/`, {
            method: 'POST',
            body: JSON.stringify({ entity_type: entityType, action: 'approve' }),
        })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function getMigrationSamples(jobId: number, entityType: string) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/samples/?entity_type=${entityType}`)
    } catch (e) { return { results: [], error: safeMsg(e) } }
}

export async function getAllMigrationRecords(jobId: number, entityType: string, page: number = 1, pageSize: number = 50) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/all-records/?entity_type=${entityType}&page=${page}&page_size=${pageSize}`)
    } catch (e) { return { results: [], count: 0, error: safeMsg(e) } }
}

export async function getAuditSummary(jobId: number, entityType: string) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/audit-summary/?entity_type=${entityType}`)
    } catch (e) { return { error: safeMsg(e) } }
}

export async function bulkLinkLedger(jobId: number, contactType: string) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/bulk-link-ledger/`, {
            method: 'POST',
            body: JSON.stringify({ contact_type: contactType }),
        })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function linkMigrationFile(params: { file_uuid: string; name: string }) {
    try {
        return await erpFetch('migration/jobs/link/', { method: 'POST', body: JSON.stringify(params) })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function getAccountMapping(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/account-mapping/`)
    } catch (e) { return { mappings: [], error: safeMsg(e) } }
}

export async function saveAccountMapping(jobId: number, mappings: { target_id: number; coa_id: number }[]) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/account-mapping/`, {
            method: 'POST',
            body: JSON.stringify({ mappings }),
        })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function deleteMigrationJob(jobId: number, force = false) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/delete-job/${force ? '?force=true' : ''}`, { method: 'DELETE' })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}

export async function repostMigrationJournals(jobId: number) {
    try {
        return await erpFetch(`migration/jobs/${jobId}/repost-journals/`, { method: 'POST' })
    } catch (e) { return { success: false, error: safeMsg(e) } }
}
