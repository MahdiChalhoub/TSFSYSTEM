'use client';

import { useAdmin } from '@/context/AdminContext';
import { X } from 'lucide-react';
import clsx from 'clsx';

export function TabNavigator() {
    const { openTabs, activeTab, closeTab, openTab } = useAdmin();

    return (
        <div className="flex items-end gap-1 px-2 pt-2 bg-gray-100 border-b border-gray-200 shrink-0 overflow-x-auto no-scrollbar">
            {openTabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <div
                        key={tab.id}
                        onClick={() => openTab(tab.title, tab.path)}
                        className={clsx(
                            "group flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg cursor-pointer border-t border-x transition-all select-none min-w-[120px] max-w-[200px] justify-between",
                            isActive
                                ? "bg-white border-gray-200 text-blue-600 relative top-[1px]"
                                : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-200"
                        )}
                    >
                        <span className="truncate">{tab.title}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                            className={clsx(
                                "p-0.5 rounded-full",
                                isActive ? "hover:bg-blue-50 text-blue-400" : "hover:bg-gray-300 text-gray-400 group-hover:block"
                            )}
                        >
                            <X size={12} />
                        </button>
                    </div>
                )
            })}
        </div>
    );
}
