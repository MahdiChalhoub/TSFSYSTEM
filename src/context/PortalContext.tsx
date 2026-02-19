'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PortalUser {
    id: string
    email: string
    name: string
}

export interface PortalContact {
    id: string
    name: string
    tier?: string
    loyalty_points?: number
    company?: string
    supplier_category?: string
}

export interface PortalOrg {
    id: string
    name: string
    slug: string
}

export interface StorefrontConfig {
    store_mode: 'B2C' | 'B2B' | 'CATALOG_QUOTE' | 'HYBRID'
    storefront_title: string
    storefront_tagline: string
    show_stock_levels: boolean
    allow_guest_browsing: boolean
    ecommerce_enabled: boolean
    loyalty_enabled: boolean
    wallet_enabled: boolean
    tickets_enabled: boolean
    require_approval_for_orders: boolean
}

export interface CartItem {
    product_id: string
    product_name: string
    unit_price: number
    quantity: number
    image_url?: string
    tax_rate: number
}

export interface PortalState {
    // Auth
    token: string | null
    portalType: 'client' | 'supplier' | null
    user: PortalUser | null
    contact: PortalContact | null
    organization: PortalOrg | null
    permissions: string[]
    isAuthenticated: boolean

    // Storefront config
    config: StorefrontConfig | null

    // Cart (client only)
    cart: CartItem[]
    cartTotal: number

    // Actions
    login: (email: string, password: string, slug: string, portalType: 'client' | 'supplier') => Promise<{ success: boolean; error?: string }>
    logout: () => void
    addToCart: (item: CartItem) => void
    removeFromCart: (productId: string) => void
    updateCartQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    loadConfig: (slug: string) => Promise<void>
}

const initialState: PortalState = {
    token: null,
    portalType: null,
    user: null,
    contact: null,
    organization: null,
    permissions: [],
    isAuthenticated: false,
    config: null,
    cart: [],
    cartTotal: 0,
    login: async () => ({ success: false }),
    logout: () => { },
    addToCart: () => { },
    removeFromCart: () => { },
    updateCartQuantity: () => { },
    clearCart: () => { },
    loadConfig: async () => { },
}

const PortalContext = createContext<PortalState>(initialState)

export const usePortal = () => useContext(PortalContext)

// ─── Storage Keys ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'portal_session'
const CART_KEY = 'portal_cart'

function getStoredSession() {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

function getStoredCart(): CartItem[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(CART_KEY)
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function PortalProvider({ children, slug }: { children: React.ReactNode; slug: string }) {
    const [token, setToken] = useState<string | null>(null)
    const [portalType, setPortalType] = useState<'client' | 'supplier' | null>(null)
    const [user, setUser] = useState<PortalUser | null>(null)
    const [contact, setContact] = useState<PortalContact | null>(null)
    const [organization, setOrganization] = useState<PortalOrg | null>(null)
    const [permissions, setPermissions] = useState<string[]>([])
    const [config, setConfig] = useState<StorefrontConfig | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])

    // Hydrate from localStorage
    useEffect(() => {
        const session = getStoredSession()
        if (session && session.organization?.slug === slug) {
            setToken(session.token)
            setPortalType(session.portalType)
            setUser(session.user)
            setContact(session.contact)
            setOrganization(session.organization)
            setPermissions(session.permissions || [])
        }
        setCart(getStoredCart())
    }, [slug])

    // Persist cart
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CART_KEY, JSON.stringify(cart))
        }
    }, [cart])

    const cartTotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

    const login = useCallback(async (email: string, password: string, loginSlug: string, type: 'client' | 'supplier') => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        const endpoint = type === 'client'
            ? `${djangoUrl}/api/client-portal/auth/login/`
            : `${djangoUrl}/api/supplier-portal/auth/login/`

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, slug: loginSlug }),
            })
            const data = await res.json()

            if (!res.ok) {
                return { success: false, error: data.error || 'Login failed' }
            }

            // Store session
            const session = {
                token: data.token,
                portalType: type,
                user: data.user,
                contact: data.contact,
                organization: data.organization,
                permissions: data.permissions,
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

            setToken(data.token)
            setPortalType(type)
            setUser(data.user)
            setContact(data.contact)
            setOrganization(data.organization)
            setPermissions(data.permissions || [])

            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message || 'Network error' }
        }
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setPortalType(null)
        setUser(null)
        setContact(null)
        setOrganization(null)
        setPermissions([])
    }, [])

    const addToCart = useCallback((item: CartItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.product_id === item.product_id)
            if (existing) {
                return prev.map(i =>
                    i.product_id === item.product_id
                        ? { ...i, quantity: i.quantity + item.quantity }
                        : i
                )
            }
            return [...prev, item]
        })
    }, [])

    const removeFromCart = useCallback((productId: string) => {
        setCart(prev => prev.filter(i => i.product_id !== productId))
    }, [])

    const updateCartQuantity = useCallback((productId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(prev => prev.filter(i => i.product_id !== productId))
        } else {
            setCart(prev => prev.map(i =>
                i.product_id === productId ? { ...i, quantity } : i
            ))
        }
    }, [])

    const clearCart = useCallback(() => {
        setCart([])
        localStorage.removeItem(CART_KEY)
    }, [])

    const loadConfig = useCallback(async (configSlug: string) => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/storefront/config/?slug=${configSlug}`)
            if (res.ok) {
                const data = await res.json()
                setConfig(data)
            }
        } catch (err) {
            console.error('[Portal] Failed to load config:', err)
        }
    }, [])

    return (
        <PortalContext.Provider value={{
            token,
            portalType,
            user,
            contact,
            organization,
            permissions,
            isAuthenticated: !!token,
            config,
            cart,
            cartTotal,
            login,
            logout,
            addToCart,
            removeFromCart,
            updateCartQuantity,
            clearCart,
            loadConfig,
        }}>
            {children}
        </PortalContext.Provider>
    )
}
