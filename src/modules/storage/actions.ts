'use server';

import { erpFetch } from '@/lib/erp-api';

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE SERVER ACTIONS — Enhanced with chunked upload support
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a file to cloud storage (simple, for small files).
 */
export async function uploadFile(formData: FormData) {
    return await erpFetch('storage/files/upload/', {
        method: 'POST',
        body: formData,
    });
}

/**
 * List stored files with optional filters.
 */
export async function listFiles(params?: {
    category?: string;
    linked_model?: string;
    linked_id?: number;
}) {
    let url = 'storage/files/';
    const qp = new URLSearchParams();
    if (params?.category) qp.set('category', params.category);
    if (params?.linked_model) qp.set('linked_model', params.linked_model);
    if (params?.linked_id) qp.set('linked_id', String(params.linked_id));
    const qs = qp.toString();
    if (qs) url += `?${qs}`;
    return await erpFetch(url);
}

/**
 * Get a presigned download URL for a file.
 */
export async function getDownloadUrl(uuid: string) {
    return await erpFetch(`storage/files/${uuid}/download/`);
}

/**
 * Soft-delete a file.
 */
export async function deleteFile(uuid: string) {
    return await erpFetch(`storage/files/${uuid}/`, { method: 'DELETE' });
}

/**
 * Get the org's storage provider configuration.
 */
export async function getStorageProvider() {
    return await erpFetch('storage/provider/');
}

/**
 * Update the org's storage provider configuration.
 */
export async function updateStorageProvider(data: Record<string, unknown>) {
    return await erpFetch('storage/provider/', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/**
 * Test the storage provider connection.
 */
export async function testStorageConnection() {
    return await erpFetch('storage/provider/test/', { method: 'POST' });
}

// ── Chunked Upload Actions ───────────────────────────────────────────────────

/**
 * Initialize a chunked upload session.
 */
export async function initChunkedUpload(params: {
    filename: string;
    total_size: number;
    content_type?: string;
    checksum?: string;
    category?: string;
    linked_model?: string;
    linked_id?: number;
    upload_type?: 'file' | 'package';
    package_type?: 'kernel' | 'frontend' | 'module';
}) {
    return await erpFetch('storage/upload/init/', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

/**
 * Get upload session status (for resume).
 */
export async function getUploadStatus(sessionId: string) {
    return await erpFetch(`storage/upload/${sessionId}/status/`);
}

/**
 * Complete a chunked upload session.
 */
export async function completeChunkedUpload(sessionId: string) {
    return await erpFetch(`storage/upload/${sessionId}/complete/`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

/**
 * Get active (in-progress) upload sessions.
 */
export async function getActiveUploads(type?: 'file' | 'package') {
    const url = type ? `storage/upload/active/?type=${type}` : 'storage/upload/active/';
    return await erpFetch(url);
}

/**
 * Abort/Cancel a chunked upload session and delete temp data.
 */
export async function abortChunkedUpload(sessionId: string) {
    return await erpFetch(`storage/upload/${sessionId}/abort/`, {
        method: 'DELETE',
    });
}

// ── Package Actions ──────────────────────────────────────────────────────────

/**
 * List all packages with optional filters.
 */
export async function listPackages(params?: { type?: string; status?: string }) {
    let url = 'packages/';
    const qp = new URLSearchParams();
    if (params?.type) qp.set('type', params.type);
    if (params?.status) qp.set('status', params.status);
    const qs = qp.toString();
    if (qs) url += `?${qs}`;
    return await erpFetch(url);
}

/**
 * Upload a package (simple, for small packages).
 */
export async function uploadPackage(formData: FormData) {
    return await erpFetch('packages/upload/', {
        method: 'POST',
        body: formData,
    });
}

/**
 * Apply a package immediately.
 */
export async function applyPackage(packageId: string) {
    return await erpFetch(`packages/${packageId}/apply/`, { method: 'POST' });
}

/**
 * Schedule a package for deployment.
 */
export async function schedulePackage(packageId: string, scheduledFor: string) {
    return await erpFetch(`packages/${packageId}/schedule/`, {
        method: 'POST',
        body: JSON.stringify({ scheduled_for: scheduledFor }),
    });
}

/**
 * Rollback an applied package.
 */
export async function rollbackPackage(packageId: string) {
    return await erpFetch(`packages/${packageId}/rollback/`, { method: 'POST' });
}

/**
 * Get package deployment statistics.
 */
export async function getPackageStats() {
    return await erpFetch('packages/stats/');
}
