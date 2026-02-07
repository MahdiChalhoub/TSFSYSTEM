/**
 * Engine: Network Abstraction
 * 
 * Re-exports the canonical HTTP client from @/lib/erp-api.
 * Modules should use Engine.network instead of direct fetch or erpFetch imports.
 * This layer acts as the single point of control for all API communication.
 */
export { erpFetch as fetch, getTenantContext, getUser } from '@/lib/erp-api';
export { erpFetch as serverFetch, erpGet, erpPost } from '@/lib/erp-fetch';
