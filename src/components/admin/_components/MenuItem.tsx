'use client';

import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronRight, Star } from 'lucide-react';
import { useFavorites } from '@/context/FavoritesContext';
import { SidebarDynamicItem } from "@/types/erp";
import { useTranslations } from 'next-intl';

/**
 * Converts a human-readable English title to a camelCase translation key.
 * Examples:
 *   "Products"              → "products"
 *   "Purchase Orders"       → "purchaseOrders"
 *   "Alerts & Intelligence" → "alertsAndIntelligence"
 *   "E-Invoicing"           → "eInvoicing"
 *   "Gift & Sample VAT"     → "giftSampleVat"
 *   "POS Settings"          → "posSettings"
 */
function titleToKey(title: string): string {
    return title
        .replace(/&/g, 'And')           // & → And
        .replace(/['']/g, '')           // Remove apostrophes
        .replace(/[^\w\s-]/g, '')       // Remove special chars except hyphens
        .replace(/-/g, ' ')            // Hyphens → spaces
        .trim()
        .split(/\s+/)
        .map((word, i) =>
            i === 0
                ? word.toLowerCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
}

export function MenuItem({
    item,
    openTab,
    activeTab,
    installedModules,
    level = 0
}: {
    item: Record<string, any>,
    openTab: (...args: any[]) => any,
    activeTab: string,
    installedModules: Set<string> | null,
    level?: number
}) {
    const { toggleFavorite, isFavorite } = useFavorites();
    const t = useTranslations('Sidebar');

    // ── Resolve translated title ──
    // Auto-convert title → camelCase key → lookup in Sidebar namespace.
    // Falls back to raw English title if no translation exists.
    const displayTitle = useMemo(() => {
        try {
            const key = titleToKey(item.title);
            const translated = t(key as any);
            // next-intl returns the key path if missing — detect that
            if (translated && translated !== `Sidebar.${key}`) {
                return translated;
            }
        } catch {
            // Key doesn't exist in messages — use fallback
        }
        return item.title;
    }, [item.title, t]);

    // 1. Module & Visibility Filter (null = not loaded yet, show everything)
    if (installedModules !== null && item.module && item.module !== 'core' && !installedModules.has(item.module)) {
        return null;
    }

    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isLeaf = !!item.path;

    // 2. Recursive Active State Detection
    const checkActive = (it: SidebarDynamicItem): boolean => {
        if (it.path === activeTab) return true;
        if (it.children) return it.children.some((c: SidebarDynamicItem) => checkActive(c));
        return false;
    };

    const isChildActive = hasChildren && item.children.some((child: SidebarDynamicItem) => checkActive(child));
    const isActive = activeTab === item.path;
    const isFav = isLeaf ? isFavorite(item.path) : false;

    // 3. Expansion Logic
    const [expanded, setExpanded] = useState(isChildActive);
    useEffect(() => {
        if (isChildActive) setExpanded(true);
    }, [activeTab, isChildActive]);

    const handleClick = () => {
        if (hasChildren) {
            setExpanded(!expanded);
        } else if (item.path) {
            openTab(displayTitle, item.path);
        }
    };


    return (
        <div className={level > 0 ? "mt-0.5" : "mt-0.5"}>
            <div
                onClick={handleClick}
                className={clsx(
                    "flex items-center gap-2.5 px-3 cursor-pointer select-none transition-all duration-150 group relative overflow-hidden",
                    level === 0 ? "py-2 rounded-xl" : "py-1.5 rounded-lg",
                    isActive
                        ? "font-bold"
                        : isChildActive
                            ? ""
                            : "hover:bg-[var(--app-sidebar-active)]"
                )}
                style={
                    isActive ? {
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        color: 'var(--app-primary)',
                    } : isChildActive ? {
                        background: 'color-mix(in srgb, var(--app-sidebar-active) 50%, transparent)',
                        color: 'var(--app-sidebar-text)',
                    } : {
                        color: 'var(--app-sidebar-muted)',
                    }
                }
            >
                {/* Active Accent Strip */}
                {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full" style={{ background: 'var(--app-primary)' }} />
                )}

                {Icon && (
                    <Icon size={level === 0 ? 18 : 15} style={
                        isActive || isChildActive
                            ? { color: 'var(--app-primary)' }
                            : undefined
                    } className={isActive || isChildActive ? "" : "group-hover:text-[var(--app-sidebar-text)] transition-colors"} />
                )}

                <span className={clsx(
                    "flex-1 truncate",
                    level === 0 ? "text-[13px] font-medium" : "text-[12px] font-normal"
                )}>
                    {displayTitle}
                </span>

                {/* Favorite Toggle (Leaf nodes only) */}
                {isLeaf && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(displayTitle, item.path);
                        }}
                        className={clsx(
                            "opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-[var(--app-sidebar-muted)]/10 rounded-md",
                            isFav && "opacity-100"
                        )}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Star
                            size={12}
                            style={{
                                fill: isFav ? '#f59e0b' : 'none',
                                color: isFav ? '#f59e0b' : 'var(--app-sidebar-muted)'
                            }}
                        />
                    </button>
                )}

                {hasChildren && (
                    <div className={clsx("transition-transform duration-200", expanded ? "rotate-90" : "")}
                        style={{ color: expanded ? 'var(--app-primary)' : 'inherit', opacity: 0.5 }}>
                        <ChevronRight size={14} />
                    </div>
                )}
            </div>

            {hasChildren && expanded && (
                <div className="ml-5 pl-3 my-0.5 space-y-0" style={{
                    borderLeft: '1px solid color-mix(in srgb, var(--app-sidebar-border) 60%, transparent)',
                }}>
                    {item.children.map((child: Record<string, any>, idx: number) => (
                        <MenuItem
                            key={idx}
                            item={child}
                            openTab={openTab}
                            activeTab={activeTab}
                            installedModules={installedModules}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

