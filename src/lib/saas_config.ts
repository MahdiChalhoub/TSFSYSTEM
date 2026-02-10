'use client';

import { useState, useEffect } from 'react';
import { getDynamicBranding, PLATFORM_CONFIG } from './branding';

export { PLATFORM_CONFIG, getDynamicBranding };

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

