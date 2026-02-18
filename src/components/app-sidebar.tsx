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
    Wallet
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
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Inventory",
        url: "/inventory",
        icon: Package,
    },
    {
        title: "Sales (POS)",
        url: "/pos",
        icon: ShoppingCart,
        items: [
            { title: "Point of Sale", url: "/pos" },
            { title: "History", url: "/sales/history" },
            { title: "Returns", url: "/sales/returns" },
        ]
    },
    {
        title: "Purchases",
        url: "/purchases",
        icon: Wallet,
        items: [
            { title: "Dashboard", url: "/purchases" },
            { title: "Returns", url: "/purchases/returns" },
            { title: "Sourcing", url: "/purchases/sourcing" },
        ]
    },
    {
        title: "HR & Employees",
        url: "/hr",
        icon: Users,
    },
    {
        title: "Finance",
        url: "/finance",
        icon: Briefcase,
    },
    {
        title: "Settings",
        url: "/settings",
        icon: Settings2,
    },
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

    // We can pass `tenant.menu` later for dynamic access control
    const navItems = defaultNav;

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
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium truncate">{userName}</p>
                            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                        </div>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
