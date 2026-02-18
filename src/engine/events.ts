/**
 * Engine: Event Bus
 * 
 * Provides a type-safe pub/sub event system for cross-module communication.
 * Modules should use Engine.events instead of custom event emitters.
 * This replaces direct DOM event usage and enables decoupled module communication.
 */

type EventHandler = (...args: Record<string, any>[]) => void;

const listeners = new Map<string, Set<EventHandler>>();

export const events = {
    on(event: string, handler: EventHandler): () => void {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(handler);
        return () => listeners.get(event)?.delete(handler);
    },

    off(event: string, handler: EventHandler): void {
        listeners.get(event)?.delete(handler);
    },

    emit(event: string, ...args: Record<string, any>[]): void {
        listeners.get(event)?.forEach(handler => {
            try { handler(...args); }
            catch (e) { console.error(`[Engine.events] Error in handler for "${event}":`, e); }
        });
    },

    once(event: string, handler: EventHandler): () => void {
        const wrappedHandler: EventHandler = (...args: Record<string, any>[]) => {
            handler(...args);
            events.off(event, wrappedHandler);
        };
        return events.on(event, wrappedHandler);
    }
};
