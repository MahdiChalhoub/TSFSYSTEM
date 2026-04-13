'use client';

/**
 * FavoritesContext — Single source of truth for user favorites
 * =============================================================
 * Architecture:
 * 1. Mount: show localStorage instantly (zero flash), then fetch from backend
 *    (cross-device) and override.
 * 2. On change: update state immediately (optimistic), persist to localStorage
 *    for instant cross-tab sync, save to backend async (fire-and-forget).
 * 3. All consumers (Sidebar, Home page, etc.) read from one context —
 *    no duplicate fetches, no duplicate state.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getFavorites, saveFavorites, type FavoriteEntry } from '@/app/actions/favorites';

const LS_KEY = 'tsf_quick_access_pinned';

interface FavoritesContextType {
    favorites: FavoriteEntry[];
    isFavorite: (path: string) => boolean;
    toggleFavorite: (title: string, path: string) => void;
    removeFavorite: (path: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
    const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);

    const persist = useCallback((next: FavoriteEntry[]) => {
        // 1. Update localStorage so other tabs respond immediately
        localStorage.setItem(LS_KEY, JSON.stringify(next));
        window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
        // 2. Save to backend (cross-device) — fire-and-forget
        saveFavorites(next).catch(() => {});
    }, []);

    useEffect(() => {
        // Step 1: show localStorage immediately (no flash on revisit)
        try {
            const cached = localStorage.getItem(LS_KEY);
            if (cached) setFavorites(JSON.parse(cached));
        } catch { /* ignore */ }

        // Step 2: fetch from backend (authoritative, cross-device)
        getFavorites().then(serverFavs => {
            setFavorites(serverFavs);
            // Keep localStorage in sync with server truth
            localStorage.setItem(LS_KEY, JSON.stringify(serverFavs));
        }).catch(() => { /* keep localStorage version */ });

        // Step 3: listen for changes from other tabs
        const onStorage = (e: StorageEvent) => {
            if (e.key !== LS_KEY) return;
            try {
                const raw = localStorage.getItem(LS_KEY);
                setFavorites(raw ? JSON.parse(raw) : []);
            } catch { /* ignore */ }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const toggleFavorite = useCallback((title: string, path: string) => {
        setFavorites(prev => {
            const exists = prev.some(f => f.path === path);
            const next = exists
                ? prev.filter(f => f.path !== path)
                : [...prev, { title, path }];
            persist(next);
            return next;
        });
    }, [persist]);

    const removeFavorite = useCallback((path: string) => {
        setFavorites(prev => {
            const next = prev.filter(f => f.path !== path);
            persist(next);
            return next;
        });
    }, [persist]);

    const isFavorite = useCallback((path: string) => {
        return favorites.some(f => f.path === path);
    }, [favorites]);

    return (
        <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, removeFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const ctx = useContext(FavoritesContext);
    if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
    return ctx;
}
