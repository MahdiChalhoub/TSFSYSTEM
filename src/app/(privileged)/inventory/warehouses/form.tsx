'use client';

import { useActionState, useState } from 'react';
import { createWarehouse, updateWarehouse } from '@/app/actions/inventory/warehouses';
import { Warehouse, X, Building2, Store, Cloud, MapPin, Phone, FileText } from 'lucide-react';

const LOCATION_TYPES = [
    { value: 'BRANCH', label: 'Branch / Site', icon: Building2, desc: 'Top-level location (HQ, branch, office)', color: 'indigo' },
    { value: 'STORE', label: 'Store', icon: Store, desc: 'Retail point-of-sale location', color: 'emerald' },
    { value: 'WAREHOUSE', label: 'Warehouse', icon: Warehouse, desc: 'Pure storage / inventory hub', color: 'slate' },
    { value: 'VIRTUAL', label: 'Virtual', icon: Cloud, desc: 'Transit, consignment, or virtual stock', color: 'violet' },
];

export default function WarehouseModal({
    warehouse,
    onClose,
    parentOptions = [],
}: {
    warehouse?: Record<string, any>,
    onClose: () => void,
    parentOptions?: { id: number; name: string }[],
}) {
    const [state, action, isPending] = useActionState(
        warehouse ? updateWarehouse.bind(null, warehouse.id) : createWarehouse,
        { message: '' }
    );

    const [locationType, setLocationType] = useState(warehouse?.location_type || 'WAREHOUSE');

    const selectedType = LOCATION_TYPES.find(t => t.value === locationType) || LOCATION_TYPES[2];
    const TypeIcon = selectedType.icon;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-${selectedType.color}-100 text-${selectedType.color}-600`}>
                            <TypeIcon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {warehouse ? 'Edit Location' : 'New Location'}
                            </h2>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{selectedType.label}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-900">
                        <X size={20} />
                    </button>
                </div>

                <form action={async (fd) => {
                    await action(fd);
                    onClose();
                }} className="p-6 space-y-5">

                    {/* Location Type Picker */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Location Type</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {LOCATION_TYPES.map(lt => {
                                const Icon = lt.icon;
                                const isSelected = locationType === lt.value;
                                return (
                                    <label key={lt.value}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 cursor-pointer transition-all text-center
                                            ${isSelected
                                                ? `border-${lt.color}-500 bg-${lt.color}-50 shadow-md`
                                                : 'border-gray-100 hover:border-gray-200 bg-white'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="location_type"
                                            value={lt.value}
                                            checked={isSelected}
                                            onChange={() => setLocationType(lt.value)}
                                            className="sr-only"
                                        />
                                        <Icon size={20} className={isSelected ? `text-${lt.color}-600` : 'text-gray-400'} />
                                        <span className={`text-xs font-bold ${isSelected ? `text-${lt.color}-700` : 'text-gray-500'}`}>{lt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Core Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Location Name</label>
                            <input
                                name="name"
                                defaultValue={warehouse?.name}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g., Central Warehouse, Downtown Store…"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Code</label>
                            <input
                                name="code"
                                defaultValue={warehouse?.code}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                placeholder="Auto-generated"
                            />
                            <p className="mt-1 text-[10px] text-gray-400">Leave blank for auto-increment</p>
                        </div>

                        {parentOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Parent Location</label>
                                <select
                                    name="parent"
                                    defaultValue={warehouse?.parent || ''}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                >
                                    <option value="">— None (Top Level) —</option>
                                    {parentOptions.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Address Section */}
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                            <MapPin size={16} />
                            Physical Address
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <input
                                    name="address"
                                    defaultValue={warehouse?.address}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                    placeholder="Street address…"
                                />
                            </div>
                            <input
                                name="city"
                                defaultValue={warehouse?.city}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                placeholder="City"
                            />
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-400 shrink-0" />
                                <input
                                    name="phone"
                                    defaultValue={warehouse?.phone}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                    placeholder="Phone"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-gray-400 shrink-0" />
                            <input
                                name="vat_number"
                                defaultValue={warehouse?.vat_number}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                placeholder="VAT / Tax ID"
                            />
                        </div>
                    </div>

                    {/* Operational Flags */}
                    <div className="p-4 bg-emerald-50 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-emerald-900">Commercial Point of Sale</h4>
                                <p className="text-[10px] text-emerald-700">Can items be sold directly from this location?</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="canSell" defaultChecked={warehouse?.can_sell !== false} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="isActive" defaultChecked={warehouse?.is_active !== false} id="isActive" className="rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active and available for operations</label>
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
                            className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all text-sm disabled:opacity-50"
                        >
                            {isPending ? 'Saving...' : (warehouse ? 'Update Location' : 'Create Location')}
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