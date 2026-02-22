'use client';

import { useState, useRef, useEffect } from 'react';
import { Columns3, Check } from 'lucide-react';
import type { ColumnDef } from './types';

interface ColumnSelectorProps {
    columns: ColumnDef[];
    visibleColumns: string[];
    onChange: (columns: string[]) => void;
}

export default function ColumnSelector({ columns, visibleColumns, onChange }: ColumnSelectorProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeSet = new Set(
        visibleColumns.length > 0
            ? visibleColumns
            : columns.filter(c => c.defaultVisible !== false).map(c => c.key)
    );

    const toggle = (key: string) => {
        const next = new Set(activeSet);
        if (next.has(key)) {
            if (next.size > 1) next.delete(key); // Keep at least 1
        } else {
            next.add(key);
        }
        onChange(Array.from(next));
    };

    const selectAll = () => {
        onChange(columns.map(c => c.key));
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg transition-all ${open
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
            >
                <Columns3 size={13} />
                Column
            </button>

            {open && (
                <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-2 border-b border-gray-100">
                        <button
                            onClick={selectAll}
                            className="w-full text-left px-2 py-1 text-xs text-blue-600 font-semibold hover:bg-blue-50 rounded"
                        >
                            Select All
                        </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                        {columns.map(col => {
                            const isActive = activeSet.has(col.key);
                            return (
                                <button
                                    key={col.key}
                                    onClick={() => toggle(col.key)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-all ${isActive
                                            ? 'text-gray-900 font-medium'
                                            : 'text-gray-400'
                                        } hover:bg-gray-50`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isActive
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-gray-300'
                                        }`}>
                                        {isActive && <Check size={10} className="text-white" />}
                                    </div>
                                    {col.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
