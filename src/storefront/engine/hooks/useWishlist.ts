'use client'

import { usePortal } from '@/context/PortalContext'
import type { UseWishlistReturn } from '../types'

/**
 * useWishlist — Storefront Engine Hook
 * Wraps PortalContext wishlist functionality.
 */
export function useWishlist(): UseWishlistReturn {
    const ctx = usePortal()

    return {
        wishlist: ctx.wishlist,
        wishlistCount: ctx.wishlistCount,
        isInWishlist: ctx.isInWishlist,
        toggleWishlist: ctx.toggleWishlist,
    }
}
