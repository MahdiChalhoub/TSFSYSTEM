export const PLATFORM_CONFIG = {
    name: "TSF System",
    tagline: "The Unified Business Orchestration Engine",
    federation_name: "TSF Platform",
    domain: "tsf.ci",
    suffix: ".tsf.ci",
    version: "2.9.2-AG-260225.0211",
    support_email: "support@tsf.ci"
};

/**
 * Centrally manages dynamic suffix and domain detection for white-labeling.
 * Shared logic usable on both Server and Client.
 * @param host Optional host override
 */
export const getDynamicBranding = (host?: string) => {
    // If no host provided and we are on the server, use default config
    if (!host && typeof window === 'undefined') {
        return { suffix: PLATFORM_CONFIG.suffix, domain: PLATFORM_CONFIG.domain, isLocal: false };
    }

    // Use window host if on client and no host provided
    const currentHost = host || (typeof window !== 'undefined' ? window.location.host : PLATFORM_CONFIG.domain);
    const isLocal = currentHost.includes('localhost');

    let dynamicSuffix = PLATFORM_CONFIG.suffix;
    if (!isLocal) {
        const hostWithoutPort = currentHost.split(':')[0];
        const parts = hostWithoutPort.split('.');
        if (parts.length >= 2) {
            dynamicSuffix = '.' + parts.slice(1).join('.');
        }
    }

    return {
        suffix: isLocal ? '.localhost' : dynamicSuffix,
        domain: isLocal ? 'localhost:3000' : currentHost,
        isLocal
    };
};
