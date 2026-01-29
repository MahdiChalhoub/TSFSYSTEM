import { prisma } from "@/lib/db";
import { Plus, Search, Warehouse, MapPin } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    return await prisma.warehouse.findMany({
        include: {
            _count: {
                select: { inventory: true }
            }
        },
        orderBy: { name: 'asc' }
    });
}

export default async function WarehousesPage() {
    const warehouses = await getWarehouses();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Warehouses</h1>
                    <p className="text-gray-500">Manage storage locations and inventory points.</p>
                </div>
                <button className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    <Plus size={20} />
                    <span>Add New Warehouse</span>
                </button>
            </div>

            {/* Content */}
            <div className="card-premium p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {warehouses.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-gray-400">
                            <p>No warehouses found.</p>
                        </div>
                    ) : (
                        warehouses.map((wh) => (
                            <div key={wh.id} className="group border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all bg-white relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                        <Warehouse size={24} />
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wide
                                        ${wh.type === 'STORE' ? 'bg-emerald-50 text-emerald-600' :
                                            wh.type === 'PHYSICAL' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'}
                                    `}>
                                        {wh.type}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-1">{wh.name}</h3>

                                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                                    <MapPin size={14} className="text-gray-400" />
                                    <span>Main Location</span>
                                </div>

                                <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Inventory Items</span>
                                    <span className="text-lg font-bold text-gray-900">{wh._count.inventory}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
