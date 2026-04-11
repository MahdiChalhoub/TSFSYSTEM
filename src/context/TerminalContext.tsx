'use client';

/**
 * TerminalContext — POS State Provider
 * =====================================
 * Wraps useTerminal() and exposes its entire state to any POS component
 * via React Context. This eliminates the ~80-prop drilling pattern.
 *
 * Usage:
 *   <TerminalProvider> ... </TerminalProvider>
 *   const terminal = useTerminalContext();
 */

import React, { createContext, useContext } from 'react';
import { useTerminal, TerminalState } from '@/hooks/pos/useTerminal';

const TerminalContext = createContext<TerminalState | null>(null);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
    const terminal = useTerminal();
    return (
        <TerminalContext.Provider value={terminal}>
            {children}
        </TerminalContext.Provider>
    );
}

/**
 * Hook to consume the terminal context from any POS component.
 * Must be used within a <TerminalProvider>.
 */
export function useTerminalContext(): TerminalState {
    const ctx = useContext(TerminalContext);
    if (!ctx) throw new Error('useTerminalContext must be used within <TerminalProvider>');
    return ctx;
}
