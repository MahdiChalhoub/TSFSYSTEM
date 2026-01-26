import Link from 'next/link';
import { prisma } from "@/lib/db";
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, Package, Tag, Barcode } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getProducts() {
    return await prisma.product.findMany({
        include: {
            category: true,
            inventory: true // See stock levels
        },
        orderBy: { id: 'desc' }
    });
}

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Product Registry</h1>
                    <p className="text-gray-500 mt-1 text-lg">Manage your entire product catalog, pricing, and stock.</p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="group bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                    <div className="bg-white/20 p-1 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                        <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span>Add New Product</span>
                </Link>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products by name, SKU, or barcode..."
                        className="w-full pl-11 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
                    <Filter size={18} />
                    <span>Filter</span>
                </button>
            </div>

            {/* Products Table */}
            <div className="card-premium p-0 overflow-hidden shadow-xl border border-white/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold text-left">
                                <th className="py-4 px-6">Product Information</th>
                                <th className="py-4 px-6">SKU / Barcode</th>
                                <th className="py-4 px-6">Price Details</th>
                                <th className="py-4 px-6">Inventory</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="bg-gray-100 p-4 rounded-full">
                                                <Package size={40} className="text-gray-300" />
                                            </div>
                                            <p className="text-lg">No products found</p>
                                            <Link href="/admin/products/new" className="text-emerald-600 hover:text-emerald-700 font-medium">Create your first product</Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                products.map(p => {
                                    const totalStock = p.inventory.reduce((acc, inv) => acc + Number(inv.quantity), 0);
                                    const hasLowStock = totalStock < 10; // Threshold example

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/60 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 text-base mb-1 group-hover:text-emerald-700 transition-colors">{p.name}</span>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                                        <Tag size={12} />
                                                        <span>{p.category?.name || 'Uncategorized'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col gap-1.5 align-start">
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-xs font-mono font-medium text-gray-600 w-fit">
                                                        {p.sku}
                                                    </div>
                                                    {p.barcode && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                            <Barcode size={12} />
                                                            <span className="tracking-wide">{p.barcode}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">${Number(p.basePrice).toFixed(2)}</span>
                                                    <div className="text-xs text-gray-500">
                                                        Tax: {Number(p.taxRate) * 100}%
                                                        {p.isTaxIncluded ?
                                                            <span className="text-emerald-600 font-medium ml-1">(Inc)</span> :
                                                            <span className="text-amber-600 font-medium ml-1">(Exc)</span>
                                                        }
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${totalStock > 0 ? "bg-emerald-500" : "bg-red-500"}`}></div>
                                                    <span className={`font-medium ${totalStock === 0 ? "text-red-600" : "text-gray-700"}`}>
                                                        {totalStock} units
                                                    </span>
                                                    {hasLowStock && totalStock > 0 && (
                                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Low</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2 hover:bg-white text-gray-400 hover:text-blue-600 hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-gray-200" title="Edit">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="p-2 hover:bg-white text-gray-400 hover:text-red-600 hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-gray-200" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination (Mock) */}
                <div className="bg-white/50 border-t border-gray-200 p-4 flex items-center justify-between text-sm text-gray-500">
                    <span>Showing {products.length} entries</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-white">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
