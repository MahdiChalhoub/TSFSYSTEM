/**
 * Kernel: Module Lifecycle Manager
 * 
 * Provides the formal app lifecycle API for the Kernel layer.
 * Wraps server actions and combines with manifest data.
 * 
 * Usage:
 *   import { Kernel } from '@/kernel'
 *   const modules = await Kernel.modules.getAll()
 *   await Kernel.modules.enable('finance')
 *   await Kernel.modules.disable('hr')
 *   const manifest = Kernel.modules.getManifest('finance')
 */

import {
    getModules as fetchModules,
    enableModule as serverEnableModule,
    disableModule as serverDisableModule,
    type ModuleInfo
} from '@/app/actions/modules';
import { loadAllManifests, loadManifest } from './manifest-loader';
import type { ModuleManifest, ModuleStatus, KernelModuleInfo } from './types';

/**
 * Get all modules with combined manifest + runtime status
 */
export async function getAll(): Promise<KernelModuleInfo[]> {
    const [serverModules, manifests] = await Promise.all([
        fetchModules(),
        loadAllManifests()
    ]);

    // Build a map of server module info by code
    const serverMap = new Map<string, ModuleInfo>();
    serverModules.forEach((m: ModuleInfo) => serverMap.set(m.code, m));

    // Combine manifest data with server status
    const result: KernelModuleInfo[] = [];

    for (const manifest of manifests) {
        const serverInfo = serverMap.get(manifest.code);
        result.push({
            manifest,
            status: (serverInfo?.status as ModuleStatus) || 'UNINSTALLED',
            is_core: serverInfo?.is_core ?? false,
        });
    }

    // Include server modules that don't have a frontend manifest (backend-only modules)
    for (const [code, info] of serverMap) {
        if (!manifests.find((m: ModuleManifest) => m.code === code)) {
            result.push({
                manifest: {
                    code: info.code,
                    name: info.name,
                    version: info.version,
                    description: info.description,
                    category: 'first-party',
                    isolation: 'shared',
                    icon: 'Package',
                    routes: [],
                    permissions: [],
                    dependencies: info.dependencies,
                    backendApp: '',
                },
                status: info.status,
                is_core: info.is_core,
            });
        }
    }

    return result;
}

/**
 * Enable a module by its code
 */
export async function enable(code: string): Promise<{ message?: string; error?: string }> {
    return await serverEnableModule(code);
}

/**
 * Disable a module by its code
 */
export async function disable(code: string): Promise<{ message?: string; error?: string }> {
    return await serverDisableModule(code);
}

/**
 * Get a single module's manifest
 */
export function getManifest(code: string): ModuleManifest | null {
    return loadManifest(code);
}

/**
 * Get the runtime status of a module from the backend
 */
export async function getStatus(code: string): Promise<ModuleStatus> {
    const modules = await fetchModules();
    const mod = modules.find(m => m.code === code);
    return (mod?.status as ModuleStatus) || 'UNINSTALLED';
}

/**
 * Check if a module is currently enabled/installed
 */
export async function isEnabled(code: string): Promise<boolean> {
    const status = await getStatus(code);
    return status === 'INSTALLED';
}
