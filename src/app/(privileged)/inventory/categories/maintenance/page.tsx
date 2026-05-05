import { erpFetch } from "@/lib/erp-api";
import { getCategoryWithCounts } from "@/app/actions/categories";
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
        <div
            className="flex flex-col bg-app-surface md:-m-6"
            style={{ height: 'calc(100dvh - var(--mobile-chrome, 6rem))' }}>
            {/* Header — compact on mobile */}
            <header className="bg-app-surface border-b border-app-border px-3 md:px-6 py-2.5 md:py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    <Link
                        href={activeCategoryId ? "/inventory/categories/maintenance" : "/inventory/categories"}
                        className="p-2 rounded-lg hover:bg-app-surface-2 text-app-muted-foreground transition-colors flex-shrink-0"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="truncate" style={{ fontSize: 'var(--tp-xl)' }}>
                            {activeCategoryId ? currentCategoryName : 'Category Maintenance'}
                        </h1>
                        <p className="text-app-muted-foreground hidden md:block truncate" style={{ fontSize: 'var(--tp-md)' }}>
                            {activeCategoryId
                                ? `${products.length} product${products.length === 1 ? '' : 's'}`
                                : 'Reorganize products by moving them between categories.'}
                        </p>
                        {activeCategoryId && (
                            <p className="text-app-muted-foreground md:hidden truncate" style={{ fontSize: 'var(--tp-xs)' }}>
                                {products.length} product{products.length === 1 ? '' : 's'}
                            </p>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content — sidebar + main on desktop, single view on mobile */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar: full-width list on mobile (shown only when no category selected).
                    Fixed 320px rail on desktop (always shown). */}
                <div className={activeCategoryId ? 'hidden md:block' : 'block flex-1 md:flex-initial min-h-0'}>
                    <CategoryMaintenanceSidebar
                        categories={safeCategories}
                        activeCategoryId={activeCategoryId}
                    />
                </div>

                {/* Main Area: hidden on mobile when no selection, full screen when selected */}
                <main className={`flex-1 overflow-hidden bg-app-surface relative ${activeCategoryId ? 'flex' : 'hidden md:flex'}`}>
                    {activeCategoryId ? (
                        <div className="h-full w-full flex flex-col">
                            <div className="flex-1 p-3 md:p-4 min-h-0">
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
                        <div className="h-full w-full flex flex-col items-center justify-center text-app-muted-foreground p-6">
                            <div className="w-16 h-16 bg-app-surface-2 rounded-full flex items-center justify-center mb-4">
                                <ArrowLeft size={32} />
                            </div>
                            <p className="font-medium text-center" style={{ fontSize: 'var(--tp-md)' }}>
                                Select a category from the list to manage its products.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}