import { erpFetch } from "@/lib/erp-api";
import { CategoryTree } from "@/components/admin/categories/CategoryTree";
import { CreateCategoryButton } from "@/components/admin/categories/CreateCategoryButton";
import { Wrench } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
    // erpFetch returns raw array for standard ViewSet list, but we implemented 'with_counts'
    // which returns the enriched list.
    const categories = await erpFetch('categories/with_counts/');

    // Build Tree (Client-side logic moved here or kept? Logic is pure JS, can stay)
    const categoryMap = new Map();
    const roots: any[] = [];

    if (Array.isArray(categories)) {
        // Initialize Map with empty children array
        categories.forEach((c: any) => {
            categoryMap.set(c.id, { ...c, children: [] });
        });

        // Link Children to Parents
        categories.forEach((c: any) => {
            const node = categoryMap.get(c.id);
            if (c.parentId) { // Ensure backend sends camelCase or we map keys.
                // DRF default is snake_case unless configured.
                // Standard ModelSerializer uses model field names.
                // Category model: name, short_name, code, parent.
                // So backend returns: parent, short_name etc.
                // Frontend code uses: parentId.
                // WE NEED TO MAP or ADJUST.
                // Refactoring: Let's check CategorySerializer.
                // It uses fields='__all__'. So it emits 'parent'.
                // Frontend expects 'parentId'.
                // 'parent' in DRF defaults to PK if not nested. So 'parent': 5.
                // So c.parent is the ID.
                const parentId = c.parent;
                if (parentId) {
                    const parent = categoryMap.get(parentId);
                    if (parent) {
                        parent.children.push(node);
                    } else {
                        roots.push(node);
                    }
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });
    }

    return {
        hierarchicalCategories: JSON.parse(JSON.stringify(roots)),
        flatCategories: JSON.parse(JSON.stringify(categories))
    };
}

export default async function CategoriesPage() {
    const { hierarchicalCategories, flatCategories } = await getCategoriesData();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Product Categories</h1>
                    <p className="text-gray-500">Organize your inventory with a flexible category hierarchy.</p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/inventory/maintenance?tab=category"
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-emerald-600 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2"
                    >
                        <Wrench size={18} />
                        <span>Maintenance tool</span>
                    </Link>
                    <CreateCategoryButton potentialParents={flatCategories || []} />
                </div>
            </div>

            {/* Content */}
            <div className="card-premium p-6">
                {/* Tree Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">Category Structure</h3>
                    <input
                        type="text"
                        placeholder="Search categories..."
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 w-64 transition-all"
                    />
                </div>

                {hierarchicalCategories.length > 0 ? (
                    <CategoryTree categories={hierarchicalCategories} allCategories={flatCategories || []} />
                ) : (
                    <div className="py-12 text-center text-gray-400">
                        <p>No categories defined yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}