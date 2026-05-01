import type { ComponentType } from 'react';

/**
 * Lucide / heroicons / custom-svg components are passed by reference; we don't
 * need to enumerate every variant — `ComponentType` covers them all.
 */
export type MenuItem = {
    title: string;
    icon?: ComponentType<{ size?: number | string; className?: string;[key: string]: unknown }>;
    path?: string;
    module?: string;
    stage?: string;
    visibility?: string;
    children?: MenuItem[];
};
