'use client';

import React from 'react';
import { useScope } from '@/hooks/useScope';

type Scope = 'OFFICIAL' | 'INTERNAL';

interface ScopeGateProps {
    /** Which scope(s) should see this content */
    scope: Scope | Scope[];
    /** Content to render when scope matches */
    children: React.ReactNode;
    /**
     * Optional fallback rendered when scope does NOT match.
     * Defaults to null (renders nothing).
     */
    fallback?: React.ReactNode;
}

/**
 * ScopeGate — conditionally renders children based on the active view scope.
 *
 * Usage:
 *   <ScopeGate scope="internal">
 *     <MarginAnalysis />   // only visible in INTERNAL view
 *   </ScopeGate>
 *
 *   <ScopeGate scope="official" fallback={<PublicPrice />}>
 *     <InternalCostBreakdown />
 *   </ScopeGate>
 *
 *   <ScopeGate scope={['official', 'internal']}>
 *     <AlwaysVisible />
 *   </ScopeGate>
 */
export function ScopeGate({ scope, children, fallback = null }: ScopeGateProps) {
    const { scope: activeScope } = useScope();

    const allowed = Array.isArray(scope)
        ? scope.map(s => s.toUpperCase()).includes(activeScope)
        : scope.toUpperCase() === activeScope;

    return <>{allowed ? children : fallback}</>;
}

/**
 * OfficialOnly — renders children only in OFFICIAL scope.
 *
 * Usage:
 *   <OfficialOnly>
 *     <ClientFacingPrice />
 *   </OfficialOnly>
 */
export function OfficialOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <ScopeGate scope="OFFICIAL" fallback={fallback}>{children}</ScopeGate>;
}

/**
 * InternalOnly — renders children only in INTERNAL scope.
 *
 * Usage:
 *   <InternalOnly>
 *     <MarginAnalysis />
 *   </InternalOnly>
 */
export function InternalOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <ScopeGate scope="INTERNAL" fallback={fallback}>{children}</ScopeGate>;
}
