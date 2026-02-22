/**
 * Module Route Map
 * 
 * Central registry of which URL path prefixes belong to which module.
 * Used by the dev-mode middleware guard to determine which routes
 * belong to the currently active development module.
 * 
 * To add a new module: simply add its code + route prefix below.
 * The dev-module.sh script auto-discovers modules from src/modules/,
 * but this map controls which URL paths are gated.
 */

export const MODULE_ROUTES: Record<string, string[]> = {
    inventory: ['/inventory'],
    finance: ['/finance'],
    sales: ['/sales'],
    purchases: ['/purchases'],
    crm: ['/crm'],
    hr: ['/hr'],
    products: ['/products'],
    ecommerce: ['/ecommerce'],
    storage: ['/storage'],
    migration: ['/migration'],
};

/** Routes that are always accessible regardless of active dev module */
export const ALWAYS_ALLOWED_ROUTES = [
    '/dashboard',
    '/settings',
    '/login',
    '/register',
    '/saas',
    '/workspace',
    '/users',
    '/landing',
    '/tenant',
    '/supplier-portal',
    '/api',
    '/_next',
];

/**
 * Check if a pathname belongs to the specified module.
 */
export function isRouteForModule(pathname: string, moduleCode: string): boolean {
    const routes = MODULE_ROUTES[moduleCode];
    if (!routes) return false;
    return routes.some(prefix => pathname.startsWith(prefix));
}

/**
 * Check if a pathname is always allowed (core/shared routes).
 */
export function isAlwaysAllowedRoute(pathname: string): boolean {
    if (pathname === '/') return true;
    return ALWAYS_ALLOWED_ROUTES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Get the module code that owns a pathname, or null if none.
 */
export function getModuleForRoute(pathname: string): string | null {
    for (const [code, routes] of Object.entries(MODULE_ROUTES)) {
        if (routes.some(prefix => pathname.startsWith(prefix))) {
            return code;
        }
    }
    return null;
}
