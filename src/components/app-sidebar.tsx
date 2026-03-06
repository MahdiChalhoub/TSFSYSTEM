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
    Bot
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
            { title: "Import Data", url: "/migration" },
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
            { title: "Quotations", url: "/sales/quotations" },
            { title: "Deliveries", url: "/sales/deliveries" },
            { title: "Sales Returns", url: "/sales/returns" },
            { title: "Credit Notes", url: "/sales/credit-notes" },
            { title: "Discount Rules", url: "/sales/discounts" },
        ]
    },
    {
        title: "Client Gate",
        url: "#",
        icon: Globe,
        items: [
            { title: "Portal Settings", url: "/workspace/portal-config" },
            { title: "Client Orders", url: "/workspace/client-orders" },
            { title: "Online Store", url: "/ecommerce/orders" },
            { title: "Coupons & Promos", url: "/ecommerce/coupons" },
            { title: "Storefront Config", url: "/ecommerce/settings" },
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
            { title: "Purchase Returns", url: "/purchases/returns" },
            { title: "Quotations & RFQ", url: "/purchases/quotations" },
            { title: "Credit Notes", url: "/purchases/credit-notes" },
            { title: "Consignments", url: "/purchases/consignments" },
            { title: "Sourcing Hub", url: "/purchases/sourcing" },
            { title: "Product Catalog", url: "/products" },
            { title: "Categories", url: "/inventory/categories" },
            { title: "Brands & Units", url: "/inventory/units" },
            { title: "Warehouses", url: "/inventory/warehouses" },
            { title: "Stock Movements", url: "/inventory/movements" },
            { title: "Stock Counts", url: "/inventory/stock-count" },
            { title: "Transfer Orders", url: "/inventory/transfer-orders" },
            { title: "Low Stock Alerts", url: "/inventory/low-stock" },
            { title: "Supplier Access", url: "/workspace/supplier-access" },
            { title: "Supplier Portal", url: "/workspace/supplier-portal" },
            { title: "Price Requests", url: "/workspace/price-requests" },
        ]
    },
    {
        title: "Performance",
        url: "#",
        icon: Landmark,
        items: [
            { title: "Chart of Accounts", url: "/finance/chart-of-accounts" },
            { title: "General Ledger", url: "/finance/ledger" },
            { title: "Fiscal Years", url: "/finance/fiscal-years" },
            { title: "Invoices", url: "/finance/invoices" },
            { title: "Payments", url: "/finance/payments" },
            { title: "Expenses", url: "/finance/expenses" },
            { title: "Bank Reconciliation", url: "/finance/bank-reconciliation" },
            { title: "Tax (VAT) Reports", url: "/finance/tax-reports" },
            { title: "Cash Registers", url: "/finance/cash-register" },
            { title: "Bank Accounts", url: "/finance/accounts" },
            { title: "Fixed Assets", url: "/finance/assets" },
        ]
    },
    {
        title: "Relationships",
        url: "#",
        icon: Users,
        items: [
            { title: "Contacts & Leads", url: "/crm/contacts" },
            { title: "Price Groups", url: "/crm/pricing" },
            { title: "Portal Config", url: "/workspace/portal-config" },
            { title: "Client Access", url: "/workspace/client-access" },
            { title: "Quote Inbox", url: "/workspace/quote-inbox" },
        ]
    },
    {
        title: "Intelligence",
        url: "#",
        icon: Bot,
        items: [
            { title: "AI Assistant", url: "/mcp/chat" },
            { title: "Virtual Employees", url: "/mcp/agents" },
            { title: "Knowledge Base", url: "/mcp/conversations" },
        ]
    },
    {
        title: "SaaS Control",
        url: "#",
        icon: Settings2,
        items: [
            { title: "Storage & Media", url: "/storage" },
            { title: "Security & Roles", url: "/settings/roles" },
            { title: "Auto-Task Engine", url: "/workspace/auto-task-rules" },
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
