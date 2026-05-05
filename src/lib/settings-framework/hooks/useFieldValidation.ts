'use client';
import { useCallback, useMemo } from 'react';

export type FieldStatus = 'ok' | 'warn' | 'error';
export type ValidationRule = (value: any) => FieldStatus;

export function useFieldValidation(rules: Record<string, ValidationRule>) {
    const getStatus = useCallback((field: string, value: any): FieldStatus | null => {
        const fn = rules[field];
        return fn ? fn(value) : null;
    }, [rules]);

    const getStatusColor = useCallback((status: FieldStatus | null): string | null => {
        if (!status) return null;
        return { ok: 'bg-app-success', warn: 'bg-app-warning', error: 'bg-app-error' }[status];
    }, []);

    const getStatusLabel = useCallback((status: FieldStatus | null): string | null => {
        if (!status) return null;
        return { ok: 'Valid', warn: 'Warning', error: 'Invalid' }[status];
    }, []);

    return { getStatus, getStatusColor, getStatusLabel };
}
