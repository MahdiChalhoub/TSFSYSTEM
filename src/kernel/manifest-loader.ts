/**
 * Kernel: Module Manifest Loader
 * 
 * Loads and validates manifest.json files from src/modules/[code]/manifest.json.
 * Uses a static import map since Next.js doesn't support dynamic fs reads at runtime.
 * 
 * When adding a new module, add its manifest import to the MANIFEST_MAP below.
 */

import type { ModuleManifest } from './types';

// ─── Static Manifest Imports ──────────────────────────────────────────
// Each module's manifest is imported statically for bundler compatibility.
// Add new modules here when they are created.

import financeManifest from '@/modules/finance/manifest.json';
import inventoryManifest from '@/modules/inventory/manifest.json';
import productsManifest from '@/modules/products/manifest.json';
import crmManifest from '@/modules/crm/manifest.json';
import hrManifest from '@/modules/hr/manifest.json';
import purchasesManifest from '@/modules/purchases/manifest.json';
import salesManifest from '@/modules/sales/manifest.json';

/** Map of all known module manifests by code */
const MANIFEST_MAP: Record<string, ModuleManifest> = {
    finance: financeManifest as ModuleManifest,
    inventory: inventoryManifest as ModuleManifest,
    products: productsManifest as ModuleManifest,
    crm: crmManifest as ModuleManifest,
    hr: hrManifest as ModuleManifest,
    purchases: purchasesManifest as ModuleManifest,
    sales: salesManifest as ModuleManifest,
};

/**
 * Load all module manifests
 */
export function loadAllManifests(): ModuleManifest[] {
    return Object.values(MANIFEST_MAP);
}

/**
 * Load a single module's manifest by code
 */
export function loadManifest(code: string): ModuleManifest | null {
    return MANIFEST_MAP[code] || null;
}

/**
 * Get all registered module codes
 */
export function getRegisteredModuleCodes(): string[] {
    return Object.keys(MANIFEST_MAP);
}

/**
 * Check if a module has a registered manifest
 */
export function hasManifest(code: string): boolean {
    return code in MANIFEST_MAP;
}
