/**
 * Engine: Configuration Abstraction
 * 
 * Re-exports the canonical platform configuration from @/lib/saas_config.
 * Modules should use Engine.config instead of importing saas_config directly.
 */
export {
    PLATFORM_CONFIG,
    getDynamicBranding,
    useDynamicBranding
} from '@/lib/saas_config';
