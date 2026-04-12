'use server';

import { erpFetch } from '@/lib/erp-api';

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SERVER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadMigrationFile(formData: FormData) {
    const res = await erpFetch('migration/jobs/upload/', {
        method: 'POST',
        body: formData,
    });
    return res;
}

export async function connectDirectDB(params: {
    name: string;
    db_host: string;
    db_port: number;
    db_name: string;
    db_user: string;
    db_password: string;
}) {
    const res = await erpFetch('migration/jobs/connect/', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    return res;
}

export async function getMigrationJobs() {
    const res = await erpFetch('migration/jobs/');
    return res;
}

export async function getMigrationJobDetail(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/`);
    return res;
}

export async function getBusinesses(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/businesses/`);
    return res;
}

export async function previewMigration(jobId: number, businessId?: number) {
    let url = `migration/jobs/${jobId}/preview/`;
    if (businessId) url += `?business_id=${businessId}`;
    const res = await erpFetch(url);
    return res;
}

export async function startMigration(
    jobId: number,
    params?: { source_business_id?: number; source_business_name?: string; migration_mode?: string }
) {
    const res = await erpFetch(`migration/jobs/${jobId}/start/`, {
        method: 'POST',
        body: params ? JSON.stringify(params) : undefined,
    });
    return res;
}

export async function getMigrationLogs(jobId: number, entityType?: string) {
    let url = `migration/jobs/${jobId}/logs/`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await erpFetch(url);
    return res;
}

export async function rollbackMigration(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/rollback/`, {
        method: 'POST',
    });
    return res;
}

export async function getAllMigrationRecords(params?: unknown) {
    return await erpFetch('migration/records/');
}
export async function getAuditSummary(jobId?: number) {
    return await erpFetch(jobId ? `migration/jobs/${jobId}/audit/` : 'migration/audit/');
}
export async function bulkLinkLedger(data: unknown) {
    return await erpFetch('migration/records/bulk-link/', { method: 'POST', body: JSON.stringify(data) });
}
export async function approveMigrationEntity(entityId: number) {
    return await erpFetch(`migration/records/${entityId}/approve/`, { method: 'POST' });
}
export async function repostMigrationJournals(data: unknown) {
    return await erpFetch('migration/records/repost-journals/', { method: 'POST', body: JSON.stringify(data) });
}
