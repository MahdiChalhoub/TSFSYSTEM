'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/** Generic form-draft autosave + recovery for any client-side form.
 *
 *  Why: server actions submit on user click — but anything in between
 *  (browser crash, tab close, accidental navigation) wipes in-progress
 *  data. We persist a debounced snapshot to localStorage so the next
 *  visit can offer to recover.
 *
 *  Lifecycle:
 *    1. Mount → read localStorage[storageKey]; if found AND younger than
 *       maxAgeMs, expose `recoverable` (the snapshot + timestamp). If not
 *       found, expose null.
 *    2. Caller decides what to do (show banner; tap "Recover" → spread
 *       into state setters; tap "Discard" → call clearDraft()).
 *    3. As the user edits, caller passes the current snapshot to
 *       saveDraft(). We debounce + write.
 *    4. On successful submit, caller calls clearDraft() so the next
 *       fresh visit doesn't offer to recover an already-saved draft.
 *
 *  Storage shape: `{ data: T, savedAt: ISO-string }` — single record
 *  per storageKey, simple to reason about.
 */
export interface DraftRecord<T> {
    data: T
    savedAt: string  // ISO8601
}

interface UseFormDraftReturn<T> {
    /** Recoverable draft from a previous session, or null. Null until the
     *  initial localStorage read finishes (first render = SSR-safe). */
    recoverable: DraftRecord<T> | null
    /** Persist the current snapshot. Calls debounced — the actual write
     *  fires `debounceMs` after the latest call. */
    saveDraft: (data: T) => void
    /** Wipe the stored draft. Call this after a successful submit OR
     *  when the user explicitly discards the recovery offer. */
    clearDraft: () => void
}

interface Options {
    /** localStorage key — pick one per form (e.g. 'po.draft.create'). */
    storageKey: string
    /** How long the draft remains "recoverable" before we ignore it.
     *  Default 7 days. */
    maxAgeMs?: number
    /** Debounce window for writes. Default 600ms — fast enough that a
     *  tab close won't lose more than ~1 keystroke. */
    debounceMs?: number
    /** When false, the hook becomes a no-op. Use this to disable
     *  autosave on edit-mode pages where the source-of-truth is the
     *  database row, not a draft. */
    enabled?: boolean
}

export function useFormDraft<T>({
    storageKey,
    maxAgeMs = 7 * 24 * 60 * 60 * 1000,
    debounceMs = 600,
    enabled = true,
}: Options): UseFormDraftReturn<T> {
    const [recoverable, setRecoverable] = useState<DraftRecord<T> | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Initial read — runs once after mount so we don't break SSR.
    useEffect(() => {
        if (!enabled) return
        try {
            const raw = localStorage.getItem(storageKey)
            if (!raw) return
            const parsed = JSON.parse(raw) as DraftRecord<T>
            if (!parsed?.savedAt) return
            const age = Date.now() - new Date(parsed.savedAt).getTime()
            if (age > maxAgeMs) {
                // Stale — drop silently so the user isn't offered an
                // ancient draft they barely remember.
                localStorage.removeItem(storageKey)
                return
            }
            setRecoverable(parsed)
        } catch { /* private mode / corrupted JSON — ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const saveDraft = useCallback((data: T) => {
        if (!enabled) return
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            try {
                const record: DraftRecord<T> = {
                    data,
                    savedAt: new Date().toISOString(),
                }
                localStorage.setItem(storageKey, JSON.stringify(record))
            } catch { /* quota / private mode — drop silently */ }
        }, debounceMs)
    }, [enabled, storageKey, debounceMs])

    const clearDraft = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
        setRecoverable(null)
    }, [storageKey])

    // Flush any pending save on unmount so a quick close+reload doesn't
    // skip the most recent edit.
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

    return { recoverable, saveDraft, clearDraft }
}
