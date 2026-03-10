'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * usePermissions — Client-side RBAC enforcement hook.
 * 
 * Fetches the current user's permissions from the backend once,
 * caches them, and provides helper methods for checking permissions:
 * 
 * Usage:
 *   const { can, canAny, isAdmin, loading } = usePermissions()
 *   if (can('crm.create_contact')) { ... }
 *   if (canAny(['crm.create_contact', 'crm.edit_contact'])) { ... }
 */

interface PermissionsState {
    permissions: string[]
    role: string | null
    isAdmin: boolean
    loading: boolean
}

const CACHE_KEY = 'tsf_permissions_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached(): PermissionsState | null {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY)
        if (!raw) return null
        const cached = JSON.parse(raw)
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            sessionStorage.removeItem(CACHE_KEY)
            return null
        }
        return cached.state
    } catch {
        return null
    }
}

function setCache(state: PermissionsState) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ state, timestamp: Date.now() }))
    } catch {
        // sessionStorage not available (SSR)
    }
}

export function usePermissions() {
    const [state, setState] = useState<PermissionsState>(() => {
        const cached = typeof window !== 'undefined' ? getCached() : null
        return cached || { permissions: [], role: null, isAdmin: false, loading: true }
    })

    useEffect(() => {
        // If we already have cached data, don't re-fetch
        if (state.permissions.length > 0 && !state.loading) return

        let cancelled = false

        async function fetchPermissions() {
            try {
                const res = await fetch('/api/proxy/users/my-permissions/', {
                    credentials: 'include',
                })
                if (!res.ok) throw new Error('Failed to fetch permissions')
                const data = await res.json()

                const newState: PermissionsState = {
                    permissions: data.permissions || [],
                    role: data.role || null,
                    isAdmin: data.is_superuser === true,
                    loading: false,
                }

                if (!cancelled) {
                    setState(newState)
                    setCache(newState)
                }
            } catch {
                if (!cancelled) {
                    setState(prev => ({ ...prev, loading: false }))
                }
            }
        }

        fetchPermissions()
        return () => { cancelled = true }
    }, [])

    /** Check if the user has a specific permission */
    const can = useCallback((code: string): boolean => {
        if (state.isAdmin) return true
        return state.permissions.includes(code)
    }, [state.permissions, state.isAdmin])

    /** Check if the user has ANY of the given permissions */
    const canAny = useCallback((codes: string[]): boolean => {
        if (state.isAdmin) return true
        return codes.some(code => state.permissions.includes(code))
    }, [state.permissions, state.isAdmin])

    /** Check if the user has ALL of the given permissions */
    const canAll = useCallback((codes: string[]): boolean => {
        if (state.isAdmin) return true
        return codes.every(code => state.permissions.includes(code))
    }, [state.permissions, state.isAdmin])

    /** Invalidate the cache so next mount re-fetches */
    const invalidate = useCallback(() => {
        sessionStorage.removeItem(CACHE_KEY)
        setState(prev => ({ ...prev, loading: true }))
    }, [])

    return {
        ...state,
        can,
        canAny,
        canAll,
        invalidate,
    }
}
