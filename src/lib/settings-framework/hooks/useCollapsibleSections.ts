'use client';
import { useState, useEffect, useCallback } from 'react';

export function useCollapsibleSections(sectionIds: string[]) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [allCollapsed, setAllCollapsed] = useState(false);

    const toggleSection = useCallback((id: string) => {
        setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const expandAll = useCallback(() => {
        setAllCollapsed(false);
    }, []);

    const collapseAll = useCallback(() => {
        setAllCollapsed(true);
    }, []);

    const toggleAll = useCallback(() => {
        setAllCollapsed(prev => !prev);
    }, []);

    // Serialize to string for stable dependency (avoids infinite loop when parent passes new array ref)
    const sectionKey = sectionIds.join(',');

    useEffect(() => {
        setCollapsed(Object.fromEntries(sectionIds.map(s => [s, allCollapsed])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allCollapsed, sectionKey]);

    const isCollapsed = useCallback((id: string) => !!collapsed[id], [collapsed]);

    return { collapsed, toggleSection, expandAll, collapseAll, toggleAll, allCollapsed, isCollapsed };
}
