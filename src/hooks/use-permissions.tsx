'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';

interface UserWithPermissions {
    id: number;
    username: string;
    permissions: string[];
    is_staff: boolean;
    is_superuser: boolean;
}

/**
 * Hook to get the current user's permissions.
 * Fetches from the /me endpoint and caches in localStorage.
 */
export function usePermissions(): { permissions: string[]; isAdmin: boolean; loading: boolean } {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Try to load from localStorage first
        const cached = localStorage.getItem('user_permissions');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setPermissions(parsed.permissions || []);
                setIsAdmin(parsed.isAdmin || false);
                setLoading(false);
            } catch (e) {
                console.error('Failed to parse cached permissions', e);
            }
        }

        // Fetch fresh data
        erpFetch('/auth/me/')
            .then((user: UserWithPermissions) => {
                const perms = user.permissions || [];
                const admin = user.is_staff || user.is_superuser;
                setPermissions(perms);
                setIsAdmin(admin);
                localStorage.setItem('user_permissions', JSON.stringify({ permissions: perms, isAdmin: admin }));
            })
            .catch((err: unknown) => {
                console.error('Failed to fetch permissions', err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return { permissions, isAdmin, loading };
}

/**
 * Hook to check if the current user has a specific permission.
 * 
 * Usage:
 * ```tsx
 * const canAddProduct = useHasPermission('inventory.add_product');
 * 
 * return (
 *   <>
 *     {canAddProduct && <Button onClick={handleAdd}>Add Product</Button>}
 *   </>
 * );
 * ```
 */
export function useHasPermission(permissionCode: string): boolean {
    const { permissions, isAdmin, loading } = usePermissions();

    // While loading, assume no permission (safe default)
    if (loading) return false;

    // Admins have all permissions
    if (isAdmin) return true;

    // Check if the permission is in the user's permissions array
    return permissions.includes(permissionCode);
}

/**
 * Type-safe permission codes.
 * These should match the permission codes defined in module manifest.json files.
 */
export const PERMISSIONS = {
    // Inventory Module
    INVENTORY: {
        VIEW_PRODUCTS: 'inventory.view_products',
        ADD_PRODUCT: 'inventory.add_product',
        EDIT_PRODUCT: 'inventory.edit_product',
        DELETE_PRODUCT: 'inventory.delete_product',
        VIEW_STOCK: 'inventory.view_stock',
        ADJUST_STOCK: 'inventory.adjust_stock',
    },
    // Finance Module
    FINANCE: {
        VIEW_LEDGER: 'finance.view_ledger',
        CREATE_ENTRY: 'finance.create_entry',
        POST_ENTRY: 'finance.post_entry',
        VIEW_REPORTS: 'finance.view_reports',
    },
    // POS Module
    POS: {
        SELL: 'pos.sell',
        VOID_SALE: 'pos.void_sale',
        APPLY_DISCOUNT: 'pos.apply_discount',
        VIEW_SALES: 'pos.view_sales',
    },
    // Audit Module
    AUDIT: {
        VIEW_LOGS: 'audit.view_logs',
        MANAGE_WORKFLOWS: 'audit.manage_workflows',
        APPROVE_REQUESTS: 'audit.approve_requests',
        VIEW_TASKS: 'audit.view_tasks',
    },
} as const;
