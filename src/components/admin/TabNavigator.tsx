'use client';

import { useAdmin } from '@/context/AdminContext';
import { X, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import React, { useState, useEffect, useRef } from 'react';

export function TabNavigator() {
    const { openTabs, activeTab, closeTab, openTab } = useAdmin();
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(openTabs.length);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Optimize tab rendering by calculating visibility
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const containerWidth = entries[0].contentRect.width;
            const TAB_MIN_WIDTH = 180;
            const DROPDOWN_WIDTH = 70;

            const maxVisible = Math.floor((containerWidth - DROPDOWN_WIDTH) / TAB_MIN_WIDTH);
            setVisibleCount(Math.max(1, maxVisible));
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const visibleTabs = openTabs.slice(0, visibleCount);
    const hiddenTabs = openTabs.slice(visibleCount);

    return (
        <div className="flex items-end px-6 bg-gray-50/80 border-b border-gray-200 shrink-0 relative h-[68px]">
            <div ref={containerRef} className="flex-1 flex items-end gap-1.5 overflow-hidden h-full">
                {visibleTabs.map(tab => (
                    <TabItem
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onOpen={openTab}
                        onClose={closeTab}
                    />
                ))}
            </div>

            {hiddenTabs.length > 0 && (
                <div className="pb-1.5 ml-2 relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={clsx(
                            "h-12 w-12 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm hover:shadow-md",
                            isMenuOpen && "border-emerald-500 text-emerald-600 ring-2 ring-emerald-500/10"
                        )}
                    >
                        <span className="relative">
                            <MoreHorizontal size={20} />
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                                {hiddenTabs.length}
                            </span>
                        </span>
                    </button>

                    {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-72 bg-white/95 backdrop-blur-md border border-gray-200 rounded-[2rem] shadow-2xl z-[100] p-3 animate-in fade-in zoom-in duration-200 origin-top-right">
                            <div className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-2">Overflow Workspaces</div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                {hiddenTabs.map(tab => (
                                    <div
                                        key={tab.id}
                                        onClick={() => { openTab(tab.title, tab.path); setIsMenuOpen(false); }}
                                        className={clsx(
                                            "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all group mb-1",
                                            activeTab === tab.id ? "bg-emerald-50 text-emerald-700 shadow-inner" : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <div className={clsx("w-2 h-2 rounded-full", activeTab === tab.id ? "bg-emerald-500 animate-pulse" : "bg-gray-300")} />
                                            <span className="font-bold text-sm truncate">{tab.title}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                            className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100"
                                        >
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const TabItem = React.memo(({ tab, isActive, onOpen, onClose }: any) => {
    return (
        <div
            onClick={() => onOpen(tab.title, tab.path)}
            className={clsx(
                "group flex items-center gap-3 px-6 h-[52px] text-sm font-medium rounded-t-2xl cursor-pointer border-t border-x transition-all select-none min-w-[160px] max-w-[240px] justify-between relative",
                isActive
                    ? "bg-white border-gray-200 text-emerald-700 shadow-[0_-2px_6px_-2px_rgba(0,0,0,0.05)] z-10"
                    : "bg-gray-100/60 border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700"
            )}
        >
            {isActive && (
                <div className="absolute top-0 left-6 right-6 h-0.5 bg-emerald-500 rounded-full" />
            )}

            <span className="truncate font-bold tracking-tight">{tab.title}</span>
            <button
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                className={clsx(
                    "p-1.5 rounded-xl transition-all duration-200 opacity-40 group-hover:opacity-100",
                    isActive
                        ? "hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700"
                        : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                )}
            >
                <X size={14} strokeWidth={3} />
            </button>
        </div>
    );
});

TabItem.displayName = 'TabItem';
