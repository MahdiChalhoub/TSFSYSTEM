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
 */
export const getDynamicBranding = () => {
    if (typeof window === 'undefined') return { suffix: PLATFORM_CONFIG.suffix, domain: PLATFORM_CONFIG.domain };

    const host = window.location.host;
    const isLocal = host.includes('localhost');

    return {
        suffix: isLocal ? '.localhost' : PLATFORM_CONFIG.suffix,
        domain: isLocal ? 'localhost:3000' : PLATFORM_CONFIG.domain,
        isLocal
    };
};
