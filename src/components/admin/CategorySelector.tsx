'use client';

/**
 * STUB COMPONENT - CategorySelector
 * Placeholder for when Inventory module is not installed.
 */
export function CategorySelector({ categories = [], selectedId, onSelect }: any) {
    return (
        <select
            className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"
            disabled
            value={selectedId || ''}
            onChange={(e) => onSelect?.(Number(e.target.value))}
        >
            <option value="">Inventory module required</option>
        </select>
    );
}
