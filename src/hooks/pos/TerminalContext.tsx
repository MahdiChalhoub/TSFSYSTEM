'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { usePOSTerminal } from './usePOSTerminal';

type TerminalContextType = ReturnType<typeof usePOSTerminal>;

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: ReactNode }) {
    const terminal = usePOSTerminal();
    return (
        <TerminalContext.Provider value={terminal}>
            {children}
        </TerminalContext.Provider>
    );
}

export function useTerminal() {
    const context = useContext(TerminalContext);
    if (!context) {
        throw new Error('useTerminal must be used within a TerminalProvider');
    }
    return context;
}

/**
 * 🔊 Audio Feedback Utility for POS Premium Experience
 */
export const playSound = (type: 'success' | 'error' | 'click' | 'scan') => {
    if (typeof window === 'undefined') return;
    try {
        const audioPaths = {
            success: '/sounds/success.mp3',
            error: '/sounds/error.mp3',
            click: '/sounds/click.mp3',
            scan: '/sounds/scan.mp3'
        };
        const audio = new Audio(audioPaths[type]);
        audio.play().catch(() => { }); // Ignore interaction blocked errors
    } catch (e) { }
};
