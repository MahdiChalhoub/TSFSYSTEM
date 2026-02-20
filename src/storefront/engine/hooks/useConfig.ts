'use client'

import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import type { UseConfigReturn, StorefrontConfig } from '../types'

/**
 * useConfig — Storefront Engine Hook
 * Provides storefront configuration, store mode, and org info.
 */
export function useConfig(): UseConfigReturn {
    const ctx = usePortal()
    const params = useParams<{ slug: string }>()

    const config = ctx.config as StorefrontConfig | null
    const storeMode = config?.store_mode || 'HYBRID'

    return {
        config,
        storeMode,
        orgName: ctx.organization?.name || '',
        orgLogo: ctx.organization?.logo,
        slug: params?.slug || '',
        showPrice: storeMode !== 'CATALOG_QUOTE',
        isQuoteMode: storeMode === 'CATALOG_QUOTE',
    }
}
