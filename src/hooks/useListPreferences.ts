'use client';

import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-fetch';
import type { ListPreferences } from '@/components/universal-list/types';

/**
 * Hook to fetch and manage list preferences for a specific list key.
 * Cascading: user preference → org default → component defaults.
 */
export function useListPreferences(
    listKey: string,
    defaultColumns: string[]
) {
    const [preferences, setPreferences] = useState<ListPreferences>({
        source: 'default',
        list_key: listKey,
        visible_columns: defaultColumns,
        default_filters: {},
        page_size: 25,
        sort_column: '',
        sort_direction: 'asc',
    });
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const data = await erpFetch(`list-preferences/${listKey}/`);
                if (data && data.visible_columns && data.visible_columns.length > 0) {
                    setPreferences(data);
                }
            } catch {
                // Use component defaults on error
            } finally {
                setLoaded(true);
            }
        }
        load();
    }, [listKey]);

    const updatePreferences = useCallback(async (updates: Partial<ListPreferences>) => {
        const merged = { ...preferences, ...updates };
        setPreferences(merged);

        try {
            await erpFetch(`list-preferences/${listKey}/`, {
                method: 'PUT',
                body: JSON.stringify({
                    visible_columns: merged.visible_columns,
                    default_filters: merged.default_filters,
                    page_size: merged.page_size,
                    sort_column: merged.sort_column,
                    sort_direction: merged.sort_direction,
                }),
            });
        } catch {
            // Silently fail — preference is still in local state
        }
    }, [listKey, preferences]);

    const setVisibleColumns = useCallback((columns: string[]) => {
        updatePreferences({ visible_columns: columns });
    }, [updatePreferences]);

    const setPageSize = useCallback((size: number) => {
        updatePreferences({ page_size: size });
    }, [updatePreferences]);

    const setSort = useCallback((column: string, direction: 'asc' | 'desc') => {
        updatePreferences({ sort_column: column, sort_direction: direction });
    }, [updatePreferences]);

    return {
        preferences,
        loaded,
        setVisibleColumns,
        setPageSize,
        setSort,
        updatePreferences,
    };
}
