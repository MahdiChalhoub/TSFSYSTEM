'use client';

import { useActionState, useState } from 'react';
import { createWarehouse, updateWarehouse } from '@/app/actions/inventory/warehouses';
import { Warehouse, X } from 'lucide-react';

export default function WarehouseModal({
    warehouse,
    onClose
}: {
    warehouse?: any,
    onClose: () => void
}) {
    const [state, action, isPending] = useActionState(
        warehouse ? updateWarehouse.bind(null, warehouse.id) : createWarehouse,
        { message: '' }
    );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Warehouse className="text-emerald-600" size={20} />
                        <h2 className="text-xl font-bold text-gray-900">
                            {warehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-900">
                        <X size={20} />
                    </button>
                </div>

                <form action={async (fd) => {
                    await action(fd);
                    onClose();
                }} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Warehouse Name</label>
                            <input
                                name="name"
                                defaultValue={warehouse?.name}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="e.g., Central Warehouse"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Code</label>
                            <input
                                name="code"
                                defaultValue={warehouse?.code}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="WH-01"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                            <select
                                name="type"
                                defaultValue={warehouse?.type || 'PHYSICAL'}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            >
                                <option value="PHYSICAL">Physical</option>
                                <option value="VIRTUAL">Virtual</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-emerald-900">Commercial Store</h4>
                                <p className="text-[10px] text-emerald-700">Can items be sold directly from this location?</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="canSell" defaultChecked={warehouse?.can_sell} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    </div>



                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="isActive" defaultChecked={warehouse?.is_active !== false} id="isActive" className="rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active and available for stock movements</label>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all text-sm disabled:opacity-50"
                        >
                            {isPending ? 'Saving...' : (warehouse ? 'Update Warehouse' : 'Create Warehouse')}
                        </button>
                    </div>

                    {state.message && state.message !== 'success' && (
                        <p className="text-center text-red-500 text-xs font-bold">{state.message}</p>
                    )}
                </form>
            </div>
        </div>
    );
}