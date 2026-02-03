import React from 'react';
import { ShoppingCart, Package, DollarSign, Users } from 'lucide-react';

// Type definition for a Module's Frontend Presence
export type ModuleDefinition = {
    code: string;
    name: string;
    description?: string;
    dashboardWidgets?: React.ComponentType<{ data: any }>[];
    recentActivity?: React.ComponentType<{ data: any }>;
    settingsPanel?: React.ComponentType;
    // [FUTURE] Support for modular landing page sections
    landingComponents?: React.ComponentType[];
}

import { InventoryStatsWidget } from '@/components/modules/inventory/InventoryWidgets';
import InventorySettingsPanel from '@/components/modules/inventory/InventorySettings';
import StorefrontFeatured from '@/components/modules/inventory/StorefrontFeatured';
import { SalesStatsWidget, SalesRecentActivity } from '@/components/modules/sales/SalesWidgets';
import BusinessSettings from '@/components/modules/core/BusinessSettings';

// The Central Registry
// In a real plugin system, this would be populated dynamically.
// For now, we import all known modules and conditionally render them.
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
    'core': {
        code: 'core',
        name: 'Platform Core',
        settingsPanel: BusinessSettings
    },
    'inventory': {
        code: 'inventory',
        name: 'Inventory Management',
        dashboardWidgets: [InventoryStatsWidget],
        settingsPanel: InventorySettingsPanel,
        landingComponents: [StorefrontFeatured]
    },
    'sales': { // or 'pos' depending on module code
        code: 'sales',
        name: 'Sales & POS',
        dashboardWidgets: [SalesStatsWidget],
        recentActivity: SalesRecentActivity
    }
};

export function registerModule(def: ModuleDefinition) {
    MODULE_REGISTRY[def.code] = def;
}

// Helper to get active widgets based on installed modules
export function getActiveWidgets(installedModuleCodes: string[]) {
    const widgets: React.ComponentType<{ data: any }>[] = [];

    // Always include Core widgets if any
    if (MODULE_REGISTRY['core']?.dashboardWidgets) {
        widgets.push(...MODULE_REGISTRY['core'].dashboardWidgets);
    }

    installedModuleCodes.forEach(code => {
        // Handle alias: 'pos' module might correspond to 'sales' widget set
        let lookupCode = code;
        if (code === 'pos') lookupCode = 'sales';

        const mod = MODULE_REGISTRY[lookupCode];
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
    // We only support one recent activity widget for now (Sales), but designed for list
    // In future this could return a merged list or multiple components
    for (const code of installedModuleCodes) {
        const mod = MODULE_REGISTRY[code];
        if (mod && mod.recentActivity) {
            return mod.recentActivity;
        }
    }
    return null;
}
