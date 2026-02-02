"use client"

import * as React from "react"
import {
    BookOpen,
    Bot,
    Command,
    Frame,
    LifeBuoy,
    Map,
    PieChart,
    Send,
    Settings2,
    SquareTerminal,
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Briefcase,
    Wallet
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
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
    },
    {
        title: "Purchases",
        url: "/purchases",
        icon: Wallet,
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
    user?: any;
    tenant?: any;
}

export function AppSidebar({ user, tenant, ...props }: AppSidebarProps) {
    const tenantName = tenant?.name || "TSF Cloud";
    const tenantSlug = tenant?.slug || "tsf"; // Fallback

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
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title}>
                                <Link href={item.url}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
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
