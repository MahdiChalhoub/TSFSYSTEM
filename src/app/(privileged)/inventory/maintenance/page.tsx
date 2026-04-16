// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { getMaintenanceEntities } from "@/app/actions/maintenance";
import { MaintenanceSidebar } from "@/components/admin/maintenance/MaintenanceSidebar";
import { UnifiedReassignmentTable } from "@/components/admin/maintenance/UnifiedReassignmentTable";
import {
    Wrench, Layers, Tag, Ruler, Globe, Package,
    FolderTree, Award, Box, Gauge
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

const TAB_CONFIG = [
    { key: 'category', icon: Layers, label: 'Categories' },
    { key: 'brand', icon: Tag, label: 'Brands' },
    { key: 'attribute', icon: Package, label: 'Attributes' },
    { key: 'unit', icon: Ruler, label: 'Units' },
    { key: 'country', icon: Globe, label: 'Countries' },
] as const;

export default async function MaintenancePage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const searchParams = await props.searchParams;
    const tab = (searchParams.tab as string) || 'category';
    const activeId = searchParams.id ? Number(searchParams.id) : null;

    // Validate Tab
    const validTabs = TAB_CONFIG.map(t => t.key);
    if (!validTabs.includes(tab)) {
        redirect('/inventory/maintenance?tab=category');
    }

    // 1. Fetch Entities (Sidebar Data)
    const entities = await getMaintenanceEntities(tab as any);

    // 2. Fetch Products (if active)
    let products: Record<string, any>[] = [];
    let currentEntityName = `Select ${tab.charAt(0).toUpperCase() + tab.slice(1)}`;

    if (activeId) {
        let filterKey = '';
        if (tab === 'category') filterKey = 'category';
        if (tab === 'brand') filterKey = 'brand';
        if (tab === 'unit') filterKey = 'unit';
        if (tab === 'country') filterKey = 'country';
        if (tab === 'attribute') filterKey = 'parfum';

        try {
            const res = await erpFetch(`products/?${filterKey}=${activeId}`);
            products = Array.isArray(res) ? res : (res?.results ?? []);
        } catch (e) {
            console.error("Failed to fetch products for maintenance:", e);
        }

        const activeEntity = findEntityRecursive(entities, activeId);
        if (activeEntity) currentEntityName = activeEntity.name;
    }

    // Helper to find entity in flat list OR tree
    function findEntityRecursive(list: Record<string, any>[], id: number): Record<string, any> {
        for (const item of list) {
            if (item.id === id) return item;
            if (item.children) {
                const found = findEntityRecursive(item.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    // Count entities (including nested children for categories)
    function countEntities(list: Record<string, any>[]): number {
        let count = 0;
        for (const item of list) {
            count++;
            if (item.children) count += countEntities(item.children);
        }
        return count;
    }

    const entityCount = countEntities(entities);

    // Props safe for client
    const safeEntities = JSON.parse(JSON.stringify(entities));
    const safeProducts = JSON.parse(JSON.stringify(products));

    // Active tab config
    const activeTabConfig = TAB_CONFIG.find(t => t.key === tab)!;
    const ActiveIcon = activeTabConfig.icon;

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300 transition-all">
            {/* ═══════════ HEADER ═══════════ */}
            <div className="flex-shrink-0 space-y-3 pb-3">
                {/* Title Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="page-header-icon"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            <Wrench size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                Inventory Maintenance
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {entityCount} {activeTabConfig.label} · Reorganize Structure
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <Link
                            href="/inventory/maintenance/data-quality"
                            className="flex items-center gap-1.5 text-[11px] font-bold hover:text-app-foreground border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            style={{
                                color: 'var(--app-warning)',
                                borderColor: 'color-mix(in srgb, var(--app-warning) 30%, transparent)',
                                background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)',
                            }}
                        >
                            <Gauge size={13} />
                            <span className="hidden md:inline">Data Quality</span>
                        </Link>
                    </div>
                </div>

                {/* KPI Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {TAB_CONFIG.map(t => {
                        const isActive = tab === t.key;
                        const IconComp = t.icon;
                        const colors: Record<string, string> = {
                            category: 'var(--app-primary)',
                            brand: '#8b5cf6',
                            attribute: 'var(--app-info)',
                            unit: 'var(--app-success)',
                            country: 'var(--app-warning)',
                        };
                        const c = colors[t.key] || 'var(--app-primary)';
                        return (
                            <Link
                                key={t.key}
                                href={`/inventory/maintenance?tab=${t.key}`}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left no-underline"
                                style={{
                                    background: isActive
                                        ? `color-mix(in srgb, ${c} 12%, var(--app-surface))`
                                        : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: isActive
                                        ? `1.5px solid color-mix(in srgb, ${c} 40%, transparent)`
                                        : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    boxShadow: isActive
                                        ? `0 2px 8px color-mix(in srgb, ${c} 15%, transparent)`
                                        : 'none',
                                }}
                            >
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: `color-mix(in srgb, ${c} ${isActive ? '15' : '10'}%, transparent)`,
                                        color: c,
                                    }}
                                >
                                    <IconComp size={13} />
                                </div>
                                <div className="min-w-0">
                                    <div
                                        className="text-[10px] font-bold uppercase tracking-wider"
                                        style={{ color: isActive ? c : 'var(--app-muted-foreground)' }}
                                    >
                                        {t.label}
                                    </div>
                                    <div className="text-sm font-black text-app-foreground tabular-nums">
                                        {tab === t.key ? entityCount : '—'}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════ CONTENT — Split Panel ═══════════ */}
            <div
                className="flex flex-1 min-h-0 rounded-2xl overflow-hidden"
                style={{
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                }}
            >
                {/* Sidebar */}
                <MaintenanceSidebar
                    entities={safeEntities}
                    type={tab}
                    activeId={activeId}
                />

                {/* Main Area */}
                <main className="flex-1 overflow-hidden flex flex-col min-w-0">
                    {activeId ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Entity Header */}
                            <div
                                className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                                style={{
                                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                                }}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}
                                    >
                                        <ActiveIcon size={15} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-app-foreground">
                                            {currentEntityName}
                                        </h2>
                                        <p className="text-[10px] font-bold text-app-muted-foreground">
                                            {products.length} product{products.length !== 1 ? 's' : ''} linked
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    }}
                                >
                                    {tab}
                                </span>
                            </div>

                            {/* Product Table */}
                            <div className="flex-1 min-h-0">
                                <UnifiedReassignmentTable
                                    products={safeProducts}
                                    targetEntities={safeEntities}
                                    type={tab as any}
                                    currentEntityId={activeId}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="h-full flex flex-col items-center justify-center px-4 text-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                                style={{
                                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                <ActiveIcon size={28} style={{ color: 'var(--app-primary)', opacity: 0.7 }} />
                            </div>
                            <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                Select a {tab} from the sidebar
                            </p>
                            <p className="text-[11px] text-app-muted-foreground max-w-xs">
                                Choose an item to view and manage its linked products. You can reassign products to different {tab === 'category' ? 'categories' : `${tab}s`}.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}