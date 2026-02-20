'use server';

import { erpFetch } from '@/lib/erp-api';

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE SERVER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a file to cloud storage.
 */
export async function uploadFile(formData: FormData) {
    const res = await erpFetch('storage/files/upload/', {
        method: 'POST',
        body: formData,
    });
    return res;
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
    return await erpFetch(`storage/files/${uuid}/`, {
        method: 'DELETE',
    });
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
export async function updateStorageProvider(data: {
    provider_type?: string;
    endpoint_url?: string;
    bucket_name?: string;
    access_key?: string;
    secret_key?: string;
    region?: string;
    path_prefix?: string;
    max_file_size_mb?: number;
    allowed_extensions?: string[];
    is_active?: boolean;
}) {
    return await erpFetch('storage/provider/', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/**
 * Test the storage provider connection.
 */
export async function testStorageConnection() {
    return await erpFetch('storage/provider/test/', {
        method: 'POST',
    });
}
