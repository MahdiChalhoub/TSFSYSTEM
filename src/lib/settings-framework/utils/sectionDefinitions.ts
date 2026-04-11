/**
 * Section-to-fields mapping for section-level resets.
 */
export interface SectionDefinition {
    id: string;
    label: string;
    subtitle?: string;
    icon?: string;
    fields: string[];
}

/**
 * Reset a section's fields to defaults.
 */
export function resetSectionFields<T extends Record<string, any>>(
    config: T,
    section: SectionDefinition,
    defaults: Record<string, any>
): T {
    const result = { ...config };
    for (const field of section.fields) {
        if (field in defaults) {
            (result as any)[field] = defaults[field];
        }
    }
    return result;
}

/**
 * Check config completeness based on sections.
 */
export function calculateCompleteness(
    config: Record<string, any>,
    fields: string[]
): number {
    if (fields.length === 0) return 100;
    let filled = 0;
    for (const f of fields) {
        const v = config[f];
        if (v !== undefined && v !== null && v !== '' && v !== 0) filled++;
    }
    return Math.round((filled / fields.length) * 100);
}
