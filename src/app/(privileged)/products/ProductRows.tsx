import Link from 'next/link';
import { Edit2, Copy, Barcode, Globe, Layers } from 'lucide-react';

export function ProductRow({ product }: { product: Record<string, any> }) {
 const totalStock = product.inventory?.reduce((acc: number, inv: Record<string, any>) => acc + Number(inv.quantity), 0) || 0;

 return (
 <tr className="hover:bg-gray-50/60 transition-colors group">
 <td className="py-6 px-8">
 <div className="flex flex-col gap-1">
 <span className="font-bold text-app-text group-hover:text-emerald-700 transition-colors">{product.name}</span>
 <span className="text-[10px] font-bold text-app-text-faint flex items-center gap-1.5 uppercase tracking-wider">
 {product.brand?.name || 'GENERIC'} ΓÇó {product.category?.name || 'UNCATEGORIZED'}
 </span>
 {product.productGroupId && (
 <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full w-fit border border-emerald-100/50">
 VARIANT GROUP
 </span>
 )}
 </div>
 </td>
 <td className="py-6 px-8">
 {product.country ? (
 <div className="flex items-center gap-2">
 <div className="w-5 h-5 rounded-full bg-app-surface-2 flex items-center justify-center text-[10px] font-bold text-app-text-muted border border-app-border">
 {product.country.code?.substring(0, 2)}
 </div>
 <span className="text-xs font-semibold text-gray-700">{product.country.name}</span>
 </div>
 ) : (
 <span className="text-xs text-gray-300 font-medium italic select-none">Global Origin</span>
 )}

 {Number(product.size) > 0 && (
 <div className="text-[10px] text-emerald-600/70 font-black mt-1.5 tracking-tighter uppercase px-2 py-0.5 bg-emerald-50 rounded-lg w-fit">
 {Number(product.size)} {product.sizeUnit?.shortName || product.sizeUnit?.name}
 </div>
 )}
 </td>
 <td className="py-6 px-8">
 <div className="flex flex-col gap-1">
 <span className="font-mono text-[11px] font-black text-gray-700 bg-gray-100/80 px-2 py-1 rounded-lg w-fit select-all">
 {product.sku}
 </span>
 {product.barcode ? (
 <span className="text-[10px] text-app-text-faint font-bold flex items-center gap-1 mt-0.5 tracking-tight">
 <Barcode size={10} className="opacity-50" /> {product.barcode}
 </span>
 ) : (
 <span className="text-[9px] text-amber-500 font-black flex items-center gap-1 mt-0.5 uppercase tracking-widest bg-amber-50 px-1.5 rounded py-0.5">
 MISSING CODE
 </span>
 )}
 </div>
 </td>
 <td className="py-6 px-8">
 <div className="flex flex-col gap-0.5">
 <span className={`text-lg font-black tracking-tighter ${totalStock > 0 ? 'text-app-text group-hover:text-emerald-800' : 'text-red-500'}`}>
 {totalStock.toLocaleString()}
 </span>
 <span className="text-[10px] font-black text-app-text-faint uppercase tracking-widest px-1.5 py-0.5 bg-app-bg rounded-lg w-fit">
 {product.unit?.shortName || 'UNIT'}
 </span>
 </div>
 </td>
 <td className="py-6 px-8 text-right">
 <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
 <Link
 href={`/products/new?cloneId=${product.id}`}
 className="p-2.5 text-app-text-faint hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100 shadow-sm hover:shadow-md"
 title="Clone Product"
 >
 <Copy size={18} />
 </Link>
 <Link
 href={`/products/${product.id}/edit`}
 className="p-2.5 text-app-text-faint hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
 title="Modify Master Record"
 >
 <Edit2 size={18} />
 </Link>
 </div>
 </td>
 </tr>
 );
}

export function GroupRow({ group }: { group: Record<string, any> }) {
 // Aggregate Stock
 const totalVarStock = group.products?.reduce((acc: number, p: Record<string, any>) => {
 const pStock = p.inventory?.reduce((invAcc: number, inv: Record<string, any>) => invAcc + Number(inv.quantity), 0) || 0;
 return acc + pStock;
 }, 0) || 0;

 const variantCount = group.products?.length || 0;
 // Extract Unique Countries
 const uniqueCountries = Array.from(new Set(group.products?.map((p: any) => p.country?.code).filter(Boolean)));

 return (
 <tr className="hover:bg-emerald-50/20 transition-all group bg-gray-50/20">
 <td className="py-6 px-8">
 <div className="flex flex-col gap-1.5">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
 <Layers size={16} />
 </div>
 <span className="font-black text-app-text text-lg tracking-tighter group-hover:text-emerald-700 transition-colors">{group.name}</span>
 </div>
 <span className="text-[10px] font-black text-app-text-faint pl-11 uppercase tracking-widest">{group.brand?.name} ΓÇó {group.category?.name}</span>
 </div>
 </td>
 <td className="py-6 px-8">
 <div className="flex flex-col gap-2 pl-2 border-l-2 border-emerald-100 group-hover:border-emerald-400 transition-colors">
 <span className="text-xs font-black text-emerald-900 uppercase tracking-tighter">{variantCount} Active Variants</span>
 <div className="flex gap-1 flex-wrap">
 {uniqueCountries.map((c: any) => (
 <span key={c} className="text-[9px] font-black bg-app-surface border border-app-border px-2 py-0.5 rounded shadow-sm text-app-text-muted uppercase">
 {c}
 </span>
 ))}
 </div>
 </div>
 </td>
 <td className="py-6 px-8">
 <div className="flex p-2 bg-white/50 rounded-xl border border-dashed border-app-border w-fit">
 <span className="text-[10px] font-bold text-app-text-faint italic">Hierarchical Master</span>
 </div>
 </td>
 <td className="py-6 px-8">
 <div className="flex flex-col gap-0.5">
 <span className="font-black text-emerald-600 text-2xl tracking-tighter group-hover:scale-105 transition-transform origin-left">{totalVarStock.toLocaleString()}</span>
 <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Aggregate Units</span>
 </div>
 </td>
 <td className="py-6 px-8 text-right">
 <Link
 href={`/products/groups/${group.id}/edit`}
 className="inline-flex items-center justify-center gap-2 bg-app-surface px-4 py-2 rounded-xl text-xs font-black text-emerald-600 border border-emerald-100 shadow-sm hover:shadow-md hover:bg-emerald-600 hover:text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wider"
 >
 <Edit2 size={12} strokeWidth={3} />
 Manage Group
 </Link>
 </td>
 </tr>
 );
}
