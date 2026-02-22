/**
 * Module Route Map
 * 
 * Central registry of which URL path prefixes belong to which module.
 * Used by the dev-mode middleware guard and sidebar to determine
 * which routes belong to the currently active development module.
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
    '/migration',
    '/storage',
    '/landing',
    '/tenant',
    '/supplier-portal',
];

/**
 * Check if a given pathname belongs to the specified module.
 */
export function isRouteForModule(pathname: string, moduleCode: string): boolean {
    const routes = MODULE_ROUTES[moduleCode];
    if (!routes) return false;
    return routes.some(prefix => pathname.startsWith(prefix));
}

/**
 * Check if a given pathname is always allowed (core/shared routes).
 */
export function isAlwaysAllowedRoute(pathname: string): boolean {
    return ALWAYS_ALLOWED_ROUTES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Get the module code that owns a given pathname, or null if none.
 */
export function getModuleForRoute(pathname: string): string | null {
    for (const [code, routes] of Object.entries(MODULE_ROUTES)) {
        if (routes.some(prefix => pathname.startsWith(prefix))) {
            return code;
        }
    }
    return null;
}
