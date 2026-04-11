'use client';
import { useState, useCallback, DragEvent } from 'react';

export function useDragAndDrop<T extends string>(
    items: T[],
    onReorder: (items: T[]) => void
) {
    const [draggedItem, setDraggedItem] = useState<T | null>(null);
    const [dragOverItem, setDragOverItem] = useState<T | null>(null);

    const onDragStart = useCallback((item: T) => (e: DragEvent) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const onDragOver = useCallback((item: T) => (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverItem(item);
    }, []);

    const onDragEnd = useCallback(() => {
        if (draggedItem && dragOverItem && draggedItem !== dragOverItem) {
            const newItems = [...items];
            const fromIdx = newItems.indexOf(draggedItem);
            const toIdx = newItems.indexOf(dragOverItem);
            newItems.splice(fromIdx, 1);
            newItems.splice(toIdx, 0, draggedItem);
            onReorder(newItems);
        }
        setDraggedItem(null);
        setDragOverItem(null);
    }, [draggedItem, dragOverItem, items, onReorder]);

    const dragHandlers = useCallback((item: T) => ({
        draggable: true,
        onDragStart: onDragStart(item),
        onDragOver: onDragOver(item),
        onDragEnd,
        onDragLeave: () => setDragOverItem(null),
    }), [onDragStart, onDragOver, onDragEnd]);

    return { dragHandlers, draggedItem, dragOverItem };
}
