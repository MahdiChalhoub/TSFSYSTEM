'use client'

import { useEffect } from 'react'

/**
 * Next.js Global Error Boundary
 * Catches errors that escape all route-level error boundaries.
 * Must render its own <html> and <body> tags.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[GlobalError]', error?.message, error?.digest)
    }, [error])

    return (
        <html lang="en">
            <body style={{
                margin: 0, fontFamily: 'system-ui, sans-serif',
                background: '#0a0a0a', color: '#e5e5e5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                    <div style={{
                        width: '4rem', height: '4rem', borderRadius: '1rem',
                        background: 'rgba(239,68,68,0.15)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem', fontSize: '2rem',
                    }}>
                        ⚠️
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.75rem' }}>
                        Application Error
                    </h2>
                    <p style={{ color: '#a3a3a3', marginBottom: '2rem', lineHeight: 1.6 }}>
                        A critical error occurred. This has been automatically reported to our team.
                    </p>
                    {error.digest && (
                        <p style={{
                            fontFamily: 'monospace', fontSize: '0.75rem',
                            color: '#737373', marginBottom: '1.5rem',
                            padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)',
                            borderRadius: '0.5rem', display: 'inline-block',
                        }}>
                            Error ID: {error.digest}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '0.75rem 2rem', borderRadius: '0.75rem',
                                background: '#10b981', color: 'white', border: 'none',
                                fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                            }}
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{
                                padding: '0.75rem 2rem', borderRadius: '0.75rem',
                                background: 'rgba(255,255,255,0.1)', color: '#e5e5e5',
                                border: '1px solid rgba(255,255,255,0.1)',
                                fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                            }}
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
