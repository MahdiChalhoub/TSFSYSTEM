import TemplatesPageClient from './TemplatesPageClient'
import {
    getTemplateKeys,
    getFullTemplate,
    getAllTemplateMetadata,
    getMigrationHints,
} from '@/data/coa-templates'

// Count all accounts recursively
function countAccounts(items: any[]): number {
    let c = 0
    for (const item of items) {
        c += 1
        if (item.children) c += countAccounts(item.children)
    }
    return c
}

export default async function TemplatesLibraryPage() {
    const keys = getTemplateKeys()
    const allMeta = getAllTemplateMetadata()

    const templates = keys.map(key => {
        const meta = allMeta[key]
        const full = getFullTemplate(key)
        const accountCount = full ? countAccounts(full.accounts) : 0

        return {
            key,
            name: meta?.name || key.replace(/_/g, ' '),
            region: meta?.region || 'Unknown',
            description: meta?.description || '',
            icon: meta?.icon || 'Globe',
            accent_color: meta?.accent_color || 'var(--app-primary)',
            version: meta?.version || '1.0.0',
            last_updated: meta?.last_updated || '',
            is_system: true,
            is_custom: false,
            account_count: accountCount,
            posting_rule_count: full?.posting_rules?.length || 0,
        }
    })

    const templatesMap: Record<string, any> = {}
    for (const key of keys) {
        const full = getFullTemplate(key)
        if (full) {
            templatesMap[key] = {
                key,
                name: full.metadata.name,
                accounts: full.accounts,
                account_count: countAccounts(full.accounts),
                posting_rules: full.posting_rules || [],
                migration_hints: full.migration_hints || {},
            }
        }
    }

    // Pre-compute all migration maps between templates
    const migrationMaps: Record<string, Record<string, string>> = {}
    for (const sourceKey of keys) {
        for (const targetKey of keys) {
            if (sourceKey === targetKey) continue
            const hints = getMigrationHints(sourceKey, targetKey)
            if (Object.keys(hints).length > 0) {
                migrationMaps[`${sourceKey}→${targetKey}`] = hints
            }
        }
    }

    return (
        <TemplatesPageClient
            templates={templates}
            templatesMap={templatesMap}
            migrationMaps={migrationMaps}
        />
    )
}
