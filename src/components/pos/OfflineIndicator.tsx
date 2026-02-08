/**
 * Offline Indicator for POS
 * ==========================
 * Shows connectivity status and pending order count.
 * 
 * States:
 *   🟢 Online     — connected, all synced
 *   🟡 Syncing    — replaying queued orders
 *   🔴 Offline    — no connectivity, orders queuing locally
 *   🔵 Reconnected — just came back, auto-syncing
 */

'use client';

import { useOnlineStatus, usePendingOrders } from '@/lib/offline/hooks';
import { Wifi, WifiOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';

export default function OfflineIndicator() {
    const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
    const { count: pendingCount, syncing, triggerSync } = usePendingOrders();

    // Determine state
    const state = !isOnline
        ? 'offline'
        : syncing
            ? 'syncing'
            : wasOffline && pendingCount > 0
                ? 'reconnected'
                : pendingCount > 0
                    ? 'pending'
                    : 'online';

    // Auto-clear "was offline" after a few seconds if nothing pending
    if (wasOffline && pendingCount === 0 && isOnline) {
        setTimeout(clearWasOffline, 3000);
    }

    return (
        <div className="offline-indicator" data-state={state}>
            <div className="offline-indicator__dot" />

            <span className="offline-indicator__label">
                {state === 'offline' && (
                    <>
                        <WifiOff size={14} />
                        <span>Offline</span>
                    </>
                )}
                {state === 'syncing' && (
                    <>
                        <RefreshCw size={14} className="spin" />
                        <span>Syncing...</span>
                    </>
                )}
                {state === 'reconnected' && (
                    <>
                        <AlertTriangle size={14} />
                        <span>{pendingCount} pending</span>
                    </>
                )}
                {state === 'pending' && (
                    <>
                        <AlertTriangle size={14} />
                        <span>{pendingCount} queued</span>
                    </>
                )}
                {state === 'online' && (
                    <>
                        <Wifi size={14} />
                        <span>Online</span>
                    </>
                )}
            </span>

            {/* Sync button when there are pending orders */}
            {pendingCount > 0 && isOnline && !syncing && (
                <button
                    className="offline-indicator__sync-btn"
                    onClick={triggerSync}
                    title="Sync pending orders now"
                >
                    <RefreshCw size={12} />
                </button>
            )}

            {/* Pending badge */}
            {pendingCount > 0 && (
                <span className="offline-indicator__badge">{pendingCount}</span>
            )}

            <style jsx>{`
        .offline-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.3s ease;
          user-select: none;
        }

        .offline-indicator[data-state="online"] {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .offline-indicator[data-state="offline"] {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
          animation: pulse-red 2s infinite;
        }

        .offline-indicator[data-state="syncing"] {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .offline-indicator[data-state="reconnected"],
        .offline-indicator[data-state="pending"] {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .offline-indicator__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .offline-indicator__label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .offline-indicator__badge {
          background: currentColor;
          color: #0a0a0f;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 10px;
          min-width: 16px;
          text-align: center;
        }

        .offline-indicator__sync-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          background: currentColor;
          color: #0a0a0f;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .offline-indicator__sync-btn:hover {
          transform: scale(1.15);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse-red {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
        </div>
    );
}
