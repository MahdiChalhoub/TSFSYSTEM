import { erpFetch } from "@/lib/erp-api";
import { getCategoryWithCounts } from "@/app/actions/inventory/categories";
import { CategoryMaintenanceSidebar } from "@/components/admin/CategoryMaintenanceSidebar";
import { ProductReassignmentTable } from "@/components/admin/ProductReassignmentTable";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function CategoryMaintenancePage(props: {
 searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
 const searchParams = await props.searchParams;
 const categories = await getCategoryWithCounts();
 const activeCategoryId = searchParams.categoryId ? Number(searchParams.categoryId) : null;

 let products: Record<string, any>[] = [];
 let currentCategoryName = "Select a Category";

 if (activeCategoryId) {
 try {
 products = await erpFetch(`products/?category=${activeCategoryId}`);
 } catch (e) {
 console.error("Failed to fetch products for category maintenance:", e);
 }

 const activeCat = categories.find((c: Record<string, any>) => c.id === activeCategoryId);
 if (activeCat) currentCategoryName = activeCat.name;
 }

 // Clean data for client components
 const safeCategories = JSON.parse(JSON.stringify(categories));
 const safeProducts = JSON.parse(JSON.stringify(products));

 return (
 <div className="app-page flex flex-col h-[calc(100vh-6rem)] bg-app-background -m-6">
 {/* Header */}
 <header className="bg-app-surface border-b border-app-border px-6 py-4 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-4">
 <Link
 href="/inventory/categories"
 className="p-2 rounded-lg hover:bg-app-surface-2 text-app-muted-foreground transition-colors"
 >
 <ArrowLeft size={20} />
 </Link>
 <div className="w-14 h-14 rounded-2xl bg-app-primary flex items-center justify-center shadow-lg shadow-emerald-200">
 <ArrowLeft size={28} className="text-app-foreground rotate-180 hidden" />
 <span className="text-app-foreground font-black text-lg">C</span>
 </div>
 <div>
 <h1 className="page-header-title tracking-tighter">Category <span className="text-app-primary">Maintenance</span></h1>
 <p className="text-sm text-app-muted-foreground">Reorganize products by moving them between categories.</p>
 </div>
 </div>
 </header>

 {/* Main Content */}
 <div className="flex flex-1 overflow-hidden">
 {/* Sidebar */}
 <CategoryMaintenanceSidebar
 categories={safeCategories}
 activeCategoryId={activeCategoryId}
 />

 {/* Main Area */}
 <main className="flex-1 overflow-hidden bg-app-background relative">
 {activeCategoryId ? (
 <div className="h-full flex flex-col">
 <div className="p-4 pb-0">
 <h2 className="text-lg font-bold text-app-foreground">
 {currentCategoryName}
 <span className="ml-2 text-sm font-normal text-app-muted-foreground">
 ({products.length} products)
 </span>
 </h2>
 </div>
 <div className="flex-1 p-4 min-h-0">
 <div className="bg-app-surface rounded-xl shadow-sm border border-app-border h-full overflow-hidden">
 <ProductReassignmentTable
 products={safeProducts}
 categories={safeCategories}
 currentCategoryId={activeCategoryId}
 />
 </div>
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col items-center justify-center text-app-muted-foreground">
 <div className="w-16 h-16 bg-app-border rounded-full flex items-center justify-center mb-4">
 <ArrowLeft size={32} />
 </div>
 <p className="font-medium">Select a category from the sidebar to manage its products.</p>
 </div>
 )}
 </main>
 </div>
 </div>
 );
}