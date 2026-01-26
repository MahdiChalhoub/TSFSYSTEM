'use client';

import { useFormState } from 'react-dom';
import { createProduct } from '../actions';
import { useState } from 'react';

export default function AddProductForm() {
    const initialState = { message: '', errors: {} };
    const [state, dispatch] = useFormState(createProduct, initialState);
    const [autoSku, setAutoSku] = useState(true);

    const generateSku = () => {
        const timestamp = Date.now().toString().slice(-6);
        return `PRD-${timestamp}`;
    };

    return (
        <form action={dispatch} className="max-w-4xl mx-auto space-y-6">

            {/* Error Message Global */}
            {state.message && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    {state.message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* --- Card 1: Basic Info --- */}
                <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Basic Information</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                            <input name="name" type="text" className="w-full input-field" placeholder="e.g. Organic Bananas" required />
                            {state.errors?.name && <p className="text-red-500 text-xs mt-1">{state.errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea name="description" className="w-full input-field" rows={3} placeholder="Product details..."></textarea>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select name="categoryId" className="w-full input-field">
                                <option value="">Select Category...</option>
                                <option value="1">Fresh Produce</option>
                                <option value="2">Dairy & Eggs</option>
                                {/* We will fetch these dynamically later */}
                            </select>
                        </div>
                    </div>
                </div>

                {/* --- Card 2: Identification --- */}
                <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Identification</h3>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between">
                                <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Stock Keeping Unit)</label>
                                <button type="button" onClick={() => {
                                    const input = document.getElementsByName('sku')[0] as HTMLInputElement;
                                    input.value = generateSku();
                                }} className="text-xs text-blue-600 font-medium">Auto-Generate</button>
                            </div>
                            <input name="sku" type="text" className="w-full input-field font-mono" placeholder="PRD-000123" required />
                            {state.errors?.sku && <p className="text-red-500 text-xs mt-1">{state.errors.sku}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                            <div className="flex gap-2">
                                <input name="barcode" type="text" className="w-full input-field font-mono" placeholder="Scan barcode..." />
                                <button type="button" className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600">📷</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Card 3: Pricing --- */}
                <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Pricing Strategy</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price ($)</label>
                            <input name="costPrice" type="number" step="0.01" className="w-full input-field" defaultValue="0.00" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price ($)</label>
                            <input name="basePrice" type="number" step="0.01" className="w-full input-field font-bold text-green-700" defaultValue="0.00" />
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate</label>
                            <select name="taxRate" className="w-full input-field">
                                <option value="0">0% (Exempt)</option>
                                <option value="0.11">11% (Standard)</option>
                                <option value="0.18">18% (Luxury)</option>
                            </select>
                        </div>
                        <div className="flex items-center mt-6">
                            <input type="checkbox" name="isTaxIncluded" id="taxInc" className="w-4 h-4 text-green-600 rounded" defaultChecked />
                            <label htmlFor="taxInc" className="ml-2 text-sm text-gray-700">Tax Included in Price?</label>
                        </div>
                    </div>
                </div>

                {/* --- Card 4: Inventory --- */}
                <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Inventory Settings</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level (Alert)</label>
                            <input name="minStockLevel" type="number" className="w-full input-field" defaultValue="10" />
                        </div>

                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                            <div className="flex items-center">
                                <input type="checkbox" name="isExpiryTracked" id="exp" className="w-4 h-4 text-yellow-600 rounded" />
                                <label htmlFor="exp" className="ml-2 text-sm font-medium text-gray-800">Track Expiry Dates?</label>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-6">Enabling this checks dates on every receipt/transfer.</p>
                        </div>
                    </div>
                </div>

            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-md transition-all">Create Product</button>
            </div>
        </form>
    );
}
