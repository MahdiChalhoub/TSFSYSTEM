/**
 * Engine: Module Registry Abstraction
 * 
 * Re-exports the dynamic module registration system.
 * Modules should use Engine.modules instead of importing module-registry directly.
 */
export {
    MODULE_REGISTRY,
    registerModule,
    getActiveWidgets,
    getActiveSettingsPanels,
    getActiveLandingComponents,
    getActiveRecentActivity
} from '@/lib/module-registry';
export type { ModuleDefinition } from '@/lib/module-registry';
