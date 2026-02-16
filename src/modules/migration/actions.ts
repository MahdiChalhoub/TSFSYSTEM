'use server';

import { erpFetch } from '@/lib/erp-api';

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SERVER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadMigrationFile(formData: FormData) {
    const res = await erpFetch('/api/migration/jobs/upload/', {
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
    const res = await erpFetch('/api/migration/jobs/connect/', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    return res;
}

export async function getMigrationJobs() {
    const res = await erpFetch('/api/migration/jobs/');
    return res;
}

export async function getMigrationJobDetail(jobId: number) {
    const res = await erpFetch(`/api/migration/jobs/${jobId}/`);
    return res;
}

export async function previewMigration(jobId: number) {
    const res = await erpFetch(`/api/migration/jobs/${jobId}/preview/`);
    return res;
}

export async function startMigration(jobId: number) {
    const res = await erpFetch(`/api/migration/jobs/${jobId}/start/`, {
        method: 'POST',
    });
    return res;
}

export async function getMigrationLogs(jobId: number, entityType?: string) {
    let url = `/api/migration/jobs/${jobId}/logs/`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await erpFetch(url);
    return res;
}

export async function rollbackMigration(jobId: number) {
    const res = await erpFetch(`/api/migration/jobs/${jobId}/rollback/`, {
        method: 'POST',
    });
    return res;
}
