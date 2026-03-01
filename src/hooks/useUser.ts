'use client';

import { useState, useEffect } from 'react';
import { meAction } from '@/app/actions/auth';

/**
 * 👤 useUser — Precise Identity Hook
 * Retrieves the current authenticated user profile from the TSF cloud.
 */
export function useUser() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadUser() {
            try {
                const data = await meAction();
                setUser(data);
            } catch (err) {
                setError(String(err));
            } finally {
                setLoading(false);
            }
        }
        loadUser();
    }, []);

    return { user, loading, error };
}
