import { getAIScopeConfig } from '@/app/actions/inventory/scope-suggestions'
import { listCategoryRuleSuggestions } from '@/app/actions/inventory/category-rule-suggestions'
import { CategoryRuleWizardClient } from './CategoryRuleWizardClient'

/**
 * Phase 7 — Category creation-rule wizard.
 *
 * URL: /inventory/categories/rule-wizard
 *
 * For every category that has 3+ products and no creation rule yet,
 * proposes a default rule based on what the existing products already
 * have (barcode? brand? unit? photo? supplier?). When AI ranking is
 * on, each suggestion gets a verdict + per-field endorsement so the
 * operator can accept, cherry-pick fields, or skip.
 *
 * Shares AIScopeSuggesterConfig with the scope wizard — one toggle
 * powers AI ranking everywhere.
 */
export default async function CategoryRuleWizardPage() {
    const aiConfig = await getAIScopeConfig()
    const aiOn = !!aiConfig?.enabled && !!aiConfig?.has_provider
    const suggestions = await listCategoryRuleSuggestions(undefined, { ai: aiOn })
    return (
        <CategoryRuleWizardClient
            initialSuggestions={suggestions}
            initialAIConfig={aiConfig}
        />
    )
}
