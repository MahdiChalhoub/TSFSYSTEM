'use client';

/**
 * FavoritesContext — Optimized, single source of truth
 * =====================================================
 * Architecture:
 * 1. Mount: hydrate from localStorage immediately (zero flash), then
 *    reconcile with backend (cross-device source of truth).
 * 2. Mutations: optimistic state update → localStorage → debounced backend save.
 *    All saves use the latest state snapshot from a ref, not a closure —
 *    eliminates stale-closure race conditions from rapid toggles.
 * 3. Cross-tab sync: native `storage` event (fires only in OTHER tabs).
 *    No manual dispatchEvent needed — we already hold the latest state in context.
 * 4. Performance: Set-based O(1) isFavorite lookups, full context value memoization
 *    so consumers only re-render when favorites actually change.
 */

import React, {
    createContext, useCallback, useContext, useEffect,
    useMemo, useRef, useState,
} from 'react';
import { getFavorites, saveFavorites, type FavoriteEntry } from '@/app/actions/favorites';

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = 'tsf_quick_access_pinned';
const SAVE_DEBOUNCE_MS = 400; // Batch rapid add/remove into one backend call

// ── Context type ──────────────────────────────────────────────────────────────

interface FavoritesContextType {
    favorites: FavoriteEntry[];
    /** O(1) — backed by a Set, not array.some() */
    isFavorite: (path: string) => boolean;
    toggleFavorite: (title: string, path: string) => void;
    removeFavorite: (path: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
    const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Always-current snapshot for the debounced save — avoids stale closures
    // when the user toggles rapidly before the timer fires.
    const latestFavs = useRef<FavoriteEntry[]>(favorites);
    useEffect(() => { latestFavs.current = favorites; }, [favorites]);

    // O(1) path lookups — recomputed only when the favorites array identity changes
    const favoriteSet = useMemo(
        () => new Set(favorites.map(f => f.path)),
        [favorites]
    );

    // Write to localStorage (triggers `storage` event in other tabs automatically)
    // then schedule a debounced backend save using the ref snapshot.
    const persist = useCallback((favs: FavoriteEntry[]) => {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(favs));
        } catch { /* quota exceeded — non-fatal */ }

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            saveFavorites(latestFavs.current).catch(() => {});
        }, SAVE_DEBOUNCE_MS);
    }, []);

    useEffect(() => {
        // 1. Hydrate from localStorage immediately — no loading flash
        let localFavs: FavoriteEntry[] = [];
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) localFavs = JSON.parse(raw);
        } catch { /* ignore parse errors */ }

        if (localFavs.length > 0) setFavorites(localFavs);

        // 2. Reconcile with backend — single call, no race condition
        //    setFavorites called once after await, not twice
        let cancelled = false;
        getFavorites().then(serverFavs => {
            if (cancelled) return;
            // Backend is source of truth — override regardless of local state
            setFavorites(serverFavs);
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(serverFavs));
            } catch { /* quota — non-fatal */ }
        }).catch(() => {
            // Network failure — keep localStorage version, no double setFavorites
        });

        // 3. Cross-tab sync (storage event only fires in OTHER tabs — no self-notify issue)
        const onStorage = (e: StorageEvent) => {
            if (e.key !== LS_KEY) return;
            try {
                const raw = localStorage.getItem(LS_KEY);
                setFavorites(raw ? JSON.parse(raw) : []);
            } catch { /* ignore */ }
        };
        window.addEventListener('storage', onStorage);

        return () => {
            cancelled = true;
            window.removeEventListener('storage', onStorage);
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, []);

    // ── Mutations ────────────────────────────────────────────────────────────

    const toggleFavorite = useCallback((title: string, path: string) => {
        setFavorites(prev => {
            const next = favoriteSet.has(path)
                ? prev.filter(f => f.path !== path)
                : [...prev, { title, path }];
            persist(next);
            return next;
        });
    }, [favoriteSet, persist]);

    const removeFavorite = useCallback((path: string) => {
        setFavorites(prev => {
            const next = prev.filter(f => f.path !== path);
            persist(next);
            return next;
        });
    }, [persist]);

    const isFavorite = useCallback(
        (path: string) => favoriteSet.has(path),
        [favoriteSet]
    );

    // Memoize the full context value so consumers only re-render when
    // the favorites array (or derived functions) actually change.
    const value = useMemo<FavoritesContextType>(() => ({
        favorites,
        isFavorite,
        toggleFavorite,
        removeFavorite,
    }), [favorites, isFavorite, toggleFavorite, removeFavorite]);

    return (
        <FavoritesContext.Provider value={value}>
            {children}
        </FavoritesContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFavorites(): FavoritesContextType {
    const ctx = useContext(FavoritesContext);
    if (!ctx) throw new Error('useFavorites must be called inside <FavoritesProvider>');
    return ctx;
}
