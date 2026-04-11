'use client';
import { useState, useCallback } from 'react';

export interface SearchableField {
    key: string;
    label: string;
    section?: string;
}

export function useConfigSearch(fields: SearchableField[]) {
    const [search, setSearch] = useState('');

    const isVisible = useCallback((fieldKey: string) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        const field = fields.find(f => f.key === fieldKey);
        if (!field) return true;
        return field.label.toLowerCase().includes(term) ||
            field.key.toLowerCase().includes(term) ||
            (field.section?.toLowerCase().includes(term) ?? false);
    }, [search, fields]);

    const isSectionVisible = useCallback((sectionKey: string) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return sectionKey.toLowerCase().includes(term) ||
            fields.some(f => f.section === sectionKey && (
                f.label.toLowerCase().includes(term) || f.key.toLowerCase().includes(term)
            ));
    }, [search, fields]);

    const matchCount = search.trim()
        ? fields.filter(f => isVisible(f.key)).length
        : fields.length;

    return { search, setSearch, isVisible, isSectionVisible, matchCount };
}
