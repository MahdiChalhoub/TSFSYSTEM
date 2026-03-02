'use client';

import { useState, memo } from 'react';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';

type CategoryNode = {
 id: number;
 name: string;
 parent: number | null;
 children?: CategoryNode[];
 code?: string;
};

type Props = {
 categories: CategoryNode[];
 selectedIds: number[];
 onChange: (selectedIds: number[]) => void;
 maxHeight?: string;
};

export function CategoryTreeSelector({ categories, selectedIds, onChange, maxHeight = 'max-h-60' }: Props) {
 const handleToggle = (categoryId: number) => {
 if (selectedIds.includes(categoryId)) {
 // Remove from selection
 onChange(selectedIds.filter(id => id !== categoryId));
 } else {
 // Add to selection
 onChange([...selectedIds, categoryId]);
 }
 };

 return (
 <div className={`${maxHeight} overflow-y-auto px-4 py-3 bg-slate-50/50 backdrop-blur-sm rounded-2xl border border-app-border space-y-1.5 scrollbar-premium shadow-inner`}>
 {categories.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 text-slate-300">
 <Folder size={32} className="mb-4 opacity-50" />
 <p className="text-[10px] font-black uppercase tracking-[0.2em]">No operational nodes detected</p>
 </div>
 ) : (
 categories.map(category => (
 <CategoryTreeNode
 key={category.id}
 category={category}
 level={0}
 selectedIds={selectedIds}
 onToggle={handleToggle}
 />
 ))
 )}
 </div>
 );
}

const CategoryTreeNode = memo(function CategoryTreeNode({
 category,
 level,
 selectedIds,
 onToggle
}: {
 category: CategoryNode;
 level: number;
 selectedIds: number[];
 onToggle: (id: number) => void;
}) {
 const [isExpanded, setIsExpanded] = useState(level === 0); // Expand root categories by default

 const hasChildren = category.children && category.children.length > 0;
 const isSelected = selectedIds.includes(category.id);

 return (
 <div className="animate-in fade-in duration-300">
 {/* Category Row */}
 <div
 className={`
 flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-300 group/node relative overflow-hidden
 hover:bg-app-surface hover:shadow-lg hover:shadow-slate-200/50
 ${isSelected ? 'bg-emerald-50/80 border border-emerald-100/50 shadow-sm' : 'bg-transparent border border-transparent'}
 `}
 style={{ marginLeft: `${level * 1.5}rem` }}
 onClick={() => onToggle(category.id)}
 >
 {isSelected && (
 <div className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r-lg shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
 )}

 {/* Expand Toggle */}
 {hasChildren ? (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setIsExpanded(!isExpanded);
 }}
 className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-300 ${isExpanded ? 'bg-app-surface-2 text-app-text rotate-0' : 'text-app-text-faint hover:bg-app-surface-2 hover:text-emerald-600'}`}
 >
 {isExpanded ? <ChevronDown size={14} className="group-hover/node:scale-110" /> : <ChevronRight size={14} className="group-hover/node:translate-x-0.5" />}
 </button>
 ) : (
 <div className="w-6" /> // Spacer
 )}

 {/* Selection State (Custom Checkbox Style) */}
 <div className={`
 w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300
 ${isSelected
 ? 'bg-emerald-600 border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
 : 'border-app-border bg-app-surface group-hover/node:border-emerald-400 group-hover/node:scale-110'}
 `}>
 {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-app-surface" />}
 </div>

 {/* Icon */}
 <Folder
 size={16}
 className={`flex-shrink-0 transition-transform duration-500 group-hover/node:scale-110 group-hover/node:rotate-6 ${isSelected ? 'text-emerald-600' : level === 0 ? 'text-app-text-faint' : 'text-slate-300'}`}
 />

 {/* Category Name */}
 <div className="flex-1 min-w-0 flex items-center gap-3">
 <span className={`text-[11px] font-black uppercase tracking-tight truncate transition-colors ${isSelected ? 'text-emerald-800' : 'text-app-text-muted group-hover/node:text-app-text'}`}>
 {category.name}
 </span>
 {category.code && (
 <span className="text-[9px] font-mono text-app-text-faint bg-app-surface-2 px-1.5 py-0.5 rounded-lg border border-slate-200/50 group-hover/node:bg-app-surface group-hover/node:text-app-text-muted transition-all">
 {category.code}
 </span>
 )}
 {level === 0 && (
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 )}
 </div>
 </div>

 {/* Children with forensic alignment indicator */}
 {isExpanded && hasChildren && (
 <div className="ml-3.5 mt-1 relative">
 <div className="absolute left-3 top-0 bottom-6 w-[1px] bg-app-surface-2" />
 <div className="space-y-1">
 {category.children!.map(child => (
 <CategoryTreeNode
 key={child.id}
 category={child}
 level={level + 1}
 selectedIds={selectedIds}
 onToggle={onToggle}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 );
});