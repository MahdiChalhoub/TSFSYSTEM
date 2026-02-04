'use client';

/**
 * STUB COMPONENT - AttributeManager
 * Placeholder for when Inventory module is not installed.
 * Shows "module required" message.
 */
export function AttributeManager({ attributes = [], categories = [] }: any) {
    return (
        <div className="text-center py-12">
            <div className="text-4xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">Inventory Module Required</h2>
            <p className="text-gray-500">Install the Inventory module to manage attributes.</p>
        </div>
    );
}
