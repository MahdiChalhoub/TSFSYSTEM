import { erpFetch } from "@/lib/erp-api";
import { getMaintenanceEntities } from "@/app/actions/maintenance";
import { MaintenanceSidebar } from "@/components/admin/maintenance/MaintenanceSidebar";
import { UnifiedReassignmentTable } from "@/components/admin/maintenance/UnifiedReassignmentTable";
import { ArrowLeft, Layers, Tag, Ruler, Globe, Package } from "lucide-react";
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
        redirect('/admin/inventory/maintenance?tab=category');
    }

    // 1. Fetch Entities (Sidebar Data)
    const entities = await getMaintenanceEntities(tab as any);

    // 2. Fetch Products (if active)
    let products: any[] = [];
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
    function findEntityRecursive(list: any[], id: number): any {
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
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-gray-50 -m-6">
            {/* Header with Tabs */}
            <header className="bg-white border-b border-gray-200 shadow-sm z-20">
                <div className="px-6 py-4 flex items-center gap-4">
                    <Link
                        href="/admin/inventory"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Inventory Maintenance</h1>
                        <p className="text-sm text-gray-500">Reorganize your inventory structure.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-6 space-x-1 overflow-x-auto no-scrollbar">
                    <TabLink currentTab={tab} targetTab="category" icon={Layers} label="Categories" />
                    <TabLink currentTab={tab} targetTab="brand" icon={Tag} label="Brands" />
                    <TabLink currentTab={tab} targetTab="attribute" icon={Package} label="Attributes" />
                    <TabLink currentTab={tab} targetTab="unit" icon={Ruler} label="Units" />
                    <TabLink currentTab={tab} targetTab="country" icon={Globe} label="Countries" />
                </div>
            </header>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Generic Sidebar */}
                <MaintenanceSidebar
                    entities={safeEntities}
                    type={tab}
                    activeId={activeId}
                />

                {/* Main Area */}
                <main className="flex-1 overflow-hidden bg-gray-50 p-4 flex flex-col min-w-0">
                    {activeId ? (
                        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    {currentEntityName}
                                    <span className="text-sm font-normal text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                        {products.length} products
                                    </span>
                                </h2>
                            </div>

                            <div className="flex-1 min-h-0">
                                <UnifiedReassignmentTable
                                    products={safeProducts}
                                    targetEntities={safeEntities}
                                    type={tab as any}
                                    currentEntityId={activeId}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                <Layers size={32} />
                            </div>
                            <p className="font-medium">Select an item from the sidebar to manage.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function TabLink({ currentTab, targetTab, icon: Icon, label }: any) {
    const isActive = currentTab === targetTab;
    return (
        <Link
            href={`/admin/inventory/maintenance?tab=${targetTab}`}
            className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
                ${isActive ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
            `}
        >
            <Icon size={16} />
            <span className="font-medium text-sm">{label}</span>
        </Link>
    );
}
