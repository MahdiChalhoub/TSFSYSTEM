/**
 * Kernel: Permission Guard
 * 
 * Route-level permission checking using module manifests and RBAC.
 * Verifies that a user has the required permissions for a module action.
 * 
 * Usage:
 *   import { requirePermission, canAccessModule } from '@/kernel/permissions'
 *   
 *   // In a server component or action:
 *   await requirePermission('write:journal')
 *   
 *   // Check module access:
 *   const canAccess = await canAccessModule('finance')
 */

import { getCurrentUser } from './auth';
import { getStatus } from './modules';
import { loadManifest } from './manifest-loader';
import type { KernelUser } from './types';

/**
 * Fetch the current user's permission codes from the backend.
 * Calls GET /api/users/my-permissions/ with the auth token.
 * Returns cached permissions for the lifetime of the request.
 */
let _cachedPermissions: string[] | null = null;

async function fetchUserPermissions(): Promise<string[]> {
    if (_cachedPermissions !== null) return _cachedPermissions;

    try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        const tenantId = cookieStore.get('tenant_id')?.value;

        if (!token) {
            _cachedPermissions = [];
            return [];
        }

        const backendUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
        const headers: Record<string, string> = {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
        };
        if (tenantId) headers['X-Tenant-Id'] = tenantId;

        const res = await fetch(`${backendUrl}/api/users/my-permissions/`, {
            headers,
            cache: 'no-store',
        });

        if (res.ok) {
            const data = await res.json();
            _cachedPermissions = data.permissions || [];
        } else {
            _cachedPermissions = [];
        }
    } catch {
        _cachedPermissions = [];
    }

    return _cachedPermissions as string[];
}

/**
 * Check if a user has a specific permission.
 * Checks role-based permission grants from the backend.
 */
export async function hasPermission(
    permission: string,
    user?: KernelUser | null
): Promise<boolean> {
    const currentUser = user ?? await getCurrentUser();
    if (!currentUser) return false;

    // Superusers bypass all permission checks
    if (currentUser.is_superuser) return true;

    // Fetch role-based permissions from backend
    const permissions = await fetchUserPermissions();
    return permissions.includes(permission);
}

/**
 * Check if the current user can access a specific module.
 * Verifies both: (1) the module is enabled, and (2) user has at least read access.
 */
export async function canAccessModule(moduleCode: string): Promise<boolean> {
    // Check if the module is enabled
    const status = await getStatus(moduleCode);
    if (status !== 'INSTALLED') return false;

    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) return false;

    // Superusers can access everything
    if (user.is_superuser) return true;

    // Check manifest for required permissions
    const manifest = loadManifest(moduleCode);
    if (!manifest) return true; // No manifest = no restrictions

    // Check if user has any permission for this module
    const permissions = await fetchUserPermissions();
    const modulePrefix = `${moduleCode}.`;
    return permissions.some(p => p.startsWith(modulePrefix));
}

/**
 * Server-side permission guard — throws redirect if not authorized.
 * Use in server components or server actions.
 */
export async function requirePermission(permission: string): Promise<void> {
    const allowed = await hasPermission(permission);
    if (!allowed) {
        throw new Error(`Permission denied: ${permission}`);
    }
}

/**
 * Server-side module access guard — throws redirect if module not accessible.
 */
export async function requireModuleAccess(moduleCode: string): Promise<void> {
    const allowed = await canAccessModule(moduleCode);
    if (!allowed) {
        throw new Error(`Module not accessible: ${moduleCode}`);
    }
}

/**
 * Get all permissions available to the current user based on their role.
 */
export async function getUserPermissions(): Promise<string[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    // Superusers get all permissions from all manifests
    if (user.is_superuser) {
        const { loadAllManifests } = await import('./manifest-loader');
        const manifests = loadAllManifests();
        return manifests.flatMap(m => m.permissions);
    }

    // Fetch actual role-based permissions from backend
    return fetchUserPermissions();
}
