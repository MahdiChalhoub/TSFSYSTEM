import { prisma } from "@/lib/db";
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

    let products: any[] = [];
    let currentCategoryName = "Select a Category";

    if (activeCategoryId) {
        products = await prisma.product.findMany({
            where: { categoryId: activeCategoryId },
            select: {
                id: true,
                name: true,
                productGroup: { select: { image: true } },
                brand: { select: { name: true } },
                unit: { select: { name: true } }
            },
            orderBy: { name: 'asc' }
        });

        const activeCat = categories.find(c => c.id === activeCategoryId);
        if (activeCat) currentCategoryName = activeCat.name;
    }

    // Clean data for client components
    const safeCategories = JSON.parse(JSON.stringify(categories));
    const safeProducts = JSON.parse(JSON.stringify(products));

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-gray-50 -m-6">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/inventory/categories"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Category Maintenance</h1>
                        <p className="text-sm text-gray-500">Reorganize products by moving them between categories.</p>
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
                <main className="flex-1 overflow-hidden bg-gray-50 relative">
                    {activeCategoryId ? (
                        <div className="h-full flex flex-col">
                            <div className="p-4 pb-0">
                                <h2 className="text-lg font-bold text-gray-800">
                                    {currentCategoryName}
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({products.length} products)
                                    </span>
                                </h2>
                            </div>
                            <div className="flex-1 p-4 min-h-0">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full overflow-hidden">
                                    <ProductReassignmentTable
                                        products={safeProducts}
                                        categories={safeCategories}
                                        currentCategoryId={activeCategoryId}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
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
