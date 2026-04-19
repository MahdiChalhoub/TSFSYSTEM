'use client';

import { useState, useEffect } from 'react';
import { SidebarDynamicItem } from "@/types/erp";
import { getSaaSModules, getDynamicSidebar } from "@/app/actions/saas/modules";
import { parseDynamicItems } from "../_lib/parse-dynamic-items";

export function useSidebar({
    initialModuleCodes,
    initialDynamicItems,
}: {
    initialModuleCodes: string[];
    initialDynamicItems: SidebarDynamicItem[];
}) {
    // Initialise from server-passed props so the sidebar is fully populated on first paint
    // with no useEffect flicker. Falls back to null (show everything) when not provided.
    const [installedModules, setInstalledModules] = useState<Set<string> | null>(
        initialModuleCodes.length > 0 ? new Set(initialModuleCodes) : null
    );
    const [dynamicItems, setDynamicItems] = useState<SidebarDynamicItem[]>(
        () => parseDynamicItems(initialDynamicItems)
    );

    // Only fetch client-side if the layout didn't provide data (e.g. direct navigation
    // to a page that bypasses the privileged layout, or empty initial props)
    useEffect(() => {
        if (initialModuleCodes.length > 0 && initialDynamicItems.length === 0) return;
        if (installedModules !== null && dynamicItems.length > 0) return; // already hydrated

        async function fetchData() {
            try {
                const [modules, sidebarData] = await Promise.all([
                    getSaaSModules(),
                    getDynamicSidebar()
                ]);
                if (Array.isArray(modules) && modules.length > 0) {
                    setInstalledModules(new Set(modules.map((m: Record<string, unknown>) => m.code as string)));
                }
                if (Array.isArray(sidebarData)) {
                    setDynamicItems(parseDynamicItems(sidebarData));
                }
            } catch (e) {
                console.error("Failed to fetch sidebar data", e);
            }
        }
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { installedModules, dynamicItems };
}
