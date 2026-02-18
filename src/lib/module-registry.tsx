import React from 'react';

// Type definition for a Module's Frontend Presence
export type ModuleDefinition = {
    code: string;
    name: string;
    description?: string;
    dashboardWidgets?: React.ComponentType<{ data: Record<string, any> }>[];
    recentActivity?: React.ComponentType<{ data: Record<string, any> }>;
    settingsPanel?: React.ComponentType;
    // [FUTURE] Support for modular landing page sections
    landingComponents?: React.ComponentType[];
}

import BusinessSettings from '@/components/modules/core/BusinessSettings';

/**
 * THE CENTRAL REGISTRY (Kernel Shell)
 * In the engine-stable branch, this registry is empty of business modules.
 * Business modules are registered dynamically when their packages are installed.
 */
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
    'core': {
        code: 'core',
        name: 'Platform Core',
        settingsPanel: BusinessSettings
    }
};

export function registerModule(def: ModuleDefinition) {
    MODULE_REGISTRY[def.code] = def;
}

// Helper to get active widgets based on installed modules
export function getActiveWidgets(installedModuleCodes: string[]) {
    const widgets: React.ComponentType<{ data: Record<string, any> }>[] = [];

    // Always include Core widgets if any
    if (MODULE_REGISTRY['core']?.dashboardWidgets) {
        widgets.push(...MODULE_REGISTRY['core'].dashboardWidgets);
    }

    installedModuleCodes.forEach(code => {
        const mod = MODULE_REGISTRY[code];
        if (mod && mod.dashboardWidgets) {
            widgets.push(...mod.dashboardWidgets);
        }
    });

    return widgets;
}

// Helper to get active settings panels
export function getActiveSettingsPanels(installedModuleCodes: string[]) {
    const panels: React.ComponentType[] = [];

    installedModuleCodes.forEach(code => {
        const mod = MODULE_REGISTRY[code];
        if (mod && mod.settingsPanel) {
            panels.push(mod.settingsPanel);
        }
    });

    return panels;
}

// Helper to get active landing page components
export function getActiveLandingComponents(installedModuleCodes: string[]) {
    const components: React.ComponentType[] = [];

    installedModuleCodes.forEach(code => {
        const mod = MODULE_REGISTRY[code];
        if (mod && mod.landingComponents) {
            components.push(...mod.landingComponents);
        }
    });

    return components;
}

// Helper to get active recent activity widgets
export function getActiveRecentActivity(installedModuleCodes: string[]) {
    for (const code of installedModuleCodes) {
        const mod = MODULE_REGISTRY[code];
        if (mod && mod.recentActivity) {
            return mod.recentActivity;
        }
    }
    return null;
}
