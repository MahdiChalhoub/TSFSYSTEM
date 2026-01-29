'use client';

import { useAdmin } from '@/context/AdminContext';
import { X } from 'lucide-react';
import clsx from 'clsx';

export function TabNavigator() {
    const { openTabs, activeTab, closeTab, openTab } = useAdmin();

    return (
        <div className="flex items-end gap-2 px-6 pt-4 bg-gray-50/80 border-b border-gray-200 shrink-0 overflow-x-auto no-scrollbar">
            {openTabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <div
                        key={tab.id}
                        onClick={() => openTab(tab.title, tab.path)}
                        className={clsx(
                            "group flex items-center gap-3 px-6 py-3.5 text-sm font-medium rounded-t-2xl cursor-pointer border-t border-x transition-all select-none min-w-[160px] max-w-[240px] justify-between relative",
                            isActive
                                ? "bg-white border-gray-200 text-emerald-700 shadow-[0_-2px_6px_-2px_rgba(0,0,0,0.05)] z-10 bottom-[-1px]"
                                : "bg-gray-100/60 border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700"
                        )}
                    >
                        <span className="truncate font-semibold tracking-wide">{tab.title}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                            className={clsx(
                                "p-1 rounded-full transition-all duration-200 opacity-60 group-hover:opacity-100",
                                isActive
                                    ? "hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700"
                                    : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <X size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                )
            })}
        </div>
    );
}
