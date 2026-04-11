// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_KEY = 'tsf_product_draft';
const DEBOUNCE_MS = 1500;

interface DraftData {
    savedAt: string;
    fields: Record<string, string>;
}

/**
 * Hook: Persists product form fields to localStorage with debounce.
 *
 * Usage:
 *   const { hasDraft, restoreDraft, clearDraft, saveDraft } = useProductDraft();
 *
 * Call saveDraft() from form onChange, or saveDraft(formRef.current) to serialize all fields.
 * Call restoreDraft(formRef) to push saved values back into form fields.
 */
export function useProductDraft() {
    const [hasDraft, setHasDraft] = useState(false);
    const [draftAge, setDraftAge] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Check for existing draft on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) {
                const draft: DraftData = JSON.parse(raw);
                const name = draft.fields?.name;
                if (name && name.trim()) {
                    setHasDraft(true);
                    const ago = getTimeAgo(draft.savedAt);
                    setDraftAge(ago);
                }
            }
        } catch {
            // Corrupt draft, ignore
        }
    }, []);

    /**
     * Serialize all named inputs in a form element and debounce-save to localStorage.
     */
    const saveDraft = useCallback((form: HTMLFormElement | null) => {
        if (!form) return;
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            try {
                const formData = new FormData(form);
                const fields: Record<string, string> = {};
                formData.forEach((value, key) => {
                    if (typeof value === 'string') {
                        fields[key] = value;
                    }
                });

                // Only save if there's meaningful data (at least a name)
                if (fields.name && fields.name.trim()) {
                    const draft: DraftData = {
                        savedAt: new Date().toISOString(),
                        fields,
                    };
                    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                }
            } catch {
                // localStorage full or unavailable
            }
        }, DEBOUNCE_MS);
    }, []);

    /**
     * Restore saved draft values into a form's named inputs.
     */
    const restoreDraft = useCallback((form: HTMLFormElement | null): Record<string, string> | null => {
        if (!form) return null;
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return null;

            const draft: DraftData = JSON.parse(raw);
            const fields = draft.fields;

            // Push values into form inputs
            Object.entries(fields).forEach(([key, value]) => {
                const el = form.elements.namedItem(key);
                if (el && 'value' in el) {
                    (el as HTMLInputElement).value = value;
                }
                if (el && 'checked' in el && (value === 'on' || value === 'true')) {
                    (el as HTMLInputElement).checked = true;
                }
            });

            setHasDraft(false);
            return fields;
        } catch {
            return null;
        }
    }, []);

    /**
     * Clear the saved draft.
     */
    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch {
            // ignore
        }
        setHasDraft(false);
    }, []);

    return { hasDraft, draftAge, saveDraft, restoreDraft, clearDraft };
}

function getTimeAgo(isoString: string): string {
    try {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    } catch {
        return 'recently';
    }
}
