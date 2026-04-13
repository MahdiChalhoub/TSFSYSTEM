'use client';

import { useAdmin } from '@/context/AdminContext';

/**
 * Scope hook — clean API for pages/components to read the current view scope.
 *
 * Usage:
 *   const { scope, isOfficial, isInternal } = useScope();
 *
 * - `scope`      : 'OFFICIAL' | 'INTERNAL'
 * - `isOfficial` : true when user is viewing official (public-facing) data only
 * - `isInternal` : true when user is viewing full internal data
 */
export function useScope() {
    const { viewScope, scopeAccess, canToggleScope } = useAdmin();

    return {
        /** Current active scope */
        scope: viewScope,
        /** True when viewing official data only */
        isOfficial: viewScope === 'OFFICIAL',
        /** True when viewing full internal data */
        isInternal: viewScope === 'INTERNAL',
        /** Access level granted at login */
        scopeAccess,
        /** Whether the user can switch scopes */
        canToggleScope,
    };
}
