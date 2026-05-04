import { getAIScopeConfig, listScopeSuggestions } from '@/app/actions/inventory/scope-suggestions'
import { ScopeWizardClient } from './ScopeWizardClient'

/**
 * Phase 3 of multi-dim attribute scoping — operator review wizard.
 *
 * URL: /inventory/attributes/scope-wizard
 *
 * Lists every attribute value the backend has a scope suggestion for,
 * grouped by attribute group (Flavor / Size / Color …). Each row shows
 * current scope, suggested scope, and confidence per axis. Operator
 * accepts or skips per row; accepted suggestions PATCH back via
 * applyScopeSuggestion.
 *
 * Phase 6: when the org has opted into the AI ranker, the initial fetch
 * already comes back enriched with verdict + rationale so the wizard
 * is interactive on first paint with no AI-loading spinner. The toggle
 * inside the wizard re-fetches with `ai=0` for an instant deterministic
 * view if the operator wants to inspect raw signal.
 */
export default async function ScopeWizardPage() {
    // Look up AI opt-in once, then make a single SSR fetch with the
    // correct `ai` flag. Cuts a second round-trip on first load.
    const aiConfig = await getAIScopeConfig()
    const aiOn = !!aiConfig?.enabled && !!aiConfig?.has_provider
    const suggestions = await listScopeSuggestions(undefined, { ai: aiOn })
    return (
        <ScopeWizardClient
            initialSuggestions={suggestions}
            initialAIConfig={aiConfig}
        />
    )
}
