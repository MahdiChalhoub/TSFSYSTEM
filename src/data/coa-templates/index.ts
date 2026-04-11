/**
 * COA Template Loader — Dynamic JSON-based Chart of Accounts Templates
 *
 * All template data is stored in JSON files at src/data/coa-templates/*.json
 * This loader imports them and provides the same interface as the old hardcoded system.
 *
 * To add a new template:
 *   1. Create a new JSON file in src/data/coa-templates/ (copy any existing one)
 *   2. Import it below and add it to TEMPLATE_REGISTRY
 *   3. That's it — the template will appear in the UI automatically
 *
 * JSON Schema per template file:
 *   {
 *     "metadata":        { key, name, region, description, icon, accent_color, version, last_updated }
 *     "accounts":        [ { code, name, type, subType?, children? ... } ]
 *     "posting_rules":   [ { event_code, account_code, module, description } ]
 *     "migration_hints": { "to_TARGET_KEY": { "source_code": "target_code" } }
 *   }
 */

// ─── JSON Imports ──────────────────────────────────────────────
import IFRS_COA_DATA from '@/data/coa-templates/IFRS_COA.json'
import LEBANESE_PCN_DATA from '@/data/coa-templates/LEBANESE_PCN.json'
import FRENCH_PCG_DATA from '@/data/coa-templates/FRENCH_PCG.json'
import USA_GAAP_DATA from '@/data/coa-templates/USA_GAAP.json'
import SYSCOHADA_REVISED_DATA from '@/data/coa-templates/SYSCOHADA_REVISED.json'

// ─── Types ─────────────────────────────────────────────────────
export type TemplateAccount = {
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
    subType?: string
    syscohadaCode?: string
    syscohadaClass?: string
    isSystemOnly?: boolean
    isHidden?: boolean
    requiresZeroBalance?: boolean
    children?: TemplateAccount[]
}

export type TemplatePostingRule = {
    event_code: string
    account_code: string
    module: string
    description: string
}

export type TemplateMigrationHints = {
    [targetKey: string]: Record<string, string>
}

export type TemplateMetadata = {
    key: string
    name: string
    region: string
    description: string
    icon: string
    accent_color: string
    version: string
    last_updated: string
}

export type COATemplateData = {
    metadata: TemplateMetadata
    accounts: TemplateAccount[]
    posting_rules: TemplatePostingRule[]
    migration_hints: TemplateMigrationHints
}

// ─── Template Registry ─────────────────────────────────────────
// Add new templates here after creating their JSON file
const TEMPLATE_REGISTRY: Record<string, COATemplateData> = {
    IFRS_COA: IFRS_COA_DATA as COATemplateData,
    LEBANESE_PCN: LEBANESE_PCN_DATA as COATemplateData,
    FRENCH_PCG: FRENCH_PCG_DATA as COATemplateData,
    USA_GAAP: USA_GAAP_DATA as COATemplateData,
    SYSCOHADA_REVISED: SYSCOHADA_REVISED_DATA as COATemplateData,
}

// ─── Public API ────────────────────────────────────────────────

/** Get all template keys */
export function getTemplateKeys(): string[] {
    return Object.keys(TEMPLATE_REGISTRY)
}

/** Get all templates as { KEY: accounts[] } — backward-compatible with old TEMPLATES constant */
export function getAllTemplateAccounts(): Record<string, TemplateAccount[]> {
    const result: Record<string, TemplateAccount[]> = {}
    for (const [key, data] of Object.entries(TEMPLATE_REGISTRY)) {
        result[key] = data.accounts
    }
    return result
}

/** Get accounts for a specific template */
export function getTemplateAccounts(key: string): TemplateAccount[] | null {
    return TEMPLATE_REGISTRY[key]?.accounts ?? null
}

/** Get full template data (metadata + accounts + rules + hints) */
export function getFullTemplate(key: string): COATemplateData | null {
    return TEMPLATE_REGISTRY[key] ?? null
}

/** Get posting rules for a specific template */
export function getTemplatePostingRules(key: string): TemplatePostingRule[] {
    return TEMPLATE_REGISTRY[key]?.posting_rules ?? []
}

/** Get migration hints from one template to another */
export function getMigrationHints(sourceKey: string, targetKey: string): Record<string, string> {
    const hintKey = `to_${targetKey}`
    return TEMPLATE_REGISTRY[sourceKey]?.migration_hints?.[hintKey] ?? {}
}

/** Get metadata for a specific template */
export function getTemplateMetadata(key: string): TemplateMetadata | null {
    return TEMPLATE_REGISTRY[key]?.metadata ?? null
}

/** Get all template metadata (for listing in UI) */
export function getAllTemplateMetadata(): Record<string, TemplateMetadata> {
    const result: Record<string, TemplateMetadata> = {}
    for (const [key, data] of Object.entries(TEMPLATE_REGISTRY)) {
        result[key] = data.metadata
    }
    return result
}

/** Check if a template key exists */
export function templateExists(key: string): boolean {
    return key in TEMPLATE_REGISTRY
}

/** Backward compatibility — the old TEMPLATES constant */
export const TEMPLATES = getAllTemplateAccounts()
