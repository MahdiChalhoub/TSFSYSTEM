/**
 * Blanc Kernel — Unified Entry Point
 * 
 * The Kernel is the second layer of the 4-tier architecture stack:
 *   Engine → Kernel → Core → Modules
 * 
 * It provides the system's central intelligence:
 * - auth:    Authentication & authorization
 * - tenant:  Multi-tenant context resolution
 * - modules: App lifecycle management (install, enable, disable)
 * 
 * Usage:
 *   import { Kernel } from '@/kernel'
 *   
 *   const user = await Kernel.auth.getUser()
 *   const ctx  = await Kernel.tenant.getContext()
 *   const mods = await Kernel.modules.getAll()
 *   await Kernel.modules.enable('finance')
 */

import * as auth from './auth';
import * as tenant from './tenant';
import * as modules from './modules';
import * as permissions from './permissions';

export const Kernel = {
    auth,
    tenant,
    modules,
    permissions,
} as const;

// Named re-exports for tree-shaking
export * as KernelAuth from './auth';
export * as KernelTenant from './tenant';
export * as KernelModules from './modules';
export * as KernelPermissions from './permissions';

// Type re-exports
export type {
    ModuleManifest,
    ModuleStatus,
    KernelModuleInfo,
    KernelUser,
    TenantContext,
} from './types';
