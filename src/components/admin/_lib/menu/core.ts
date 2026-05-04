import {
    LayoutDashboard,
    ShoppingBag,
    UserCheck,
    Settings,
    Cloud,
    Shield,
    Bell,
    CreditCard,
    Network,
    Bot,
    Truck,
    Wrench,
    GitBranch,
    ClipboardList,
} from 'lucide-react';
import type { MenuItem } from './types';

export const dashboard: MenuItem = {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    module: 'core',
};

export const usersAccessInProgress: MenuItem = {
    title: 'Users & Access',
    icon: UserCheck,
    module: 'core',
    stage: 'in-progress',
    children: [
        { title: 'All Users', path: '/access/users', icon: UserCheck },
        { title: 'Access Roles', path: '/access/roles', icon: Shield },
    ],
};

export const usersAccess: MenuItem = {
    title: 'Users & Access',
    icon: UserCheck,
    module: 'core',
    children: [
        { title: 'Users', path: '/users' },
        { title: 'Client Access', path: '/access/client-access' },
        { title: 'Supplier Access', path: '/access/supplier-access' },
        { title: 'Supplier Dashboard', path: '/access/supplier-dashboard' },
        { title: 'Approvals', path: '/approvals' },
        { title: 'Access Approvals', path: '/access/approvals' },
    ],
};

export const systemSettings: MenuItem = {
    title: 'System Settings',
    icon: Settings,
    module: 'core',
    children: [
        { title: 'Cloud Storage', path: '/storage', icon: Cloud },
        { title: 'Storage Files', path: '/storage/files' },
        { title: 'Storage Packages', path: '/storage/packages' },
        { title: 'Roles & Permissions', path: '/settings/roles' },
        { title: 'Security Settings', path: '/settings/security', icon: Shield },
        { title: 'Audit Trail', path: '/settings/audit-trail', icon: ClipboardList, stage: 'in-progress' },
        { title: 'Notifications', path: '/settings/notifications', icon: Bell },
        { title: 'Billing & Subscription', path: '/subscription', icon: CreditCard },
        { title: 'Appearance', path: '/settings/appearance' },
        { title: 'Domains', path: '/settings/domains' },
        { title: 'E-Invoicing Monitor', path: '/settings/e-invoicing' },
        { title: 'E-Invoicing Live Monitor', path: '/settings/e-invoicing/monitor' },
        { title: 'Features', path: '/settings/features' },
        { title: 'Payment Terms', path: '/settings/payment-terms' },
        { title: 'POS Settings', path: '/settings/pos-settings', stage: 'in-progress' },
        { title: 'Procurement Recovery', path: '/settings/procurement-recovery', stage: 'in-progress' },
        { title: 'Purchase Analytics', path: '/settings/purchase-analytics', stage: 'in-progress' },
        { title: 'Regional Settings', path: '/settings/regional', stage: 'in-progress' },
        { title: 'Sequences', path: '/settings/sequences', stage: 'in-progress' },
        { title: 'WhatsApp', path: '/settings/whatsapp' },
        { title: 'Print Branding', path: '/settings/print-branding', stage: 'in-progress' },
        {
            title: 'Integrations',
            icon: Network,
            children: [
                { title: 'Webhooks', path: '/integrations/webhooks' },
            ],
        },
    ],
};

export const importMigration: MenuItem = {
    title: 'Import & Migration',
    icon: GitBranch,
    children: [
        { title: 'Migration Overview', path: '/migration' },
        { title: 'Migration Audit', path: '/migration/audit' },
        { title: 'Migration Jobs', path: '/migration/jobs' },
        { title: 'Migration v2', path: '/migration_v2' },
        { title: 'Migration v2 Jobs', path: '/migration_v2/jobs' },
    ],
};

export const marketplace: MenuItem = {
    title: 'Marketplace',
    icon: ShoppingBag,
    path: '/marketplace',
    module: 'core',
};

export const platformDashboard: MenuItem = {
    title: 'Platform Dashboard',
    icon: LayoutDashboard,
    path: '/platform-dashboard',
    module: 'core',
};

export const aiAgents: MenuItem = {
    title: 'AI Agents',
    icon: Bot,
    path: '/agents',
    module: 'core',
};

export const delivery: MenuItem = {
    title: 'Delivery',
    icon: Truck,
    path: '/delivery',
    module: 'core',
};

export const setupWizard: MenuItem = {
    title: 'Setup Wizard',
    icon: Wrench,
    path: '/setup-wizard',
    module: 'core',
};
