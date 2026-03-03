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
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Wrench size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Data <span className="text-app-primary">Maintenance</span>
          </h1>
        </div>
      </div>
    </header>

 {/* Content Area */}
 <div className="flex flex-1 overflow-hidden min-h-[600px] gap-8">
 {/* Generic Sidebar with Glassmorphism */}
 <div className="w-[380px] shrink-0 border border-app-border bg-app-foreground/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-app-border/20 overflow-hidden flex flex-col">
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
 <div className="px-8 py-6 border-b border-app-border bg-app-primary-light/30 flex justify-between items-center shrink-0">
 <div>
 <h2 className="text-lg font-black text-app-foreground uppercase tracking-tight flex items-center gap-3">
 <div className="w-2 h-6 bg-app-primary rounded-full" />
 {currentEntityName}
 </h2>
 <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1 ml-5">Mode: Maintenance</p>
 </div>
 <Badge variant="secondary" className="bg-app-surface border-0 text-app-primary font-black text-[10px] px-4 py-1.5 rounded-full shadow-sm">
 {products.length} Products Found
 </Badge>
 </div>

 <div className="flex-1 min-h-0 bg-app-foreground/30">
 <UnifiedReassignmentTable
 products={safeProducts}
 targetEntities={safeEntities}
 type={tab as any}
 currentEntityId={activeId}
 />
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col items-center justify-center text-app-muted-foreground card-premium bg-app-foreground/50 backdrop-blur-xl animate-in zoom-in duration-700">
 <div className="w-24 h-24 bg-app-surface-2 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner shadow-app-border/20">
 <Layers size={48} className="text-app-foreground" />
 </div>
 <h3 className="text-sm font-black text-app-muted-foreground uppercase tracking-widest">Awaiting Entity Selection</h3>
 <p className="text-[10px] font-bold text-app-muted-foreground mt-2 uppercase tracking-tighter italic">Select a structural node from the sidebar to initialize re-mapping.</p>
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
 ? 'bg-app-primary text-app-foreground shadow-lg shadow-app-primary/20 active:scale-95'
 : 'text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-surface'}
 `}
 >
 <Icon size={18} className={isActive ? "text-app-foreground fill-white/20" : "text-app-muted-foreground group-hover:text-app-primary group-hover:scale-110 transition-all"} />
 <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? "text-app-foreground" : "text-app-muted-foreground"}`}>{label}</span>
 {isActive && (
 <div className="absolute -bottom-1 left-4 right-4 h-1 bg-app-success/10 rounded-full shadow-[0_0_10px_var(--app-success)]" />
 )}
 </Link>
 );
}