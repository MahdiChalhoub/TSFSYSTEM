'use client';
import { useState, useEffect, useCallback } from 'react';

export interface ActiveEditor {
    user: string;
    last_seen: string;
}

export function usePresenceTracking(
    heartbeatFn: () => Promise<{ active_editors?: ActiveEditor[] }>,
    intervalMs: number = 30000
) {
    const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
    const [isTracking, setIsTracking] = useState(false);

    const sendHeartbeat = useCallback(async () => {
        try {
            const data = await heartbeatFn();
            if (data.active_editors) {
                setActiveEditors(data.active_editors);
            }
            setIsTracking(true);
        } catch {
            setIsTracking(false);
        }
    }, [heartbeatFn]);

    useEffect(() => {
        sendHeartbeat();
        const timer = setInterval(sendHeartbeat, intervalMs);
        return () => clearInterval(timer);
    }, [sendHeartbeat, intervalMs]);

    return { activeEditors, isTracking, editorCount: activeEditors.length };
}
