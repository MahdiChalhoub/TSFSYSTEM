import { erpFetch } from "@/lib/erp-api";
import { getMaintenanceEntities } from "@/app/actions/maintenance";
import { MaintenanceSidebar } from "@/components/admin/maintenance/MaintenanceSidebar";
import { UnifiedReassignmentTable } from "@/components/admin/maintenance/UnifiedReassignmentTable";
import { ArrowLeft, Layers, Tag, Ruler, Globe, Package, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function MaintenancePage(props: {
 searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
 const searchParams = await props.searchParams;
 const tab = (searchParams.tab as string) || 'category';
 const activeId = searchParams.id ? Number(searchParams.id) : null;

 // Validate Tab
 const validTabs = ['category', 'brand', 'unit', 'country', 'attribute'];
 if (!validTabs.includes(tab)) {
 redirect('/inventory/maintenance?tab=category');
 }

 // 1. Fetch Entities (Sidebar Data)
 const entities = await getMaintenanceEntities(tab as any);

 // 2. Fetch Products (if active)
 let products: Record<string, any>[] = [];
 let currentEntityName = `Select ${tab.charAt(0).toUpperCase() + tab.slice(1)}`;

 if (activeId) {
 let filterKey = '';
 if (tab === 'category') filterKey = 'category';
 if (tab === 'brand') filterKey = 'brand';
 if (tab === 'unit') filterKey = 'unit';
 if (tab === 'country') filterKey = 'country';
 if (tab === 'attribute') filterKey = 'parfum';

 try {
 products = await erpFetch(`products/?${filterKey}=${activeId}`);
 } catch (e) {
 console.error("Failed to fetch products for maintenance:", e);
 }

 const activeEntity = findEntityRecursive(entities, activeId);
 if (activeEntity) currentEntityName = activeEntity.name;
 }

 // Helper to find entity in flat list OR tree
 function findEntityRecursive(list: Record<string, any>[], id: number): Record<string, any> | null {
 for (const item of list) {
 if (item.id === id) return item;
 if (item.children) {
 const found = findEntityRecursive(item.children, id);
 if (found) return found;
 }
 }
 return null;
 }

 // Props safe for client
 const safeEntities = JSON.parse(JSON.stringify(entities));
 const safeProducts = JSON.parse(JSON.stringify(products));

 return (
 <div className="page-container animate-in fade-in duration-700">
 {/* Standard Header */}
 <header className="flex flex-col gap-8 mb-10">
 <div className="flex justify-between items-end">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
 <Layers size={40} className="text-app-text fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 System Intelligence
 </Badge>
 <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
 <ShieldCheck size={14} className="text-emerald-400" /> Structure Integrity
 </span>
 </div>
 <h1 className="page-header-title">
 Inventory <span className="text-emerald-700">Maintenance</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Manage and reorganize your products across categories, brands, and warehouses.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <div className="h-16 px-8 rounded-2xl bg-app-surface border border-app-border shadow-xl shadow-slate-200/50 flex flex-col justify-center">
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest mb-1">Active Context</p>
 <div className="flex items-center gap-3">
 <Package size={18} className="text-emerald-500" />
 <span className="text-xl font-black text-app-text tracking-tight">{tab.toUpperCase()}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Tabs Hub */}
 <div className="flex items-center gap-2 bg-slate-50/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-app-border self-start shadow-inner overflow-x-auto no-scrollbar max-w-full">
 <TabLink currentTab={tab} targetTab="category" icon={Layers} label="Categories" />
 <TabLink currentTab={tab} targetTab="brand" icon={Tag} label="Brands" />
 <TabLink currentTab={tab} targetTab="attribute" icon={Package} label="Attributes" />
 <TabLink currentTab={tab} targetTab="unit" icon={Ruler} label="Units" />
 <TabLink currentTab={tab} targetTab="country" icon={Globe} label="Countries" />
 <div className="w-[1px] h-6 bg-slate-200 mx-2 flex-shrink-0" />
 <Link
 href="/inventory/maintenance/data-quality"
 className="flex items-center gap-3 px-6 py-4 rounded-xl text-app-text-faint hover:text-orange-600 hover:bg-orange-50/50 transition-all group"
 >
 <ShieldCheck size={18} className="group-hover:animate-pulse" />
 <span className="text-[11px] font-black uppercase tracking-widest">Data Audit</span>
 </Link>
 </div>
 </header>

 {/* Content Area */}
 <div className="flex flex-1 overflow-hidden min-h-[600px] gap-8">
 {/* Generic Sidebar with Glassmorphism */}
 <div className="w-[380px] shrink-0 border border-app-border bg-app-text/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col">
 <MaintenanceSidebar
 entities={safeEntities}
 type={tab}
 activeId={activeId}
 />
 </div>

 {/* Main Area */}
 <main className="flex-1 overflow-hidden flex flex-col min-w-0">
 {activeId ? (
 <div className="flex-1 card-premium flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-700">
 <div className="px-8 py-6 border-b border-app-border bg-emerald-50/30 flex justify-between items-center shrink-0">
 <div>
 <h2 className="text-lg font-black text-app-text uppercase tracking-tight flex items-center gap-3">
 <div className="w-2 h-6 bg-emerald-500 rounded-full" />
 {currentEntityName}
 </h2>
 <p className="text-[10px] font-bold text-app-text-faint uppercase tracking-widest mt-1 ml-5">Mode: Maintenance</p>
 </div>
 <Badge variant="secondary" className="bg-app-surface border-0 text-emerald-600 font-black text-[10px] px-4 py-1.5 rounded-full shadow-sm">
 {products.length} Products Found
 </Badge>
 </div>

 <div className="flex-1 min-h-0 bg-app-text/30">
 <UnifiedReassignmentTable
 products={safeProducts}
 targetEntities={safeEntities}
 type={tab as any}
 currentEntityId={activeId}
 />
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col items-center justify-center text-slate-300 card-premium bg-app-text/50 backdrop-blur-xl animate-in zoom-in duration-700">
 <div className="w-24 h-24 bg-app-surface-2 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner shadow-slate-200">
 <Layers size={48} className="text-slate-200" />
 </div>
 <h3 className="text-sm font-black text-app-text-faint uppercase tracking-widest">Awaiting Entity Selection</h3>
 <p className="text-[10px] font-bold text-app-text-faint mt-2 uppercase tracking-tighter italic">Select a structural node from the sidebar to initialize re-mapping.</p>
 </div>
 )}
 </main>
 </div>
 </div>
 );
}

function TabLink({ currentTab, targetTab, icon: Icon, label }: Record<string, any>) {
 const isActive = currentTab === targetTab;
 return (
 <Link
 href={`/inventory/maintenance?tab=${targetTab}`}
 className={`
 flex items-center gap-3 px-6 py-4 rounded-xl transition-all whitespace-nowrap relative group
 ${isActive
 ? 'bg-emerald-600 text-app-text shadow-lg shadow-emerald-700/20 active:scale-95'
 : 'text-app-text-faint hover:text-app-text-muted hover:bg-app-surface'}
 `}
 >
 <Icon size={18} className={isActive ? "text-app-text fill-white/20" : "text-app-text-faint group-hover:text-emerald-500 group-hover:scale-110 transition-all"} />
 <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? "text-app-text" : "text-app-text-muted"}`}>{label}</span>
 {isActive && (
 <div className="absolute -bottom-1 left-4 right-4 h-1 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
 )}
 </Link>
 );
}