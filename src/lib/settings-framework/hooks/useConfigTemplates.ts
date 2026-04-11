'use client';
import { useState, useCallback, useEffect } from 'react';

export interface ConfigTemplate<T = any> {
    name: string;
    data: T;
    createdAt: string;
}

export function useConfigTemplates<T>(storageKey: string) {
    const [templates, setTemplates] = useState<ConfigTemplate<T>[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) setTemplates(JSON.parse(raw));
        } catch {}
    }, [storageKey]);

    const persist = useCallback((next: ConfigTemplate<T>[]) => {
        setTemplates(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
    }, [storageKey]);

    const save = useCallback((name: string, data: T) => {
        const entry: ConfigTemplate<T> = { name, data, createdAt: new Date().toISOString() };
        persist([...templates.filter(t => t.name !== name), entry]);
    }, [templates, persist]);

    const load = useCallback((name: string): T | null => {
        return templates.find(t => t.name === name)?.data ?? null;
    }, [templates]);

    const remove = useCallback((name: string) => {
        persist(templates.filter(t => t.name !== name));
    }, [templates, persist]);

    const rename = useCallback((oldName: string, newName: string) => {
        persist(templates.map(t => t.name === oldName ? { ...t, name: newName } : t));
    }, [templates, persist]);

    return { templates, save, load, remove, rename };
}
