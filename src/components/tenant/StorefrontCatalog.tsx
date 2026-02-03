'use client';

import { ShoppingBag, ArrowRight, Star } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface Product {
    id: string;
    name: string;
    sku: string;
    selling_price_ttc: number;
    image_url?: string;
    category_name?: string;
}

export function StorefrontCatalog({ products }: { products: Product[] }) {
    if (!products || products.length === 0) {
        return (
            <div className="p-12 text-center bg-white/5 rounded-[3rem] border border-white/10 backdrop-blur-xl">
                <ShoppingBag className="mx-auto text-slate-700 mb-4" size={48} />
                <h3 className="text-xl font-bold text-white">Catalog Coming Soon</h3>
                <p className="text-slate-500 mt-2">We are currently updating our inventory. Please check back later.</p>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            <div className="flex items-center justify-between px-4">
                <h2 className="text-3xl font-black text-white tracking-tighter">Featured Collection</h2>
                <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Inventory</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {products.map((p, idx) => (
                    <div
                        key={p.id}
                        className="group relative bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-emerald-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 cursor-pointer"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative">
                            {p.image_url ? (
                                <img
                                    src={p.image_url}
                                    alt={p.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                    <ShoppingBag size={40} className="text-slate-800" />
                                </div>
                            )}
                            <div className="absolute top-6 left-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                                {p.category_name || 'Premium'}
                            </div>
                            <div className="absolute top-6 right-6 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 shadow-lg shadow-emerald-900/40">
                                <ArrowRight size={20} />
                            </div>
                        </div>

                        <div className="p-8 space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{p.name}</h3>
                                    <div className="flex items-center gap-1 text-emerald-500">
                                        <Star size={12} fill="currentColor" />
                                        <span className="text-[10px] font-black">4.9</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono tracking-widest">{p.sku}</p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="text-2xl font-black text-white">
                                    <span className="text-emerald-500 mr-1">$</span>
                                    {p.selling_price_ttc}
                                </div>
                                <button className="px-6 py-2 bg-white/5 hover:bg-emerald-500 text-white border border-white/10 hover:border-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Details
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Button className="w-full py-8 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all">
                Explore Full Catalog <ArrowRight className="ml-2" size={16} />
            </Button>
        </div>
    );
}
