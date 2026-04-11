'use client';
import { useState, useCallback } from 'react';

export function useFieldLocking() {
    const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

    const toggleLock = useCallback((field: string) => {
        setLockedFields(prev => {
            const next = new Set(prev);
            next.has(field) ? next.delete(field) : next.add(field);
            return next;
        });
    }, []);

    const isLocked = useCallback((field: string) => lockedFields.has(field), [lockedFields]);

    const lockAll = useCallback((fields: string[]) => {
        setLockedFields(new Set(fields));
    }, []);

    const unlockAll = useCallback(() => {
        setLockedFields(new Set());
    }, []);

    return { lockedFields, toggleLock, isLocked, lockAll, unlockAll };
}
