'use client';
import { useMemo } from 'react';

export interface DiffEntry {
    field: string;
    oldVal: any;
    newVal: any;
    changed: boolean;
}

export function useConfigDiff<T extends Record<string, any>>(
    original: T | null,
    current: T | null,
    ignorePrefix: string = '_'
) {
    const diffEntries = useMemo<DiffEntry[]>(() => {
        if (!original || !current) return [];
        return Object.keys(current)
            .filter(k => !k.startsWith(ignorePrefix))
            .map(k => ({
                field: k,
                oldVal: original[k],
                newVal: current[k],
                changed: JSON.stringify(original[k]) !== JSON.stringify(current[k]),
            }))
            .filter(e => e.changed);
    }, [original, current, ignorePrefix]);

    return {
        diffEntries,
        diffCount: diffEntries.length,
        hasDiff: diffEntries.length > 0,
    };
}
