"use client"

import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Briefcase,
    Settings2,
    Command,
    Globe,
    ChevronRight,
    Search,
    Plus,
    Box,
    Wallet,
    Truck,
    Receipt,
    UserCheck,
    Shield,
    History,
    FileText,
    BarChart3,
    Landmark,
    Store,
    Bot,
    Palette,
    UserCog,
    Building2,
    ClipboardList,
    HeartPulse,
    Wrench,
} from "lucide-react"
import { PLATFORM_CONFIG } from "@/lib/saas_config"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import Link from "next/link"

const defaultNav = [
    {
        title: "Overview",
        url: "#",
        icon: LayoutDashboard,
        items: [
            { title: "Dashboard", url: "/dashboard" },
            { title: "Setup Wizard", url: "/setup-wizard" },
            { title: "TaskBoard", url: "/workspace/tasks" },
            { title: "Auto-Tasks", url: "/workspace/auto-task-settings" },
            { title: "Auto-Task Rules", url: "/workspace/auto-task-rules" },
            { title: "Import Data", url: "/migration" },
            { title: "Migration V2", url: "/migration_v2" },
            { title: "Marketplace", url: "/marketplace" },
        ]
    },
    {
        title: "Commercial",
        url: "#",
        icon: Store,
        items: [
            { title: "Point of Sale", url: "/sales" },
            { title: "Delivery Hub", url: "/delivery" },
            { title: "User Management", url: "/users" },
            { title: "Sales Console", url: "/sales/orders" },
            { title: "Sales History", url: "/sales/history" },
            { title: "POS Sessions", url: "/sales/sessions" },
            { title: "Sales Summary", url: "/sales/summary" },
            { title: "Sales Analytics", url: "/sales/analytics" },
            { title: "Sales Audit", url: "/sales/audit" },
            { title: "Quotations", url: "/sales/quotations" },
            { title: "Deliveries", url: "/sales/deliveries" },
            { title: "Delivery Zones", url: "/sales/delivery-zones" },
            { title: "Drivers", url: "/sales/drivers" },
            { title: "Sales Returns", url: "/sales/returns" },
            { title: "Credit Notes", url: "/sales/credit-notes" },
            { title: "Discount Rules", url: "/sales/discounts" },
            { title: "Consignment", url: "/sales/consignment" },
            { title: "Consignment Settle", url: "/sales/consignment-settlements" },
            { title: "POS Settings", url: "/sales/pos-settings" },
            { title: "Import Sales", url: "/sales/import" },
            { title: "Supermarchéé", url: "/sales/supermarche" },
        ]
    },
    {
        title: "Client Gate",
        url: "#",
        icon: Globe,
        items: [
            { title: "Portal Settings", url: "/workspace/portal-config" },
            { title: "Client Orders", url: "/workspace/client-orders" },
            { title: "Client Tickets", url: "/workspace/client-tickets" },
            { title: "Client Portal", url: "/workspace/client-portal" },
            { title: "Client Access", url: "/workspace/client-access" },
            { title: "Online Store", url: "/ecommerce/orders" },
            { title: "Coupons & Promos", url: "/ecommerce/coupons" },
            { title: "Cart Promotions", url: "/client_portal/cart-promotions" },
            { title: "Storefront Config", url: "/ecommerce/settings" },
            { title: "Admin Orders", url: "/client_portal/admin-orders" },
            { title: "Admin Tickets", url: "/client_portal/admin-tickets" },
            { title: "Admin Wallets", url: "/client_portal/admin-wallets" },
        ]
    },
    {
        title: "Supply Chain",
        url: "#",
        icon: Truck,
        items: [
            { title: "Procurement", url: "/purchases" },
            { title: "Dashboard", url: "/purchases/dashboard" },
            { title: "Purchase Orders", url: "/purchases/purchase-orders" },
            { title: "Invoices", url: "/purchases/invoices" },
            { title: "Goods Receipts", url: "/purchases/receipts" },
            { title: "Receiving", url: "/purchases/receiving" },
            { title: "Purchase Returns", url: "/purchases/returns" },
            { title: "Quotations & RFQ", url: "/purchases/quotations" },
            { title: "Credit Notes", url: "/purchases/credit-notes" },
            { title: "Consignments", url: "/purchases/consignments" },
            { title: "Sourcing Hub", url: "/purchases/sourcing" },
            { title: "Supplier Access", url: "/workspace/supplier-access" },
            { title: "Supplier Portal", url: "/workspace/supplier-portal" },
            { title: "Price Requests", url: "/workspace/price-requests" },
            { title: "Proformas", url: "/workspace/proformas" },
            { title: "Quote Inbox", url: "/workspace/quote-inbox" },
            { title: "Tenders", url: "/workspace/tenders" },
        ]
    },
    {
        title: "Inventory",
        url: "#",
        icon: Box,
        items: [
            { title: "Product Catalog", url: "/products" },
            { title: "Categories", url: "/inventory/categories" },
            { title: "Brands", url: "/inventory/brands" },
            { title: "Units", url: "/inventory/units" },
            { title: "Product Groups", url: "/inventory/product-groups" },
            { title: "Attributes", url: "/inventory/attributes" },
            { title: "Combo Products", url: "/inventory/combo" },
            { title: "Parfums", url: "/inventory/parfums" },
            { title: "Warehouses", url: "/inventory/warehouses" },
            { title: "Zones & Aisles", url: "/inventory/zones" },
            { title: "Racks & Shelves", url: "/inventory/racks" },
            { title: "Bins", url: "/inventory/bins" },
            { title: "Stock Levels", url: "/inventory/inventory" },
            { title: "Stock Movements", url: "/inventory/movements" },
            { title: "Stock Moves", url: "/inventory/stock-moves" },
            { title: "Transfer Orders", url: "/inventory/transfer-orders" },
            { title: "Adjustment Orders", url: "/inventory/adjustment-orders" },
            { title: "Stock Counts", url: "/inventory/stock-count" },
            { title: "Counting Sessions", url: "/inventory/counting-sessions" },
            { title: "Stock Alerts", url: "/inventory/stock-alerts" },
            { title: "Low Stock", url: "/inventory/low-stock" },
            { title: "Expiry Alerts", url: "/inventory/expiry-alerts" },
            { title: "Valuation", url: "/inventory/valuation" },
            { title: "Analytics", url: "/inventory/analytics" },
            { title: "Serials", url: "/inventory/serials" },
            { title: "Serial Logs", url: "/inventory/serial-logs" },
            { title: "Product Locations", url: "/inventory/product-locations" },
            { title: "Labels / Barcode", url: "/inventory/labels" },
            { title: "Operational Requests", url: "/inventory/requests" },
            { title: "Maintenance", url: "/inventory/maintenance" },
        ]
    },
    {
        title: "Finance",
        url: "#",
        icon: Landmark,
        items: [
            { title: "⚡ COA Setup", url: "/finance/setup" },
            { title: "Dashboard", url: "/finance/dashboard" },
            { title: "Chart of Accounts", url: "/finance/chart-of-accounts" },
            { title: "General Ledger", url: "/finance/ledger" },
            { title: "Journal Entries", url: "/finance/journal" },
            { title: "Fiscal Years", url: "/finance/fiscal-years" },
            { title: "Fiscal Periods", url: "/finance/fiscal-periods" },
            { title: "Invoices", url: "/finance/invoices" },
            { title: "Payments", url: "/finance/payments" },
            { title: "Payment Allocations", url: "/finance/payment-allocations" },
            { title: "Expenses", url: "/finance/expenses" },
            { title: "Deferred Expenses", url: "/finance/deferred-expenses" },
            { title: "Vouchers", url: "/finance/vouchers" },
            { title: "Bank Reconciliation", url: "/finance/bank-reconciliation" },
            { title: "Cash Registers", url: "/finance/cash-register" },
            { title: "Bank Accounts", url: "/finance/gateway" },
            { title: "Fixed Assets", url: "/finance/balances" },
            { title: "Loans", url: "/finance/loans" },
            { title: "Budget", url: "/finance/budget" },
            { title: "Revenue", url: "/finance/revenue" },
            { title: "Profit Centers", url: "/finance/profit-centers" },
            { title: "Profit Distribution", url: "/finance/profit-distribution" },
            { title: "Customer Balances", url: "/finance/customer-balances" },
            { title: "Supplier Balances", url: "/finance/supplier-balances" },
            { title: "Sequences", url: "/finance/sequences" },
            { title: "Tax (VAT) Reports", url: "/finance/tax-reports" },
            { title: "VAT Return", url: "/finance/vat-return" },
            { title: "VAT Settlement", url: "/finance/vat-settlement" },
            { title: "Tax Groups", url: "/finance/tax-groups" },
            { title: "Tax Policy", url: "/finance/tax-policy" },
            { title: "Org Tax Policies", url: "/finance/org-tax-policies" },
            { title: "Counterparty Profiles", url: "/finance/counterparty-tax-profiles" },
            { title: "Custom Tax Rules", url: "/finance/custom-tax-rules" },
            { title: "Periodic Tax", url: "/finance/periodic-tax" },
            { title: "E-Invoice", url: "/finance/einvoice" },
            { title: "Statements", url: "/finance/statements" },
            { title: "Posting Rules", url: "/finance/settings/posting-rules" },
            { title: "Audit Trail", url: "/finance/audit-trail" },
            { title: "Reports", url: "/finance/reports" },
            { title: "P&L", url: "/finance/reports/pnl" },
            { title: "Balance Sheet", url: "/finance/reports/balance-sheet" },
            { title: "Trial Balance", url: "/finance/reports/trial-balance" },
            { title: "Aging Report", url: "/finance/reports/aging" },
        ]
    },
    {
        title: "Relationships",
        url: "#",
        icon: Users,
        items: [
            { title: "Contacts & Leads", url: "/crm/contacts" },
            { title: "Price Groups", url: "/crm/pricing" },
            { title: "User Approvals", url: "/users/approvals" },
        ]
    },
    {
        title: "Human Capital",
        url: "#",
        icon: UserCog,
        items: [
            { title: "HR Overview", url: "/hr/overview" },
            { title: "Employees", url: "/hr/employees" },
            { title: "Departments", url: "/hr/departments" },
            { title: "Attendance", url: "/hr/attendance" },
            { title: "Shift Management", url: "/hr/shifts" },
            { title: "Leave Requests", url: "/hr/leaves" },
            { title: "Payroll", url: "/hr/payroll" },
            { title: "Performance", url: "/workspace/performance" },
            { title: "Evaluations", url: "/workspace/evaluations" },
            { title: "KPI Config", url: "/workspace/kpi-config" },
            { title: "Questionnaires", url: "/workspace/questionnaires" },
            { title: "Scores", url: "/workspace/scores" },
            { title: "Checklists", url: "/workspace/checklists" },
            { title: "Templates", url: "/workspace/templates" },
        ]
    },
    {
        title: "Intelligence",
        url: "#",
        icon: Bot,
        items: [
            { title: "AI Chat", url: "/mcp/chat" },
            { title: "Virtual Employees", url: "/mcp/agents" },
            { title: "Knowledge Base", url: "/mcp/conversations" },
            { title: "AI Providers", url: "/mcp/providers" },
            { title: "AI Tools", url: "/mcp/tools" },
            { title: "Usage & Billing", url: "/mcp/usage" },
        ]
    },
    {
        title: "Settings",
        url: "#",
        icon: Wrench,
        items: [
            { title: "Appearance & Theme", url: "/settings/appearance" },
            { title: "POS Settings", url: "/settings/pos-settings" },
            { title: "Notifications", url: "/settings/notifications" },
            { title: "Security", url: "/settings/security" },
            { title: "WhatsApp", url: "/settings/whatsapp" },
            { title: "Webhooks", url: "/integrations/webhooks" },
            { title: "Barcode Settings", url: "/finance/settings/barcode" },
            { title: "Theme Demo", url: "/theme-demo" },
            { title: "UI Kit", url: "/ui-kit" },
        ]
    },
    {
        title: "SaaS Control",
        url: "#",
        icon: Settings2,
        items: [
            { title: "Storage & Media", url: "/storage" },
            { title: "Packages", url: "/storage/packages" },
            { title: "Security & Roles", url: "/settings/roles" },
            { title: "Custom Domains", url: "/settings/domains" },
            { title: "Audit Events", url: "/finance/events" },
            { title: "Subscription", url: "/subscription" },
        ]
    }
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    user?: Record<string, any>;
    tenant?: Record<string, any>;
}

export function AppSidebar({ user, tenant, ...props }: AppSidebarProps) {
    const tenantName = tenant?.name || PLATFORM_CONFIG.name;
    const tenantSlug = tenant?.slug || "hq"; // Generic fallback

    // Dynamic User Info
    const userName = user?.first_name ? `${user.first_name} ${user.last_name}` : (user?.username || "Guest User");
    const userEmail = user?.email || "No Email";

    // Construct links with tenant context if needed
    // Since we use middleware rewrite, /dashboard is actually /tenant/[slug]/dashboard
    // But navigation links should probably keep using the clean structure if on subdomain
    // If on subdomain, /dashboard IS correct.
    // If we want explicit submodule links: /inventory, etc.

    const navItems = defaultNav.filter(item => {
        if (item.title === "SaaS Control") {
            return user?.is_superuser === true || tenant?.is_saas_org === true || tenantSlug === "hq" || tenantSlug === "saas";
        }
        return true;
    });

    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    {/* Use first letter of tenant name */}
                                    <Command className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{tenantName}</span>
                                    <span className="truncate text-xs">Enterprise</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {navItems.map((item) => (
                        <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={false}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                {item.items ? (
                                    <>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton tooltip={item.title}>
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {item.items.map((subItem) => (
                                                    <SidebarMenuSubItem key={subItem.title}>
                                                        <SidebarMenuSubButton asChild>
                                                            <Link href={subItem.url}>
                                                                <span>{subItem.title}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </>
                                ) : (
                                    <SidebarMenuButton asChild tooltip={item.title}>
                                        <Link href={item.url}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                )}
                            </SidebarMenuItem>
                        </Collapsible>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-4">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-app-border flex items-center justify-center text-xs font-bold text-app-text-muted">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium truncate">{userName}</p>
                            <p className="text-xs text-app-text-muted truncate">{userEmail}</p>
                        </div>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
