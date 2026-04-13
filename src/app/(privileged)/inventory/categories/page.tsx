import { erpFetch } from "@/lib/erp-api";
import { CategoryTree } from "@/components/admin/categories/CategoryTree";
import { CreateCategoryButton } from "@/components/admin/categories/CreateCategoryButton";
import { Wrench, FolderTree } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
    const categories = await erpFetch('categories/');

    const categoryMap = new Map();
    const roots: Record<string, any>[] = [];

    if (Array.isArray(categories)) {
        categories.forEach((c: Record<string, any>) => {
            categoryMap.set(c.id, {
                ...c,
                children: [],
                product_count: c.product_count ?? c.productCount ?? 0,
            });
        });

        categories.forEach((c: Record<string, any>) => {
            const node = categoryMap.get(c.id);
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
        });
    }

    return {
        hierarchicalCategories: JSON.parse(JSON.stringify(roots)),
        flatCategories: JSON.parse(JSON.stringify(categories))
    };
}

export default async function CategoriesPage() {
    const { hierarchicalCategories, flatCategories } = await getCategoriesData();

    const totalCategories = flatCategories?.length || 0;
    const rootCount = hierarchicalCategories?.length || 0;
    const totalProducts = flatCategories?.reduce((sum: number, c: Record<string, any>) => sum + (c.product_count ?? c.productCount ?? 0), 0) || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* V2 Icon-Box Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 fade-in-up">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'var(--app-primary-bg, color-mix(in srgb, var(--app-primary) 10%, transparent))',
                            border: '1px solid var(--app-primary-border, color-mix(in srgb, var(--app-primary) 20%, transparent))',
                        }}
                    >
                        <FolderTree size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                            Inventory / Taxonomy
                        </p>
                        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            Product Categories
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                            Organize your inventory with a flexible category hierarchy.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">

                    <Link
                        href="/inventory/maintenance?tab=category"
                        className="px-4 py-2.5 rounded-xl font-bold text-[12px] flex items-center gap-2 transition-all"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                    >
                        <Wrench size={16} />
                        Maintenance
                    </Link>
                    <CreateCategoryButton potentialParents={flatCategories || []} />
                </div>
            </header>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Categories', value: totalCategories },
                    { label: 'Root Categories', value: rootCount },
                    { label: 'Linked Products', value: totalProducts },
                ].map(kpi => (
                    <div key={kpi.label} className="p-4 rounded-xl" style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{kpi.label}</p>
                        <p className="text-2xl font-black mt-1" style={{ color: 'var(--app-text)' }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="p-5 rounded-2xl" style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
            }}>
                <div className="flex justify-between items-center mb-5 pb-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <h3 className="text-lg font-black" style={{ color: 'var(--app-text)' }}>Category Structure</h3>
                    <input
                        type="text"
                        placeholder="Search categories..."
                        className="px-4 py-2 rounded-xl text-[12px] w-64 transition-all outline-none"
                        style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                    />
                </div>

                {hierarchicalCategories.length > 0 ? (
                    <CategoryTree categories={hierarchicalCategories} allCategories={flatCategories || []} />
                ) : (
                    <div className="py-12 text-center" style={{ color: 'var(--app-text-muted)' }}>
                        <p>No categories defined yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}