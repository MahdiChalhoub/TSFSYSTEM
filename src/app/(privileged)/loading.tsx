/**
 * Privileged-segment loading fallback.
 *
 * Returns null so Next.js keeps the previously-rendered tree visible while
 * new server data streams in. The earlier dark-skeleton version flashed
 * during scope toggles and other router.refresh() calls — animate-pulse on
 * dark surface tokens read as "a black box that disappears" against the
 * dark theme.
 *
 * Pages that need their own placeholder should ship a per-route loading.tsx.
 */
export default function Loading() {
    return null;
}
