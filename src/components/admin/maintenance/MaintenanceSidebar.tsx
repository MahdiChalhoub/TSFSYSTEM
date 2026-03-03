// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Folder, Tag, Package, Globe, Ruler, Database, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useSearchParams } from 'next/navigation';

type MaintenanceEntity = {
 id: number;
 name: string;
 count: number;
 children?: MaintenanceEntity[];
 [key: string]: Record<string, any>;
};

type Props = {
 entities: MaintenanceEntity[];
 type: string; // 'category' | 'brand' | 'unit' | 'country' | 'attribute'
 activeId: number | null;
};

// --- Icons Helper ---
const TypeIcon = ({ type, size = 16 }: { type: string, size?: number }) => {
 switch (type) {
 case 'category': return <Folder size={size} />;
 case 'brand': return <Tag size={size} />;
 case 'unit': return <Ruler size={size} />;
 case 'country': return <Globe size={size} />;
 case 'attribute': return <Package size={size} />;
 default: return <Database size={size} />;
 }
};

export function MaintenanceSidebar({ entities, type, activeId }: Props) {
 const [searchTerm, setSearchTerm] = useState('');
 const searchParams = useSearchParams();

 // Reset search when type changes
 useEffect(() => setSearchTerm(''), [type]);

 // Flat List Filtering
 const filteredEntities = useMemo(() => {
 if (type === 'category') return entities; // Tree handles its own structure (passed as roots)
 return entities.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
 }, [entities, searchTerm, type]);

 const isTree = type === 'category';

 return (
 <div className="w-80 border-r border-app-border bg-app-surface flex flex-col h-full">
 <div className="p-4 border-b border-app-border bg-app-surface-2">
 <h2 className="font-bold text-app-text flex items-center gap-2 capitalize">
 <TypeIcon type={type} size={18} />
 {type} Browser
 </h2>
 <div className="mt-2 text-xs text-app-text-faint">
 Select {type} to mange products.
 </div>
 </div>

 {/* Search Bar (Only for flat lists) */}
 {!isTree && (
 <div className="p-3 border-b border-gray-50">
 <div className="relative">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
 <input
 type="text"
 placeholder={`Search ${type}s...`}
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 className="w-full pl-9 pr-3 py-2 text-sm border border-app-border rounded-lg focus:border-app-primary outline-none"
 />
 </div>
 </div>
 )}

 <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-app-surface">
 {isTree ? (
 // Recursive Tree
 filteredEntities.map(node => (
 <SidebarNode
 key={node.id}
 node={node}
 activeId={activeId}
 type={type}
 level={0}
 />
 ))
 ) : (
 // Flat List
 filteredEntities.length > 0 ? (
 filteredEntities.map((item) => (
 <Link
 key={item.id}
 href={`/inventory/maintenance?tab=${type}&id=${item.id}`}
 className={clsx(
 "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
 activeId === item.id ? "bg-app-primary-light text-app-success" : "hover:bg-app-bg text-app-text-muted"
 )}
 >
 <span className={clsx(activeId === item.id ? "text-app-primary" : "text-app-text-faint")}>
 <TypeIcon type={type} size={16} />
 </span>
 <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
 {item.count > 0 && (
 <span className="text-[10px] font-bold bg-app-surface-2 text-app-text-muted px-2 py-0.5 rounded-full group-hover:bg-app-surface group-hover:shadow-sm">
 {item.count}
 </span>
 )}
 </Link>
 ))
 ) : (
 <div className="py-8 text-center text-app-text-faint text-sm italic">
 No {type}s found.
 </div>
 )
 )}
 </div>
 </div>
 );
}

// Tree Node (Simplified Recursive Version)
function SidebarNode({ node, activeId, type, level }: { node: MaintenanceEntity, activeId: number | null, type: string, level: number }) {
 const [isExpanded, setIsExpanded] = useState(false);
 const hasChildren = node.children && node.children.length > 0;
 const isActive = activeId === node.id;

 // Auto-expand if active is inside/child? (Complex logic omitted for brevity, user can expand manualy)

 return (
 <div>
 <div className={clsx(
 "group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors select-none cursor-pointer",
 isActive ? "bg-app-primary-light text-app-success" : "hover:bg-app-bg text-app-text-muted"
 )}>
 {/* Indent */}
 <div style={{ width: level * 12 }} />

 {/* Toggle */}
 {hasChildren ? (
 <button
 onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }}
 className="p-0.5 rounded hover:bg-black/5 text-app-text-faint"
 >
 {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
 </button>
 ) : (
 <span className="w-4" />
 )}

 <Link
 href={`/inventory/maintenance?tab=${type}&id=${node.id}`}
 className="flex-1 flex items-center gap-2 truncate"
 >
 <Folder size={16} className={clsx(isActive ? "text-app-primary fill-emerald-100" : "text-app-warning")} />
 <span className="truncate text-sm font-medium">{node.name}</span>
 {node.count > 0 && (
 <span className="ml-auto text-[10px] font-bold bg-app-surface-2 text-app-text-muted px-1.5 rounded-full">
 {node.count}
 </span>
 )}
 </Link>
 </div>

 {isExpanded && hasChildren && (
 <div>
 {node.children!.map(child => (
 <SidebarNode key={child.id} node={child} activeId={activeId} type={type} level={level + 1} />
 ))}
 </div>
 )}
 </div>
 );
}