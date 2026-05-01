'use server'

import { cookies } from 'next/headers'
import { erpFetch, handleAuthError } from '@/lib/erp-api'

const STORE_TOKEN_COOKIE = 'store_token'
const STORE_USER_COOKIE = 'store_user'

export interface StoreUser {
    id: number
    email: string
    name: string
    contact_id?: number
}

// ── Login ─────────────────────────────────────────────────────────────────

export async function clientLogin(
    email: string,
    password: string,
): Promise<{ ok: boolean; user?: StoreUser; error?: string }> {
    const res = await erpFetch('client-portal/portal-auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        return { ok: false, error: data.error || data.detail || 'Invalid email or password' }
    }
    const token: string = data.token ?? data.key ?? data.access ?? ''
    const user: StoreUser = {
        id: data.user?.id ?? data.id ?? 0,
        email: data.user?.email ?? data.email ?? email,
        name: data.user?.name ?? data.name ?? '',
        contact_id: data.contact_id,
    }
    const jar = await cookies()
    jar.set(STORE_TOKEN_COOKIE, token, { path: '/store', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    jar.set(STORE_USER_COOKIE, JSON.stringify(user), { path: '/store', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    return { ok: true, user }
}

// ── Logout ────────────────────────────────────────────────────────────────

export async function clientLogout(): Promise<void> {
    const jar = await cookies()
    jar.delete(STORE_TOKEN_COOKIE)
    jar.delete(STORE_USER_COOKIE)
}

// ── Get current user (server side) ────────────────────────────────────────

export async function getClientUser(): Promise<StoreUser | null> {
    try {
        const jar = await cookies()
        const raw = jar.get(STORE_USER_COOKIE)?.value
        if (!raw) return null
        return JSON.parse(raw) as StoreUser
    } catch (error) {        handleAuthError(error)
 return null }
}

export async function getStoreToken(): Promise<string | null> {
    const jar = await cookies()
    return jar.get(STORE_TOKEN_COOKIE)?.value ?? null
}

// ── Register (self-service) ───────────────────────────────────────────────

export async function clientRegister(payload: {
    name: string
    email: string
    password: string
    phone?: string
}): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch('client-portal/portal-auth/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const msgs = Object.values(data).flat().join(' ')
        return { ok: false, error: msgs || 'Registration failed' }
    }
    return { ok: true }
}

// ── Storefront Public Config ───────────────────────────────────────────────

export interface StorefrontConfig {
    storefront_title: string
    storefront_tagline: string | null
    storefront_theme: string
    ecommerce_enabled: boolean
    loyalty_enabled: boolean
    wallet_enabled: boolean
    allow_guest_browsing: boolean
    stripe_publishable_key: string | null
}

export async function getStorefrontPublicConfig(): Promise<StorefrontConfig | null> {
    try {
        const jar = await cookies()
        const slug = jar.get('org_slug')?.value ?? ''
        if (!slug) return null
        const res = await erpFetch(`storefront/config/?slug=${encodeURIComponent(slug)}`, {
            method: 'GET',
        })
        if (!res.ok) return null
        return await res.json()
    } catch (error) {        handleAuthError(error)
 return null }
}
