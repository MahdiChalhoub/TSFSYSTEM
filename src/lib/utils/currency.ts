/**
 * Shared currency formatting utilities for TSFSYSTEM.
 *
 * Usage (client component):
 *   import { useCurrency, formatCurrency } from '@/lib/utils/currency'
 *   const { fmt } = useCurrency()
 *   <span>{fmt(1500000)}</span>   // → "1 500 000 FCFA"
 *
 * Usage (server component / non-hook context):
 *   import { formatCurrency } from '@/lib/utils/currency'
 *   formatCurrency(1500000, 'EUR')  // → "1 500 000,00 €"
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

// Lightweight in-memory cache so each page doesn't refetch
let _cachedCurrency: string | null = null
let _fetchPromise: Promise<string> | null = null

async function fetchOrgCurrency(): Promise<string> {
    if (_cachedCurrency) return _cachedCurrency
    if (_fetchPromise) return _fetchPromise

    _fetchPromise = fetch('/api/org-currency', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const code = data?.currency || 'XOF'
            _cachedCurrency = code
            return code
        })
        .catch(() => {
            _fetchPromise = null
            return 'XOF'
        })

    return _fetchPromise
}

/** Invalidate cache on settings change */
export function clearCurrencyCache() {
    _cachedCurrency = null
    _fetchPromise = null
}

/**
 * Core formatting function — can be used anywhere (Server or Client).
 * Falls back to XOF on invalid currency codes.
 */
import { formatCurrency } from './currency-core'
export { formatCurrency }

/**
 * React hook — fetches org currency once and returns a bound `fmt()`.
 * Returns a static XOF formatter immediately while the currency loads.
 */
export function useCurrency() {
    const [currency, setCurrency] = useState<string>(_cachedCurrency || 'XOF')

    useEffect(() => {
        if (_cachedCurrency) {
            setCurrency(_cachedCurrency)
            return
        }
        fetchOrgCurrency().then(c => setCurrency(c))
    }, [])

    const fmt = useCallback(
        (n: number) => formatCurrency(n, currency),
        [currency]
    )

    return { fmt, currency }
}
