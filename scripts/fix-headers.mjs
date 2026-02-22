#!/usr/bin/env node
/**
 * Batch header fix script — replaces legacy text-2xl headers with the 
 * standard text-4xl font-black icon badge pattern from DESIGN_CRITERIA.md
 */
import fs from 'fs';
import path from 'path';

// Map of file -> { icon, iconImport, title, accentWord, accent, subtitle }
const FIXES = {
    // === FINANCE ===
    'finance/accounts/page.tsx': { icon: 'Wallet', title: 'Financial', accentWord: 'Accounts', accent: 'emerald', subtitle: 'Cash Drawers & Bank Accounts' },
    'finance/aging/page.tsx': { icon: 'Clock', title: 'Aging', accentWord: 'Report', accent: 'amber', subtitle: 'Receivables & Payables Aging' },
    'finance/audit-trail/page.tsx': { icon: 'Shield', title: 'Audit', accentWord: 'Trail', accent: 'slate', subtitle: 'Financial Activity Log' },
    'finance/bank-reconciliation/page.tsx': { icon: 'Building', title: 'Bank', accentWord: 'Reconciliation', accent: 'blue', subtitle: 'Match Transactions' },
    'finance/budget/page.tsx': { icon: 'PieChart', title: 'Budget', accentWord: 'Management', accent: 'violet', subtitle: 'Planning & Tracking' },
    'finance/cash-register/page.tsx': { icon: 'Banknote', title: 'Cash', accentWord: 'Register', accent: 'emerald', subtitle: 'Daily Operations' },
    'finance/events/page.tsx': { icon: 'Calendar', title: 'Financial', accentWord: 'Events', accent: 'indigo', subtitle: 'Scheduled & Recurring' },
    'finance/events/[id]/page.tsx': { icon: 'Calendar', title: 'Event', accentWord: 'Details', accent: 'indigo', subtitle: 'Financial Event', isDetail: true },
    'finance/events/new/page.tsx': { icon: 'CalendarPlus', title: 'New', accentWord: 'Event', accent: 'indigo', subtitle: 'Create Financial Event' },
    'finance/expenses/page.tsx': { icon: 'Receipt', title: 'Expense', accentWord: 'Accounts', accent: 'rose', subtitle: 'Track & Manage' },
    'finance/fiscal-years/page.tsx': { icon: 'CalendarDays', title: 'Fiscal', accentWord: 'Years', accent: 'stone', subtitle: 'Periods & Closing' },
    'finance/invoices/page.tsx': { icon: 'FileText', title: 'Invoice', accentWord: 'Management', accent: 'blue', subtitle: 'Sales & Purchase Invoices', hasFontBlack: true },
    'finance/ledger/page.tsx': { icon: 'BookOpen', title: 'General', accentWord: 'Ledger', accent: 'stone', subtitle: 'Journal Entries' },
    'finance/ledger/new/page.tsx': { icon: 'FilePlus', title: 'New Journal', accentWord: 'Entry', accent: 'emerald', subtitle: 'Create Manual Entry' },
    'finance/loans/[id]/page.tsx': { icon: 'Landmark', title: 'Loan', accentWord: 'Details', accent: 'violet', subtitle: 'Loan Overview', isDetail: true },
    'finance/loans/new/page.tsx': { icon: 'Landmark', title: 'New', accentWord: 'Loan', accent: 'violet', subtitle: 'Create Loan' },
    'finance/payments/page.tsx': { icon: 'CreditCard', title: 'Payments &', accentWord: 'Collections', accent: 'emerald', subtitle: 'Supplier & Customer', hasFontBlack: true },
    'finance/profit-centers/page.tsx': { icon: 'Target', title: 'Profit', accentWord: 'Centers', accent: 'purple', subtitle: 'Departmental Tracking' },
    'finance/revenue/page.tsx': { icon: 'TrendingUp', title: 'Revenue', accentWord: 'Accounts', accent: 'blue', subtitle: 'Income Tracking' },
    'finance/statements/page.tsx': { icon: 'FileBarChart', title: 'Account', accentWord: 'Statements', accent: 'indigo', subtitle: 'Contact Balances' },
    'finance/tax-reports/page.tsx': { icon: 'FileSpreadsheet', title: 'Tax', accentWord: 'Reports', accent: 'rose', subtitle: 'VAT & Tax Summary' },
    'finance/accounts/new/page.tsx': { icon: 'WalletCards', title: 'New', accentWord: 'Account', accent: 'emerald', subtitle: 'Create Financial Account' },
    'finance/balances/page-client.tsx': { icon: 'Scale', title: 'Account', accentWord: 'Balances', accent: 'blue', subtitle: 'Real-time Positions' },
    'finance/einvoicing/page-client.tsx': { icon: 'Zap', title: 'E-', accentWord: 'Invoicing', accent: 'indigo', subtitle: 'ZATCA & FNE Compliance' },
    'finance/gateway/page-client.tsx': { icon: 'CreditCard', title: 'Payment', accentWord: 'Gateway', accent: 'violet', subtitle: 'Online Payments' },
    'finance/reports/builder/page-client.tsx': { icon: 'BarChart3', title: 'Report', accentWord: 'Builder', accent: 'indigo', subtitle: 'Custom Financial Reports' },
    'finance/tax-groups/page-client.tsx': { icon: 'Percent', title: 'Tax', accentWord: 'Groups', accent: 'amber', subtitle: 'VAT & Tax Configuration' },
    // === SALES ===
    'sales/analytics/page.tsx': { icon: 'BarChart3', title: 'Sales', accentWord: 'Analytics', accent: 'indigo', subtitle: 'Performance Insights' },
    'sales/consignment-settlements/page-client.tsx': { icon: 'Handshake', title: 'Consignment', accentWord: 'Settlements', accent: 'emerald', subtitle: 'Partner Reconciliation' },
    'sales/deliveries/page.tsx': { icon: 'Truck', title: 'Delivery', accentWord: 'Management', accent: 'blue', subtitle: 'Shipments & Tracking' },
    'sales/delivery-zones/page.tsx': { icon: 'MapPin', title: 'Delivery', accentWord: 'Zones', accent: 'emerald', subtitle: 'Coverage Areas' },
    'sales/discounts/page.tsx': { icon: 'Tags', title: 'Discount', accentWord: 'Engine', accent: 'amber', subtitle: 'Promotions & Rules' },
    'sales/history/page.tsx': { icon: 'History', title: 'Transaction', accentWord: 'History', accent: 'indigo', subtitle: 'Sales & Purchases' },
    'sales/quotations/page.tsx': { icon: 'FileText', title: 'Quote', accentWord: 'Management', accent: 'blue', subtitle: 'Proposals & Estimates' },
    // === CRM ===
    'crm/contacts/[id]/page.tsx': { icon: 'UserCircle', title: 'Contact', accentWord: 'Profile', accent: 'indigo', subtitle: 'Customer Details', isDetail: true },
    'crm/insights/page.tsx': { icon: 'Lightbulb', title: 'CRM', accentWord: 'Insights', accent: 'amber', subtitle: 'Customer Intelligence' },
    'crm/supplier-performance/page.tsx': { icon: 'Award', title: 'Supplier', accentWord: 'Performance', accent: 'emerald', subtitle: 'Vendor Analytics' },
    // === ECOMMERCE ===
    'ecommerce/catalog/page.tsx': { icon: 'ShoppingBag', title: 'Online', accentWord: 'Catalog', accent: 'violet', subtitle: 'Product Catalog' },
    'ecommerce/dashboard/page.tsx': { icon: 'Store', title: 'E-Commerce', accentWord: 'Dashboard', accent: 'indigo', subtitle: 'Store Performance' },
    'ecommerce/orders/page.tsx': { icon: 'ShoppingCart', title: 'Online', accentWord: 'Orders', accent: 'blue', subtitle: 'E-Commerce Orders' },
    // === HR ===
    'hr/overview/page-client.tsx': { icon: 'Users', title: 'HR', accentWord: 'Overview', accent: 'indigo', subtitle: 'Human Resources' },
    'hr/payroll/page.tsx': { icon: 'Banknote', title: 'Payroll', accentWord: 'Management', accent: 'emerald', subtitle: 'Salaries & Compensation' },
    // === PURCHASES ===
    'purchases/dashboard/page.tsx': { icon: 'ShoppingCart', title: 'Purchase', accentWord: 'Dashboard', accent: 'blue', subtitle: 'Procurement Overview' },
    'purchases/purchase-orders/page-client.tsx': { icon: 'ClipboardList', title: 'Purchase', accentWord: 'Orders', accent: 'blue', subtitle: 'Order Management' },
    // === PRODUCTS ===
    'products/new/page.tsx': { icon: 'PackagePlus', title: 'New', accentWord: 'Product', accent: 'emerald', subtitle: 'Create Product' },
    // === SAAS ===
    '(saas)/currencies/page.tsx': { icon: 'Coins', title: 'Currency', accentWord: 'Management', accent: 'amber', subtitle: 'Exchange Rates' },
    // === DASHBOARD ===
    'dashboard/page.tsx': { icon: 'LayoutDashboard', title: 'Enterprise', accentWord: 'Dashboard', accent: 'indigo', subtitle: 'Business Overview' },
    // === USERS ===
    'users/approvals/page.tsx': { icon: 'CheckCircle', title: 'User', accentWord: 'Approvals', accent: 'emerald', subtitle: 'Pending Requests' },
    // === WORKSPACE ===
    'workspace/client-portal/page-client.tsx': { icon: 'Globe', title: 'Client', accentWord: 'Portal', accent: 'blue', subtitle: 'Customer Self-Service' },
    'workspace/supplier-portal/page-client.tsx': { icon: 'Truck', title: 'Supplier', accentWord: 'Portal', accent: 'emerald', subtitle: 'Vendor Self-Service' },
};

const BASE = 'src/app/(privileged)/';

// Patterns to match & replace
const HEADER_PATTERNS = [
    // Pattern 1: <h1 className="text-2xl font-bold text-stone-900 mb-6 font-serif">Title</h1>
    /(<h1\s+className="text-2xl font-bold[^"]*">)([^<]+)(<\/h1>)/,
    // Pattern 2: <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
    /(<h1\s+className="text-2xl font-bold[^"]*">)/,
    // Pattern 3: text-4xl font-bold (partial compliance — needs font-black)
    /(<h1\s+className="text-4xl font-bold[^"]*">)/,
];

let fixed = 0;
let skipped = 0;

for (const [relPath, config] of Object.entries(FIXES)) {
    const filePath = path.join(BASE, relPath);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${relPath}`);
        skipped++;
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if already has the standard pattern
    if (content.includes('text-4xl font-black tracking-tighter')) {
        console.log(`SKIP (already compliant): ${relPath}`);
        skipped++;
        continue;
    }

    // Find the header line
    const lines = content.split('\n');
    let headerLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('text-2xl font-bold') && (lines[i].includes('<h1') || lines[i].includes('<p'))) {
            // Only match h1 headers, not stat values
            if (lines[i].includes('<h1')) {
                headerLineIdx = i;
                break;
            }
        }
        if (lines[i].includes('text-4xl font-bold') && lines[i].includes('<h1')) {
            headerLineIdx = i;
            break;
        }
    }

    if (headerLineIdx === -1) {
        console.log(`SKIP (no header match): ${relPath}`);
        skipped++;
        continue;
    }

    // Check if icon is already imported
    const iconName = config.icon;
    const needsImport = !content.includes(`${iconName},`) && !content.includes(`${iconName} }`) && !content.includes(`${iconName}}`);

    if (needsImport) {
        // Find lucide-react import line
        const lucideImportIdx = lines.findIndex(l => l.includes('lucide-react'));
        if (lucideImportIdx !== -1) {
            // Add icon to existing import
            const line = lines[lucideImportIdx];
            if (line.includes('} from')) {
                lines[lucideImportIdx] = line.replace('} from', `, ${iconName} } from`);
            } else if (line.includes("from 'lucide-react'") || line.includes('from "lucide-react"')) {
                // Single line import like: import { X } from 'lucide-react'
                lines[lucideImportIdx] = line.replace(/}\s*from/, `, ${iconName} } from`);
            }
        } else {
            // Add new import at top (after 'use client' if present)
            const insertIdx = lines[0]?.includes("'use client'") ? 1 : 0;
            lines.splice(insertIdx + 1, 0, `import { ${iconName} } from 'lucide-react';`);
            headerLineIdx++; // offset
        }
    }

    // Build the new header block
    const indent = lines[headerLineIdx].match(/^\s*/)?.[0] || '            ';
    const newHeader = [
        `${indent}<h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">`,
        `${indent}    <div className="w-14 h-14 rounded-[1.5rem] bg-${config.accent}-600 flex items-center justify-center shadow-lg shadow-${config.accent}-200">`,
        `${indent}        <${iconName} size={28} className="text-white" />`,
        `${indent}    </div>`,
        `${indent}    ${config.title} <span className="text-${config.accent}-600">${config.accentWord}</span>`,
        `${indent}</h1>`,
        `${indent}<p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">${config.subtitle}</p>`,
    ].join('\n');

    // Find how many lines the old header spans
    // Simple case: h1 on one line ending with </h1>
    let endLineIdx = headerLineIdx;
    if (!lines[headerLineIdx].includes('</h1>')) {
        // Multi-line h1 — find closing tag
        for (let j = headerLineIdx + 1; j < Math.min(headerLineIdx + 10, lines.length); j++) {
            if (lines[j].includes('</h1>')) {
                endLineIdx = j;
                break;
            }
        }
    }

    // Check if there's a <header> wrapper
    let headerWrapperStartIdx = -1;
    if (headerLineIdx > 0 && lines[headerLineIdx - 1].includes('<header')) {
        headerWrapperStartIdx = headerLineIdx - 1;
    } else if (headerLineIdx > 1 && lines[headerLineIdx - 2].includes('<header')) {
        headerWrapperStartIdx = headerLineIdx - 2;
    }

    // Check for existing subtitle after h1
    let subtitleEndIdx = endLineIdx;
    if (endLineIdx + 1 < lines.length && lines[endLineIdx + 1].includes('text-sm') && lines[endLineIdx + 1].includes('text-gray-')) {
        subtitleEndIdx = endLineIdx + 1;
    }

    // Replace the header lines
    const replaceStart = headerLineIdx;
    const replaceEnd = subtitleEndIdx;
    const replaceCount = replaceEnd - replaceStart + 1;
    lines.splice(replaceStart, replaceCount, ...newHeader.split('\n'));

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`FIXED: ${relPath}`);
    fixed++;
}

console.log(`\n✅ Fixed: ${fixed}, Skipped: ${skipped}, Total: ${fixed + skipped}`);
