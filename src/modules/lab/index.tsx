import React from 'react';

export default function LabModule() {
    return (
        <div className="p-8 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
            <h1 className="text-2xl font-bold text-blue-900 mb-4">Isolated Lab Module</h1>
            <p className="text-blue-700">
                This module is running in total isolation from the Blanc Engine kernel.
                It was loaded dynamically via <code>/saas/apps/lab</code>.
            </p>
            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-100 italic text-sm text-gray-600">
                Current timestamp: {new Date().toLocaleTimeString()}
            </div>
        </div>
    );
}
