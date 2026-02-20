'use client'

import { useMemo } from 'react'
import { usePortal } from '@/context/PortalContext'
import type { UseCartReturn, CartItem } from '../types'

/**
 * useCart — Storefront Engine Hook
 * Thin wrapper over PortalContext cart. Themes use this to manage the shopping cart.
 */
export function useCart(): UseCartReturn {
    const ctx = usePortal()

    const cartTotal = useMemo(() => {
        return ctx.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
    }, [ctx.cart])

    const cartCount = useMemo(() => {
        return ctx.cart.reduce((sum, item) => sum + item.quantity, 0)
    }, [ctx.cart])

    return {
        cart: ctx.cart as CartItem[],
        cartCount,
        cartTotal,
        addToCart: ctx.addToCart as (item: CartItem) => void,
        removeFromCart: ctx.removeFromCart,
        updateQuantity: ctx.updateCartQuantity,
        clearCart: ctx.clearCart,
    }
}
