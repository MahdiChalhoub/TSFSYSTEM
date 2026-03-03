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
 ? 'bg-app-info-bg border-app-info text-app-info'
 : 'bg-app-surface border-app-border text-app-text-muted hover:border-app-border'
 }`}
 >
 <Columns3 size={13} />
 Column
 </button>

 {open && (
 <div className="absolute right-0 bottom-full mb-2 w-56 bg-app-surface border border-app-border rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
 <div className="p-2 border-b border-app-border">
 <button
 onClick={selectAll}
 className="w-full text-left px-2 py-1 text-xs text-app-info font-semibold hover:bg-app-info-bg rounded"
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
 ? 'text-app-text font-medium'
 : 'text-app-text-faint'
 } hover:bg-app-bg`}
 >
 <div className={`w-4 h-4 rounded border flex items-center justify-center ${isActive
 ? 'bg-blue-600 border-blue-600'
 : 'border-app-border'
 }`}>
 {isActive && <Check size={10} className="text-app-text" />}
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
