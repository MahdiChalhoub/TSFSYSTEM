/**
 * Field metadata definitions.
 * Used by FieldHelp, DefaultValueHint, and ValidationDot components.
 */
export interface FieldMeta {
    key: string;
    label: string;
    section: string;
    description: string;
    defaultValue?: any;
    validationRule?: (value: any) => 'ok' | 'warn' | 'error';
}

/**
 * Create a field metadata registry from an array of definitions.
 */
export function createFieldRegistry(fields: FieldMeta[]): {
    byKey: Record<string, FieldMeta>;
    bySection: Record<string, FieldMeta[]>;
    searchable: Array<{ key: string; label: string; section: string }>;
    defaults: Record<string, any>;
    helpMap: Record<string, string>;
} {
    const byKey: Record<string, FieldMeta> = {};
    const bySection: Record<string, FieldMeta[]> = {};
    const defaults: Record<string, any> = {};
    const helpMap: Record<string, string> = {};

    for (const field of fields) {
        byKey[field.key] = field;
        if (!bySection[field.section]) bySection[field.section] = [];
        bySection[field.section].push(field);
        if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue;
        if (field.description) helpMap[field.key] = field.description;
    }

    const searchable = fields.map(f => ({ key: f.key, label: f.label, section: f.section }));

    return { byKey, bySection, searchable, defaults, helpMap };
}
