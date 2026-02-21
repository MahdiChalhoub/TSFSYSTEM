import { erpFetch } from "./erp-api";

/**
 * apiClient - Minimal axios-like wrapper around erpFetch
 * Provides compatibility for older modules using .get(), .post(), etc.
 */
export const apiClient = {
    async get(url: string, config: any = {}) {
        const response = await erpFetch(url, { method: 'GET', ...config });
        const data = await response.json();
        return { data };
    },
    async post(url: string, body: any = null, config: any = {}) {
        const isFormData = body instanceof FormData;
        const response = await erpFetch(url, {
            method: 'POST',
            body: isFormData ? body : JSON.stringify(body),
            headers: isFormData ? {} : { 'Content-Type': 'application/json' },
            ...config
        });
        const data = await response.json();
        return { data };
    },
    async put(url: string, body: any = null, config: any = {}) {
        const response = await erpFetch(url, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
            ...config
        });
        const data = await response.json();
        return { data };
    },
    async delete(url: string, config: any = {}) {
        const response = await erpFetch(url, { method: 'DELETE', ...config });
        const data = await response.json();
        return { data };
    }
};
