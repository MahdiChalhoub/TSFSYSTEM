/**
 * Online-Only Overlay
 * ====================
 * Full-page blocker when a page requires active internet but the user is offline.
 * 
 * Usage:
 *   <OnlineOnlyOverlay reason="Inventory counting requires a live connection" />
 * 
 * It checks online status and renders a blocking overlay with retry button.
 */

'use client';

import { useOnlineStatus } from '@/lib/offline/hooks';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OnlineOnlyOverlayProps {
    /** Why this page requires online — shown to the user */
    reason?: string;
}

export default function OnlineOnlyOverlay({
    reason = 'This page requires an active internet connection',
}: OnlineOnlyOverlayProps) {
    const { isOnline } = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="online-only-overlay">
            <div className="online-only-overlay__card">
                <div className="online-only-overlay__icon">
                    <WifiOff size={40} />
                </div>
                <h2 className="online-only-overlay__title">Connection Required</h2>
                <p className="online-only-overlay__message">{reason}</p>
                <p className="online-only-overlay__hint">
                    Please check your internet connection and try again.
                </p>
                <button
                    className="online-only-overlay__retry"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw size={16} />
                    <span>Retry</span>
                </button>
            </div>

            <style jsx>{`
        .online-only-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          animation: fadeIn 0.3s ease;
        }

        .online-only-overlay__card {
          background: var(--app-surface, #0F172A);
          border: 1px solid var(--app-border, rgba(255,255,255,0.08));
          border-radius: 1rem;
          padding: 2.5rem;
          max-width: 420px;
          width: 90%;
          text-align: center;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
        }

        .online-only-overlay__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.12);
          color: var(--app-error, #EF4444);
          margin-bottom: 1.25rem;
          animation: pulse 2s ease-in-out infinite;
        }

        .online-only-overlay__title {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--app-text, #F1F5F9);
          margin: 0 0 0.5rem;
        }

        .online-only-overlay__message {
          font-size: 0.9rem;
          color: var(--app-text-muted, #94A3B8);
          margin: 0 0 0.25rem;
          line-height: 1.5;
        }

        .online-only-overlay__hint {
          font-size: 0.8rem;
          color: var(--app-text-faint, #64748B);
          margin: 0 0 1.5rem;
        }

        .online-only-overlay__retry {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.75rem;
          background: var(--app-primary, #10B981);
          color: white;
          border: none;
          border-radius: 0.625rem;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .online-only-overlay__retry:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }

        .online-only-overlay__retry:active {
          transform: translateY(0);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
      `}</style>
        </div>
    );
}
