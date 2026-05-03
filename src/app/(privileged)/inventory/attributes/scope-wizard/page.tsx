import { listScopeSuggestions } from '@/app/actions/inventory/scope-suggestions'
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
 * SSR pre-fetches the initial list so the page is interactive on first
 * paint with no spinner.
 */
export default async function ScopeWizardPage() {
    const suggestions = await listScopeSuggestions()
    return <ScopeWizardClient initialSuggestions={suggestions} />
}
