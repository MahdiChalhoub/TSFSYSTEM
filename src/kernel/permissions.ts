/**
 * Kernel: Permission Guard
 * 
 * Route-level permission checking using module manifests.
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
 * Check if a user has a specific permission.
 * Currently grants all permissions to superusers and staff.
 * When RBAC is fully implemented, this will check role-based grants.
 */
export async function hasPermission(
    permission: string,
    user?: KernelUser | null
): Promise<boolean> {
    const currentUser = user ?? await getCurrentUser();
    if (!currentUser) return false;

    // Superusers bypass all permission checks
    if (currentUser.is_superuser) return true;

    // Staff users have full access (until RBAC is implemented)
    if (currentUser.is_staff) return true;

    // TODO: When RBAC is implemented, check:
    // 1. User's role assignments
    // 2. Role's granted permissions
    // 3. Match against the requested permission

    return false;
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

    // For now, any authenticated user with staff status can access
    // TODO: Check specific manifest.permissions against user's role grants
    return user.is_staff;
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
 * Get all permissions available to the current user based on enabled modules.
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

    // TODO: Return permissions based on user's role assignments
    return [];
}
