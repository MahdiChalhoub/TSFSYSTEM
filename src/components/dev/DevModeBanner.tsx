'use client';

/**
 * DevModeBanner — Shown when DEV_MODULE is set.
 * Sticky banner at the top indicating which module is in focus.
 */

interface DevModeBannerProps {
    moduleName: string;
}

export default function DevModeBanner({ moduleName }: DevModeBannerProps) {
    return (
        <div
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 9999,
                background: 'linear-gradient(90deg, #059669 0%, #10b981 50%, #34d399 100%)',
                color: '#fff',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.02em',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
        >
            <span style={{ fontSize: '14px' }}>🔧</span>
            <span>
                DEV MODE:{' '}
                <span style={{ textTransform: 'uppercase' }}>{moduleName}</span>
            </span>
            <span style={{ opacity: 0.7, marginLeft: '8px', fontWeight: 400, fontSize: '12px' }}>
                Other modules are locked • Port {typeof window !== 'undefined' ? window.location.port : '3001'}
            </span>
        </div>
    );
}
