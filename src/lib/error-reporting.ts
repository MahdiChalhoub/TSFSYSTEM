/**
 * Frontend Error Reporting
 * ========================
 * Sends structured error reports to the backend for production monitoring.
 * Fire-and-forget: never blocks the UI, never throws.
 */

const REPORT_ENDPOINT = '/api/health/error-report/';

interface ErrorReport {
    message: string;
    digest?: string;
    url: string;
    timestamp: string;
    userAgent: string;
    source: 'error-boundary' | 'unhandled' | 'promise-rejection';
    componentStack?: string;
    extra?: Record<string, unknown>;
}

let reported = new Set<string>();

/**
 * Report an error to the backend. Deduplicates by digest/message
 * so repeated renders don't flood the endpoint.
 */
export function reportError(
    error: Error & { digest?: string },
    source: ErrorReport['source'] = 'error-boundary',
    extra?: Record<string, unknown>
) {
    try {
        const key = error.digest || error.message || 'unknown';
        if (reported.has(key)) return;
        reported.add(key);

        // Cap the set so it doesn't grow unbounded in long sessions
        if (reported.size > 100) reported = new Set();

        const report: ErrorReport = {
            message: error.message || 'Unknown error',
            digest: error.digest,
            url: typeof window !== 'undefined' ? window.location.href : '',
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            source,
            ...extra && { extra },
        };

        // Fire-and-forget — never block the UI
        if (typeof fetch !== 'undefined') {
            fetch(REPORT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
                keepalive: true,  // Ensure delivery even if page is unloading
            }).catch(() => { }); // Silently ignore network failures
        }

        // Always log to console in dev
        if (process.env.NODE_ENV === 'development') {
            console.error('[ErrorReport]', report);
        }
    } catch {
        // Never throw from the error reporter
    }
}

/**
 * Install global unhandled error/rejection listeners.
 * Call once from a root layout or provider.
 */
export function installGlobalErrorListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
        if (event.error instanceof Error) {
            reportError(event.error, 'unhandled');
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
            ? event.reason
            : new Error(String(event.reason));
        reportError(error, 'promise-rejection');
    });
}
