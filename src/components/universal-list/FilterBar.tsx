'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ChevronDown, X } from 'lucide-react';
import type { FilterDef } from './types';

interface FilterBarProps {
 filters: FilterDef[];
 values: Record<string, any>;
 search: string;
 onSearchChange: (search: string) => void;
 onFilterChange: (key: string, value: any) => void;
 onReset: () => void;
 searchPlaceholder?: string;
}

export default function FilterBar({
 filters,
 values,
 search,
 onSearchChange,
 onFilterChange,
 onReset,
 searchPlaceholder = 'Search...',
}: FilterBarProps) {
 const [showAdvanced, setShowAdvanced] = useState(false);
 const quickFilters = filters.filter(f => f.isQuick !== false);
 const advancedFilters = filters.filter(f => f.isQuick === false);
 const activeCount = Object.values(values).filter(v => v !== '' && v !== undefined && v !== null).length;

 return (
 <div className="space-y-3">
 {/* Quick Filters Row */}
 <div className="flex flex-wrap items-center gap-3">
 {/* Search */}
 <div className="relative flex-shrink-0" style={{ minWidth: 200 }}>
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
 <input
 type="text"
 value={search}
 onChange={e => onSearchChange(e.target.value)}
 placeholder={searchPlaceholder}
 className="w-full pl-9 pr-4 py-2 text-sm border border-app-border rounded-lg bg-app-surface focus:ring-2 focus:ring-blue-500 focus:border-app-info outline-none transition-all"
 />
 {search && (
 <button
 onClick={() => onSearchChange('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-app-text-faint hover:text-app-text-muted"
 >
 <X size={14} />
 </button>
 )}
 </div>

 {/* Quick Filter Dropdowns */}
 {quickFilters.map(filter => (
 <FilterDropdown
 key={filter.key}
 filter={filter}
 value={values[filter.key] ?? ''}
 onChange={val => onFilterChange(filter.key, val)}
 />
 ))}

 {/* Advanced Filter Toggle */}
 {advancedFilters.length > 0 && (
 <button
 onClick={() => setShowAdvanced(!showAdvanced)}
 className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-all ${showAdvanced
 ? 'bg-app-info-bg border-app-info text-app-info'
 : 'bg-app-surface border-app-border text-app-text-muted hover:border-app-border'
 }`}
 >
 <Filter size={13} />
 More Filters
 {activeCount > 0 && (
 <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-app-text text-[10px] rounded-full">
 {activeCount}
 </span>
 )}
 </button>
 )}
 </div>

 {/* Advanced Filter Panel */}
 {showAdvanced && advancedFilters.length > 0 && (
 <div className="p-4 bg-app-surface-2/70 border border-app-border rounded-xl animate-in slide-in-from-top-2 duration-200">
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
 {advancedFilters.map(filter => (
 <div key={filter.key}>
 <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
 {filter.label}
 </label>
 {filter.type === 'select' || filter.type === 'multiselect' ? (
 <select
 value={values[filter.key] ?? ''}
 onChange={e => onFilterChange(filter.key, e.target.value)}
 className="w-full px-3 py-2 text-sm border border-app-border rounded-lg bg-app-surface focus:ring-2 focus:ring-blue-500 outline-none"
 >
 <option value="">All</option>
 {filter.options?.map(opt => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 ) : filter.type === 'checkbox' ? (
 <label className="flex items-center gap-2 py-2">
 <input
 type="checkbox"
 checked={!!values[filter.key]}
 onChange={e => onFilterChange(filter.key, e.target.checked)}
 className="w-4 h-4 text-app-info rounded border-app-border"
 />
 <span className="text-sm text-app-text-muted">{filter.placeholder || filter.label}</span>
 </label>
 ) : (
 <input
 type={filter.type === 'date' ? 'date' : 'text'}
 value={values[filter.key] ?? ''}
 onChange={e => onFilterChange(filter.key, e.target.value)}
 placeholder={filter.placeholder || filter.label}
 className="w-full px-3 py-2 text-sm border border-app-border rounded-lg bg-app-surface focus:ring-2 focus:ring-blue-500 outline-none"
 />
 )}
 </div>
 ))}
 </div>
 <div className="flex justify-end mt-3">
 <button
 onClick={onReset}
 className="px-4 py-1.5 text-xs font-semibold text-app-text-muted border border-app-border rounded-lg hover:bg-app-surface transition-all"
 >
 Reset Filter
 </button>
 </div>
 </div>
 )}
 </div>
 );
}

/** Individual filter dropdown */
function FilterDropdown({
 filter,
 value,
 onChange,
}: {
 filter: FilterDef;
 value: any;
 onChange: (val: any) => void;
}) {
 if (filter.type === 'select' || filter.type === 'multiselect') {
 return (
 <div className="relative">
 <select
 value={value}
 onChange={e => onChange(e.target.value)}
 className={`appearance-none px-3 pr-8 py-2 text-xs font-semibold border rounded-lg cursor-pointer transition-all ${value
 ? 'bg-app-info-bg border-app-info text-app-info'
 : 'bg-app-surface border-app-border text-app-text-muted hover:border-app-border'
 }`}
 >
 <option value="">⧫ {filter.label}</option>
 {filter.options?.map(opt => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-app-text-faint pointer-events-none" />
 </div>
 );
 }

 if (filter.type === 'date') {
 return (
 <input
 type="date"
 value={value ?? ''}
 onChange={e => onChange(e.target.value)}
 className={`px-3 py-2 text-xs font-semibold border rounded-lg transition-all ${value
 ? 'bg-app-info-bg border-app-info text-app-info'
 : 'bg-app-surface border-app-border text-app-text-muted hover:border-app-border'
 }`}
 />
 );
 }

 return (
 <input
 type="text"
 value={value ?? ''}
 onChange={e => onChange(e.target.value)}
 placeholder={filter.placeholder || filter.label}
 className="px-3 py-2 text-xs border border-app-border rounded-lg bg-app-surface focus:ring-2 focus:ring-blue-500 outline-none"
 />
 );
}
