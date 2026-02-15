/**
 * Kernel: Authentication Layer
 * 
 * Wraps existing auth server actions into a clean Kernel API.
 * This module provides Kernel-level auth without duplicating logic.
 * 
 * Usage:
 *   import { Kernel } from '@/kernel'
 *   const user = await Kernel.auth.getUser()
 *   const isAuth = await Kernel.auth.isAuthenticated()
 */

import { getUser, logoutAction } from '@/app/actions/auth';
import type { KernelUser } from './types';

/** Get the currently authenticated user, or null if not logged in */
export async function getCurrentUser(): Promise<KernelUser | null> {
    try {
        const user = await getUser();
        return user as KernelUser | null;
    } catch {
        return null;
    }
}

/** Check if the current request has a valid auth session */
export async function isAuthenticated(): Promise<boolean> {
    const user = await getCurrentUser();
    return user !== null;
}

/** Log out the current user and redirect to login */
export async function logout(): Promise<void> {
    await logoutAction();
}

/** Check if the current user has a specific permission */
export async function hasPermission(permission: string): Promise<boolean> {
    const user = await getCurrentUser();
    if (!user) return false;
    // Superusers have all permissions
    if (user.is_superuser) return true;
    // Delegate to the RBAC permission system
    const { hasPermission: checkPerm } = await import('./permissions');
    return checkPerm(permission, user);
}

