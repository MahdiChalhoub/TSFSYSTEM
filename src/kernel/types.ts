/**
 * Kernel: Shared Type Definitions
 * 
 * Types used across the Kernel layer for module management,
 * authentication, and tenant resolution.
 */

/** Module manifest schema — loaded from each module's manifest.json */
export interface ModuleManifest {
    /** Unique module identifier, matches backend SaaSModule.code */
    code: string;
    /** Human-readable module name */
    name: string;
    /** Semantic version string */
    version: string;
    /** Short description of what the module does */
    description: string;
    /** Module category for isolation rules */
    category: 'first-party' | 'third-party';
    /** Rendering isolation mode */
    isolation: 'shared' | 'iframe';
    /** Lucide icon name for sidebar/UI */
    icon: string;
    /** Route patterns this module owns */
    routes: string[];
    /** Permission keys this module requires */
    permissions: string[];
    /** Module codes this module depends on */
    dependencies: string[];
    /** Backend Django app path (e.g. "apps.finance") */
    backendApp: string;
}

/** Module status from the backend API */
export type ModuleStatus = 'INSTALLED' | 'DISABLED' | 'UNINSTALLED';

/** Combined module info: manifest + runtime status */
export interface KernelModuleInfo {
    manifest: ModuleManifest;
    status: ModuleStatus;
    is_core: boolean;
}

/** Authenticated user shape from /api/auth/me/ */
export interface KernelUser {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    is_superuser: boolean;
    role?: string;
    organization?: {
        id: number;
        name: string;
        slug: string;
    };
}

/** Tenant context shape */
export interface TenantContext {
    tenant: string;
    slug: string;
    orgId: number | null;
    orgName: string | null;
}
