#!/bin/bash
# Script to create GitHub issues using the `gh` CLI.
# Ensure you are logged in using `gh auth login` before running this.

echo "Creating GitHub issues for TSFSYSTEM Remediation Sprint..."

# C1
gh issue create --title "[CRITICAL] Dashboard Hardcoded Fake Metrics" \
--body "The dashboard displays hardcoded \`resolutionRate = 84.2\` and other fake metrics. Replace with real backend-computed metrics or disable." \
--label "bug,critical,frontend"

# C2
gh issue create --title "[CRITICAL] Dashboard Buttons Do Nothing" \
--body "\"Network View\" and \"Extract Report\" on the Dashboard do nothing on click. Trigger real features or hide them." \
--label "bug,critical,ux"

# C3
gh issue create --title "[CRITICAL] Invoices Page Passes Unfiltered Data" \
--body "The \`<TypicalListView>\` receives the raw unfiltered invoices array instead of the \`filtered\` array, meaning tab filters (DRAFT, SENT, OVERDUE) fail." \
--label "bug,critical,finance"

# C4
gh issue create --title "[CRITICAL] Duplicate POSLobby Components" \
--body "\`src/components/pos/POSLobby.tsx\` is an unmaintainable 77KB monolith and has a duplicate. Consolidate and split into <300 line subcomponents." \
--label "refactor,critical,pos"

# C5
gh issue create --title "[CRITICAL] POSLayoutModern.tsx.top Stale File" \
--body "There is an invalid \`.tsx.top\` file that needs to be deleted to avoid confusion and bundle issues." \
--label "cleanup,tech-debt"

# C6
gh issue create --title "[CRITICAL] filteredClients Used Without Declaration" \
--body "\`POSLayoutClassic.tsx\` references a \`filteredClients\` array that isn't declared, causing a potential runtime crash when searching clients." \
--label "bug,critical,pos"

# H1
gh issue create --title "[HIGH] No Shared Design System" \
--body "Codebase lacks visual cohesion (3-4 different accent colors, varying border radii). Unify components." \
--label "design-system,high"

# H2
gh issue create --title "[HIGH] Inconsistent Page Containers" \
--body "Page wrappers differ widely across modules. Unify them under one layout structure." \
--label "design-system,high"

# H3
gh issue create --title "[HIGH] Mixed Data Fetching Patterns" \
--body "Standardize data fetching approaches (Server components vs Client useEffect vs Server Actions)." \
--label "architecture,high"

# H4
gh issue create --title "[HIGH] Missing Dedicated Action Files" \
--body "Only 14 action files exist for 91 pages. Extract data fetching from pages into dedicated modular \`actions.ts\` files." \
--label "architecture,high"

# H5
gh issue create --title "[HIGH] 53 Pages Exceeding 15KB Monolith Limit" \
--body "Over half the application's pages are monolithic. Systematically apply the refactor-and-audit workflow." \
--label "refactor,high"

# H6
gh issue create --title "[HIGH] Excessive \"any\" Type Usage" \
--body "Components are missing structured types, heavily relying on \`any\`. Add proper TypeScript interfaces inside \`src/types/\`." \
--label "typescript,high"

# H7
gh issue create --title "[HIGH] Unconnected Batch Import Button" \
--body "The Batch Import button on Invoices throws a dummy toast. Implement it or hide it." \
--label "ux,high"

# H8
gh issue create --title "[HIGH] Manual camelCase Mapping Fragility" \
--body "\`Contacts\` page manually remaps snake_case strings. Create an interceptor or use camelize-ts." \
--label "architecture,high"

# H9
gh issue create --title "[HIGH] Missing Error Boundaries" \
--body "Only root layout has an \`error.tsx\`. Add module-level boundaries (\`finance/error.tsx\`, etc.) to prevent app-wide crashes." \
--label "reliability,high"

# H10
gh issue create --title "[HIGH] console.error Leaks in Production" \
--body "\`console.error\` logs are left in components like \`contacts/page.tsx\`. Clean them up." \
--label "cleanup,high"

echo "✅ Created 16 issues (Critical & High)."
