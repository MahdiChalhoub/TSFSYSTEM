'use client';
import { useState, useCallback } from 'react';

export function useConfigHistory<T = any>(fetchFn: () => Promise<{ history: T[] }>) {
    const [history, setHistory] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFn();
            setHistory(data.history || []);
        } catch (e) {
            console.error('Failed to fetch config history', e);
        } finally {
            setLoading(false);
        }
    }, [fetchFn]);

    const open = useCallback(async () => {
        await refresh();
        setShowHistory(true);
    }, [refresh]);

    return { history, loading, refresh, showHistory, setShowHistory, open };
}
