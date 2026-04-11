'use client';
import { useState, useEffect, useCallback } from 'react';

export function useAutoSaveDraft<T>(
    key: string,
    data: T | null,
    hasChanges: boolean,
    intervalMs: number = 30000
) {
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

    // Auto-save on interval
    useEffect(() => {
        if (!data || !hasChanges) return;
        const timer = setInterval(() => {
            localStorage.setItem(key, JSON.stringify(data));
            setDraftSavedAt(new Date().toLocaleTimeString());
        }, intervalMs);
        return () => clearInterval(timer);
    }, [data, hasChanges, key, intervalMs]);

    // Restore draft
    const restoreDraft = useCallback((): T | null => {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                setDraftSavedAt('restored');
                return JSON.parse(raw);
            }
        } catch {}
        return null;
    }, [key]);

    // Clear draft
    const clearDraft = useCallback(() => {
        localStorage.removeItem(key);
        setDraftSavedAt(null);
    }, [key]);

    // Save immediately
    const saveNow = useCallback(() => {
        if (!data) return;
        localStorage.setItem(key, JSON.stringify(data));
        setDraftSavedAt(new Date().toLocaleTimeString());
    }, [key, data]);

    return { draftSavedAt, restoreDraft, clearDraft, saveNow };
}
