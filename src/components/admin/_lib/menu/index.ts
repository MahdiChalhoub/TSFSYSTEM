import type { MenuItem } from './types';
import {
    dashboard,
    usersAccess,
    systemSettings,
    importMigration,
    marketplace,
    platformDashboard,
    aiAgents,
    delivery,
    setupWizard,
} from './core';
import { financeProduction, financeMain } from './finance';
import { commercial } from './commercial';
import { inventory, products } from './inventory';
import { crm, clientPortal, supplierPortal } from './crm';
import { ecommerce, store } from './ecommerce';
import { hr } from './hr';
import { workspace } from './workspace';
import { saasControl } from './saas';

export type { MenuItem } from './types';

// Order preserved from the original monolithic MENU_ITEMS array in Sidebar.tsx.
export const MENU_ITEMS: MenuItem[] = [
    dashboard,
    financeProduction,
    commercial,
    inventory,
    financeMain,
    crm,
    ecommerce,
    hr,
    workspace,
    clientPortal,
    supplierPortal,
    importMigration,
    saasControl,
    usersAccess,
    systemSettings,
    products,
    marketplace,
    store,
    platformDashboard,
    aiAgents,
    delivery,
    setupWizard,
];
