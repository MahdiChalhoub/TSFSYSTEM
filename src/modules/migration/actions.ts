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
    try {
        const res = await erpFetch(`migration/jobs/${jobId}/start/`, {
            method: 'POST',
            body: params ? JSON.stringify(params) : undefined,
        });
        return res;
    } catch (error: any) {
        console.error(`[MIGRATION_ACTION] Start failed for job ${jobId}:`, error);
        return {
            success: false,
            error: error.message || 'Failed to start migration. Please check if analysis is complete.'
        };
    }
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

export async function getMigrationPipeline(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/pipeline/`);
    return res;
}

export async function resumeMigration(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/resume/`, {
        method: 'POST',
    });
    return res;
}

export async function getMigrationReview(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/review/`);
    return res;
}

export async function approveMigrationEntity(jobId: number, entityType: string) {
    const res = await erpFetch(`migration/jobs/${jobId}/review/`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: entityType, action: 'approve' }),
    });
    return res;
}

export async function getMigrationSamples(jobId: number, entityType: string) {
    const res = await erpFetch(`migration/jobs/${jobId}/samples/?entity_type=${entityType}`);
    return res;
}

export async function linkMigrationFile(params: { file_uuid: string; name: string }) {
    const res = await erpFetch('migration/jobs/link/', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    return res;
}

export async function getAccountMapping(jobId: number) {
    const res = await erpFetch(`migration/jobs/${jobId}/account-mapping/`);
    return res;
}

export async function saveAccountMapping(jobId: number, mappings: { target_id: number; coa_id: number }[]) {
    const res = await erpFetch(`migration/jobs/${jobId}/account-mapping/`, {
        method: 'POST',
        body: JSON.stringify({ mappings }),
    });
    return res;
}
