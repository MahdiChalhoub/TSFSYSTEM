'use client';

import { useState } from 'react';
import AddProductForm from './form';
import AdvancedProductForm from './advanced-form';

export default function ProductFormWrapper(props: any) {
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border border-gray-100 rounded-xl shadow-sm">
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-gray-800">Mode Selection</h2>
                    <p className="text-xs text-gray-500 font-medium">Toggle between Simple and Advanced creation forms</p>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl">
                    <span className={`text-sm font-bold transition-colors ${!isAdvancedMode ? 'text-gray-900' : 'text-gray-400'}`}>Simple</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isAdvancedMode} onChange={(e) => setIsAdvancedMode(e.target.checked)} />
                        <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                    </label>
                    <span className={`text-sm font-bold transition-colors ${isAdvancedMode ? 'text-cyan-600' : 'text-gray-400'}`}>Advanced</span>
                </div>
            </div>

            {isAdvancedMode ? (
                <AdvancedProductForm {...props} />
            ) : (
                <AddProductForm {...props} />
            )}
        </div>
    );
}
