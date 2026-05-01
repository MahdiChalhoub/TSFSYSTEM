'use client';

import { useAdmin } from '@/context/AdminContext';
import {
    ChevronRight,
    Layers,
    BarChart3,
    LogOut,
    PanelLeft,
    Rows3,
} from 'lucide-react';
import React, { useState } from 'react';
import clsx from 'clsx';

import { logoutAction } from "@/app/actions/auth";
import { PLATFORM_CONFIG } from '@/lib/saas_config';

import { MENU_ITEMS } from './_lib/menu';
import type { MenuItem as MenuItemType } from './_lib/menu/types';
import { MenuItem } from './_components/MenuItem';
import { FavoritesPanel } from './_components/FavoritesPanel';
import { useSidebar } from './_hooks/useSidebar';
import type { SidebarDynamicItem } from "@/types/erp";

// Re-export for legacy consumers (TabNavigator, TopHeader, CommandPalette, mobile shell, home page).
export { MENU_ITEMS } from './_lib/menu';

export function Sidebar({
    isSaas = false,
    isSuperuser = false,
    dualViewEnabled = false,
    initialModuleCodes = [],
    initialDynamicItems = [],
}: {
    isSaas?: boolean;
    isSuperuser?: boolean;
    dualViewEnabled?: boolean;
    initialModuleCodes?: string[];
    initialDynamicItems?: SidebarDynamicItem[];
}) {
    const { sidebarOpen, toggleSidebar, openTab, activeTab, viewScope, setViewScope, canToggleScope, navLayout, setNavLayout, tabLayout, setTabLayout } = useAdmin();

    // ── All hooks MUST be declared before any conditional returns (React rules-of-hooks) ──
    const { installedModules, dynamicItems } = useSidebar({ initialModuleCodes, initialDynamicItems });
    const [devSectionOpen, setDevSectionOpen] = useState(true);
    const [inProgressSectionOpen, setInProgressSectionOpen] = useState(true);

    // In topnav mode the sidebar is hidden — navigation lives in the header
    if (navLayout === 'topnav') return null;

    // Merge hardcoded core with dynamic. The two sources have slightly different
    // field shapes (MenuItem.title vs SidebarDynamicItem.label, etc.) — describe
    // both fields on the union so consumers can read either.
    type SidebarNode = MenuItemType & {
        label?: string;
        href?: string;
        children?: SidebarNode[];
    };
    const allItems: SidebarNode[] = [...MENU_ITEMS, ...(dynamicItems as unknown as SidebarNode[])];

    const processedItems = allItems.filter((item) => {
        // Superusers ALWAYS see SaaS Control; non-SaaS non-superuser hides saas-visibility items.
        if (!isSaas && !isSuperuser && item.visibility === 'saas') return false;
        // Hide items whose module isn't installed (null installedModules = not loaded yet → show all)
        if (installedModules !== null && item.module && item.module !== 'core' && !installedModules.has(String(item.module))) {
            return false;
        }
        return true;
    });

    // Pin SaaS Control to top if in SaaS or superuser context
    const filteredItems = (isSaas || isSuperuser)
        ? [
            ...processedItems.filter((i) => i.title === 'SaaS Control'),
            ...processedItems.filter((i) => i.title !== 'SaaS Control')
        ]
        : processedItems;

    // Split items by stage: production (finished) vs in-progress vs development (not started).
    // Recurses into nested groups: stage on a leaf wins, otherwise it inherits from the nearest
    // ancestor with an explicit stage. A group survives if at least one descendant matches the target.
    function matchesStage(stage: string | undefined, targetStage: 'production' | 'in-progress' | 'development'): boolean {
        if (targetStage === 'production') return stage === 'production';
        if (targetStage === 'in-progress') return stage === 'in-progress';
        return stage !== 'production' && stage !== 'in-progress';
    }
    function pruneByStage(node: SidebarNode, parentStage: string | undefined, targetStage: 'production' | 'in-progress' | 'development'): SidebarNode | null {
        const effectiveStage = node.stage || parentStage || undefined;
        if (!node.children || node.children.length === 0) {
            return matchesStage(effectiveStage, targetStage) ? node : null;
        }
        const prunedChildren = node.children
            .map((c) => pruneByStage(c, effectiveStage, targetStage))
            .filter((c): c is SidebarNode => c !== null);
        if (prunedChildren.length === 0) return null;
        return { ...node, children: prunedChildren };
    }
    function splitByStage(items: SidebarNode[], targetStage: 'production' | 'in-progress' | 'development'): SidebarNode[] {
        return items
            .map((item) => pruneByStage(item, undefined, targetStage))
            .filter((item): item is SidebarNode => item !== null);
    }
    const productionItems = splitByStage(filteredItems, 'production');
    const inProgressItems = splitByStage(filteredItems, 'in-progress');
    const developmentItems = splitByStage(filteredItems, 'development');

    return (
        <React.Fragment>
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <aside className="fixed md:relative inset-y-0 left-0 shrink-0 overflow-hidden z-50"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: sidebarOpen ? '240px' : '0px',
                minWidth: sidebarOpen ? '240px' : '0px',
                opacity: sidebarOpen ? 1 : 0,
                pointerEvents: sidebarOpen ? 'auto' : 'none',
                transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                background: 'var(--app-sidebar-bg)',
                borderRight: '1px solid var(--app-sidebar-border)',
                color: 'var(--app-sidebar-text)',
                boxShadow: sidebarOpen ? '4px 0 24px -8px rgba(0,0,0,0.15)' : 'none',
            }}>
                <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-sidebar-border) 50%, transparent)',
                }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm"
                        style={{
                            background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-dark, var(--app-primary)))',
                            boxShadow: '0 2px 8px var(--app-primary-glow, rgba(0,0,0,0.2))',
                        }}>
                        {PLATFORM_CONFIG.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-black tracking-tight leading-none truncate" style={{ color: 'var(--app-sidebar-text)' }}>
                            {PLATFORM_CONFIG.name}
                        </h1>
                        <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--app-primary)' }}>
                            {isSaas ? 'Platform Admin' : 'Workspace'}
                        </p>
                    </div>
                </div>

                {dualViewEnabled && canToggleScope && (
                    <div className="mx-4 mt-3 shrink-0">
                        <div className="p-1 rounded-xl flex gap-0.5" style={{
                            background: 'color-mix(in srgb, var(--app-sidebar-border) 30%, transparent)',
                        }}>
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                suppressHydrationWarning={true}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                    viewScope === 'OFFICIAL' ? "text-white" : "hover:bg-[var(--app-sidebar-active)]"
                                )}
                                style={viewScope === 'OFFICIAL' ? {
                                    background: 'var(--app-primary)', color: 'white',
                                    boxShadow: '0 2px 6px var(--app-primary-glow, rgba(0,0,0,0.2))',
                                } : { color: 'var(--app-sidebar-muted)' }}
                            >
                                <Layers size={12} /> Official
                            </button>
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                suppressHydrationWarning={true}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                    viewScope === 'INTERNAL' ? "" : "hover:bg-[var(--app-sidebar-active)]"
                                )}
                                style={viewScope === 'INTERNAL' ? {
                                    background: 'var(--app-sidebar-surface, var(--app-sidebar-active))',
                                    color: 'var(--app-sidebar-text)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                } : { color: 'var(--app-sidebar-muted)' }}
                            >
                                <BarChart3 size={12} /> Internal
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto custom-scrollbar px-3 py-3 space-y-0.5" style={{ flex: '1 1 0', minHeight: 0 }}>
                    <FavoritesPanel openTab={openTab} />

                    {productionItems.length > 0 && (
                        <>
                            <div className="mb-2 mx-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success, #22c55e)' }} />
                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success, #22c55e)', opacity: 0.85 }}>Production</span>
                                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' }} />
                                <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)', opacity: 0.6 }}>{productionItems.length}</span>
                            </div>
                            {productionItems.map((item, idx: number) => (
                                <React.Fragment key={`prod-${idx}`}>
                                    {idx > 0 && item.visibility === 'saas' && (
                                        <div className="my-2 mx-2 flex items-center gap-2">
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Platform</span>
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                        </div>
                                    )}
                                    <MenuItem item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                                </React.Fragment>
                            ))}
                        </>
                    )}

                    {inProgressItems.length > 0 && (
                        <>
                            <div
                                className="my-3 mx-2 flex items-center gap-2 cursor-pointer select-none group"
                                onClick={() => setInProgressSectionOpen(!inProgressSectionOpen)}
                            >
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-info, #3b82f6)' }} />
                                <span className="text-[9px] font-black uppercase tracking-widest transition-colors" style={{ color: 'var(--app-info, #3b82f6)', opacity: 0.85 }}>
                                    In Progress ({inProgressItems.length})
                                </span>
                                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' }} />
                                <ChevronRight
                                    size={12}
                                    className={clsx("transition-transform duration-200", inProgressSectionOpen ? "rotate-90" : "")}
                                    style={{ color: 'var(--app-info, #3b82f6)', opacity: 0.6 }}
                                />
                            </div>
                            {inProgressSectionOpen && inProgressItems.map((item, idx: number) => (
                                <React.Fragment key={`inprog-${idx}`}>
                                    {idx > 0 && item.visibility === 'saas' && (
                                        <div className="my-2 mx-2 flex items-center gap-2">
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Platform</span>
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                        </div>
                                    )}
                                    <MenuItem item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                                </React.Fragment>
                            ))}
                        </>
                    )}

                    {developmentItems.length > 0 && (
                        <>
                            <div
                                className="my-3 mx-2 flex items-center gap-2 cursor-pointer select-none group"
                                onClick={() => setDevSectionOpen(!devSectionOpen)}
                            >
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-warning, #f59e0b)' }} />
                                <span className="text-[9px] font-black uppercase tracking-widest transition-colors" style={{ color: 'var(--app-warning, #f59e0b)', opacity: 0.85 }}>
                                    Development ({developmentItems.length})
                                </span>
                                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }} />
                                <ChevronRight
                                    size={12}
                                    className={clsx("transition-transform duration-200", devSectionOpen ? "rotate-90" : "")}
                                    style={{ color: 'var(--app-warning, #f59e0b)', opacity: 0.6 }}
                                />
                            </div>
                            {devSectionOpen && developmentItems.map((item, idx: number) => (
                                <React.Fragment key={`dev-${idx}`}>
                                    {idx > 0 && item.visibility === 'saas' && (
                                        <div className="my-2 mx-2 flex items-center gap-2">
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Platform</span>
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                        </div>
                                    )}
                                    <MenuItem item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                                </React.Fragment>
                            ))}
                        </>
                    )}
                </div>

                <div className="px-3 py-3 shrink-0 space-y-1" style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-sidebar-border) 50%, transparent)',
                }}>
                    <div className="flex items-center gap-1 px-1 pb-1">
                        <button
                            onClick={() => setNavLayout(navLayout === 'sidebar' ? 'topnav' : 'sidebar')}
                            title={navLayout === 'sidebar' ? 'Switch to top navigation' : 'Switch to sidebar navigation'}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                            style={{ color: 'var(--app-sidebar-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-sidebar-active)'; e.currentTarget.style.color = 'var(--app-sidebar-text)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--app-sidebar-muted)'; }}
                        >
                            <PanelLeft size={15} />
                        </button>
                        <button
                            onClick={() => setTabLayout(tabLayout === 'horizontal' ? 'vertical' : 'horizontal')}
                            title={tabLayout === 'horizontal' ? 'Switch to vertical tabs' : 'Switch to horizontal tabs'}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                            style={{ color: 'var(--app-sidebar-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-sidebar-active)'; e.currentTarget.style.color = 'var(--app-sidebar-text)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--app-sidebar-muted)'; }}
                        >
                            <Rows3 size={15} />
                        </button>
                    </div>

                    <button
                        onClick={() => logoutAction()}
                        suppressHydrationWarning={true}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-all group"
                        style={{ color: 'var(--app-sidebar-muted)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)';
                            e.currentTarget.style.color = 'var(--app-error, #ef4444)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--app-sidebar-muted)';
                        }}
                    >
                        <LogOut size={16} />
                        <span className="text-xs font-bold">Sign Out</span>
                    </button>
                </div>
            </aside>
        </React.Fragment>
    );
}
