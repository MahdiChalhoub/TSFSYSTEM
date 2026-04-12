'use client'

import { usePortal } from '@/context/PortalContext'
import type { UseAuthReturn, CustomerUser } from '../types'

/**
 * useAuth — Storefront Engine Hook
 * Wraps PortalContext auth. Themes use this for customer login/logout.
 */
export function useAuth(): UseAuthReturn {
    const ctx = usePortal()

    return {
        user: ctx.user ? {
            id: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.name,
            tier: ctx.contact?.tier,
            loyalty_points: ctx.contact?.loyalty_points,
            barcode: undefined,
        } as CustomerUser : null,
        isAuthenticated: ctx.isAuthenticated,
        loading: false,
        login: (email: string, password: string) => ctx.login(email, password, '', 'client'),
        logout: ctx.logout,
    }
}
