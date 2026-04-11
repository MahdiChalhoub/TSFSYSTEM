'use client';
import { useCallback, useMemo } from 'react';

export type UserRole = 'admin' | 'editor' | 'viewer';

export function useRBAC(
    userRole: UserRole,
    fieldPermissions: Record<string, UserRole[]>
) {
    const canEdit = useCallback((field: string): boolean => {
        const allowed = fieldPermissions[field];
        if (!allowed) return userRole !== 'viewer';
        return allowed.includes(userRole);
    }, [userRole, fieldPermissions]);

    const canView = useCallback((field: string): boolean => {
        // Viewers can always view, just not edit
        return true;
    }, []);

    const isRestricted = useCallback((field: string): boolean => {
        return !canEdit(field);
    }, [canEdit]);

    const editableFields = useMemo(() => {
        return Object.keys(fieldPermissions).filter(f => canEdit(f));
    }, [fieldPermissions, canEdit]);

    const restrictedFields = useMemo(() => {
        return Object.keys(fieldPermissions).filter(f => !canEdit(f));
    }, [fieldPermissions, canEdit]);

    return { canEdit, canView, isRestricted, editableFields, restrictedFields, userRole };
}
