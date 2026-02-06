'use client';

import { useState, useEffect } from 'react';

export const PLATFORM_CONFIG = {
    name: "Enterprise ERP",
    tagline: "The Unified Business Orchestration Engine",
    federation_name: "Federation Network",
    domain: "localhost:3000",
    suffix: ".tsf-city.com", // Updated to match user environment while remaining configurable
    version: "2.8.0",
    support_email: "support@platform.com"
};

/**
 * Centrally manages dynamic suffix and domain detection for white-labeling.
 * @param host Optional host override (primarily for server components)
 */
export const getDynamicBranding = (host?: string) => {
    // If no host provided and we are on the server, use default config
    if (!host && typeof window === 'undefined') {
        return { suffix: PLATFORM_CONFIG.suffix, domain: PLATFORM_CONFIG.domain, isLocal: false };
    }

    // Use window host if on client and no host provided
    const currentHost = host || (typeof window !== 'undefined' ? window.location.host : PLATFORM_CONFIG.domain);
    const isLocal = currentHost.includes('localhost');

    // Dynamically extract suffix from the actual hostname
    // e.g., "powersport.tsf.ci" -> ".tsf.ci"
    // e.g., "subdomain.example.com" -> ".example.com"
    let dynamicSuffix = PLATFORM_CONFIG.suffix;
    if (!isLocal) {
        const hostWithoutPort = currentHost.split(':')[0]; // Remove port if any
        const parts = hostWithoutPort.split('.');
        if (parts.length >= 2) {
            // Extract everything after the first subdomain (tenant slug)
            // e.g., ["powersport", "tsf", "ci"] -> ".tsf.ci"
            dynamicSuffix = '.' + parts.slice(1).join('.');
        }
    }

    return {
        suffix: isLocal ? '.localhost' : dynamicSuffix,
        domain: isLocal ? 'localhost:3000' : currentHost,
        isLocal
    };
};

/**
 * Hydration-safe hook for client components.
 * Prevents "text content didn't match" errors by waiting for mount.
 */
export function useDynamicBranding() {
    const [branding, setBranding] = useState(() => getDynamicBranding()); // Initial sync call for server-passable defaults
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setBranding(getDynamicBranding());
    }, []);

    // During hydration (unmounted), we return the default config to match the server's initial render.
    // After mounting, we return the actual detected environment branding.
    if (!mounted) {
        return { suffix: PLATFORM_CONFIG.suffix, domain: PLATFORM_CONFIG.domain, isLocal: false };
    }

    return branding;
}
