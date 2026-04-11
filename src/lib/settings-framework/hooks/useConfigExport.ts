'use client';
import { useCallback } from 'react';

export function useConfigExport<T extends Record<string, any>>(config: T | null, configName: string) {
    const exportJSON = useCallback(() => {
        if (!config) return;
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${configName}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [config, configName]);

    const importJSON = useCallback((file: File): Promise<Partial<T>> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target?.result as string));
                } catch { reject(new Error('Invalid JSON')); }
            };
            reader.readAsText(file);
        });
    }, []);

    const copyToClipboard = useCallback(async () => {
        if (!config) return false;
        try {
            await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
            return true;
        } catch { return false; }
    }, [config]);

    const shareURL = useCallback(() => {
        if (!config) return '';
        const encoded = btoa(JSON.stringify(config));
        return `${window.location.origin}${window.location.pathname}?config=${encoded}`;
    }, [config]);

    return { exportJSON, importJSON, copyToClipboard, shareURL };
}
