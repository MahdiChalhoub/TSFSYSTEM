/**
 * API Client stub for the packages module.
 * This wraps standard fetch with convenience methods.
 */
export const apiClient = {
    async get(path: string): Promise<any> {
        const res = await fetch(path);
        return res.json();
    },
    async post(path: string, body?: any, options?: RequestInit): Promise<any> {
        const res = await fetch(path, {
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body),
            headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
            ...options,
        });
        return res.json();
    },
    async delete(path: string): Promise<any> {
        const res = await fetch(path, { method: 'DELETE' });
        return res.json();
    },
};
