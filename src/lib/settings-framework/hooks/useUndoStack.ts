'use client';
import { useState, useCallback } from 'react';

export interface UndoEntry<T = any> {
    field: string;
    prev: T;
    next: T;
    ts: number;
}

export function useUndoStack<T = any>(maxDepth: number = 50) {
    const [stack, setStack] = useState<UndoEntry<T>[]>([]);
    const [redoStack, setRedoStack] = useState<UndoEntry<T>[]>([]);

    const push = useCallback((entry: Omit<UndoEntry<T>, 'ts'>) => {
        setStack(prev => [...prev.slice(-(maxDepth - 1)), { ...entry, ts: Date.now() }]);
        setRedoStack([]); // clear redo on new change
    }, [maxDepth]);

    const undo = useCallback((): UndoEntry<T> | null => {
        if (stack.length === 0) return null;
        const last = stack[stack.length - 1];
        setStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, last]);
        return last;
    }, [stack]);

    const redo = useCallback((): UndoEntry<T> | null => {
        if (redoStack.length === 0) return null;
        const last = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        setStack(prev => [...prev, last]);
        return last;
    }, [redoStack]);

    const clear = useCallback(() => {
        setStack([]);
        setRedoStack([]);
    }, []);

    return {
        push, undo, redo, clear,
        canUndo: stack.length > 0,
        canRedo: redoStack.length > 0,
        depth: stack.length,
        stack,
    };
}
