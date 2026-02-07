/**
 * Engine: Storage Abstraction
 * 
 * Provides a unified API for local and session storage operations.
 * Modules should use Engine.storage instead of directly accessing window.localStorage.
 * This abstraction enables: server-side safety, key namespacing, and future migration to IndexedDB.
 */

const PREFIX = 'dajingo_';

function isClient(): boolean {
    return typeof window !== 'undefined';
}

export const storage = {
    get<T = string>(key: string, fallback?: T): T | null {
        if (!isClient()) return fallback ?? null;
        try {
            const raw = localStorage.getItem(`${PREFIX}${key}`);
            if (raw === null) return fallback ?? null;
            return JSON.parse(raw) as T;
        } catch {
            return localStorage.getItem(`${PREFIX}${key}`) as unknown as T ?? fallback ?? null;
        }
    },

    set(key: string, value: unknown): void {
        if (!isClient()) return;
        localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    },

    remove(key: string): void {
        if (!isClient()) return;
        localStorage.removeItem(`${PREFIX}${key}`);
    },

    session: {
        get<T = string>(key: string, fallback?: T): T | null {
            if (!isClient()) return fallback ?? null;
            try {
                const raw = sessionStorage.getItem(`${PREFIX}${key}`);
                if (raw === null) return fallback ?? null;
                return JSON.parse(raw) as T;
            } catch {
                return sessionStorage.getItem(`${PREFIX}${key}`) as unknown as T ?? fallback ?? null;
            }
        },

        set(key: string, value: unknown): void {
            if (!isClient()) return;
            sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
        },

        remove(key: string): void {
            if (!isClient()) return;
            sessionStorage.removeItem(`${PREFIX}${key}`);
        }
    }
};
