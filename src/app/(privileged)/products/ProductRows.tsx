import Link from 'next/link';
import { Edit2, Copy, Barcode, Globe, Layers, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
    0: { bg: 'rgba(239,68,68,0.12)', text: 'var(--app-error)', border: 'rgba(239,68,68,0.3)' },
    1: { bg: 'rgba(249,115,22,0.12)', text: 'var(--app-warning)', border: 'rgba(249,115,22,0.3)' },
    2: { bg: 'rgba(234,179,8,0.12)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
    3: { bg: 'rgba(59,130,246,0.12)', text: 'var(--app-info)', border: 'rgba(59,130,246,0.3)' },
    4: { bg: 'rgba(99,102,241,0.12)', text: 'var(--app-accent)', border: 'rgba(99,102,241,0.3)' },
    5: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.3)' },
    6: { bg: 'rgba(6,182,212,0.12)', text: 'var(--app-accent-cyan)', border: 'rgba(6,182,212,0.3)' },
    7: { bg: 'rgba(34,197,94,0.12)', text: 'var(--app-success)', border: 'rgba(34,197,94,0.3)' },
};

export function ProductRow({ product }: { product: Record<string, any> }) {
    const totalStock = product.inventory?.reduce((acc: number, inv: Record<string, any>) => acc + Number(inv.quantity), 0) || 0;

    return (
        <tr className="hover:bg-app-surface-2/60 transition-colors group">
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1">
                    <span className="font-bold text-app-foreground group-hover:text-app-success transition-colors">{product.name}</span>
                    <span className="text-[10px] font-bold text-app-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        {product.brand?.name || 'GENERIC'} · {product.category?.name || 'UNCATEGORIZED'}
                    </span>
                    {/* 3 Separate Lifecycle Badges */}
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {/* Badge 1: Data Maturity Level */}
                        {(() => {
                            const lvl = product.data_completeness_level ?? 0;
                            const c = LEVEL_COLORS[lvl] || LEVEL_COLORS[0];
                            const label = product.completeness_label || 'Draft';
                            return (
                                <span
                                    className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                    style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                                >
                                    {lvl >= 7 && <CheckCircle2 size={9} />}
                                    L{lvl} {label}
                                </span>
                            );
                        })()}
                        {/* Badge 2: Sellable */}
                        {product.is_sellable ? (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--app-success)', border: '1px solid rgba(34,197,94,0.3)' }}>
                                <Tag size={8} /> Sellable
                            </span>
                        ) : (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--app-error)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                Not Sellable
                            </span>
                        )}
                        {/* Badge 3: Verified (only when true) */}
                        {product.is_verified && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--app-info)', border: '1px solid rgba(59,130,246,0.3)' }}>
                                <ShieldCheck size={8} /> Verified
                            </span>
                        )}
                    </div>
                    {product.productGroupId && (
                        <span className="text-[8px] font-black bg-app-primary-light text-app-primary px-1.5 py-0.5 rounded-full w-fit border border-app-success/30/50">
                            VARIANT GROUP
                        </span>
                    )}
                </div>
            </td>
            <td className="py-6 px-8">
                {product.country ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-app-surface-2 flex items-center justify-center text-[10px] font-bold text-app-muted-foreground border border-app-border">
                            {product.country.code?.substring(0, 2)}
                        </div>
                        <span className="text-xs font-semibold text-app-muted-foreground">{product.country.name}</span>
                    </div>
                ) : (
                    <span className="text-xs text-app-muted-foreground font-medium italic select-none">Global Origin</span>
                )}

                {Number(product.size) > 0 && (
                    <div className="text-[10px] text-app-primary/70 font-black mt-1.5 tracking-tighter uppercase px-2 py-0.5 bg-app-primary-light rounded-lg w-fit">
                        {Number(product.size)} {product.sizeUnit?.shortName || product.sizeUnit?.name}
                    </div>
                )}
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] font-black text-app-muted-foreground bg-app-surface-2/80 px-2 py-1 rounded-lg w-fit select-all">
                        {product.sku}
                    </span>
                    {product.barcode ? (
                        <span className="text-[10px] text-app-muted-foreground font-bold flex items-center gap-1 mt-0.5 tracking-tight">
                            <Barcode size={10} className="opacity-50" /> {product.barcode}
                        </span>
                    ) : (
                        <span className="text-[9px] text-app-warning font-black flex items-center gap-1 mt-0.5 uppercase tracking-widest bg-app-warning-bg px-1.5 rounded py-0.5">
                            MISSING CODE
                        </span>
                    )}
                </div>
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col gap-0.5">
                    <span className={`text-lg font-black tracking-tighter ${totalStock > 0 ? 'text-app-foreground group-hover:text-app-success' : 'text-app-error'}`}>
                        {totalStock.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest px-1.5 py-0.5 bg-app-background rounded-lg w-fit mb-1">
                        {product.unit?.shortName || 'UNIT'}
                    </span>
                    {product.incoming_transfer_qty > 0 && (
                        <span className="text-[9px] font-black text-app-info bg-app-info-bg border border-app-info/30 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                            +{Number(product.incoming_transfer_qty).toLocaleString()} INBOUND
                        </span>
                    )}
                    {product.outgoing_transfer_qty > 0 && (
                        <span className="text-[9px] font-black text-app-warning bg-app-warning-bg border border-app-warning/30 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit mt-0.5">
                            -{Number(product.outgoing_transfer_qty).toLocaleString()} OUTBOUND
                        </span>
                    )}
                </div>
            </td>
            <td className="py-6 px-8 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                    <Link
                        href={`/products/new?cloneId=${product.id}`}
                        className="p-2.5 text-app-muted-foreground hover:text-app-primary hover:bg-app-primary-light rounded-xl transition-all border border-transparent hover:border-app-success/30 shadow-sm hover:shadow-md"
                        title="Clone Product"
                    >
                        <Copy size={18} />
                    </Link>
                    <Link
                        href={`/products/${product.id}/edit`}
                        className="p-2.5 text-app-muted-foreground hover:text-app-info hover:bg-app-info-bg rounded-xl transition-all border border-transparent hover:border-app-info/30 shadow-sm hover:shadow-md"
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
        <tr className="hover:bg-app-primary-light/20 transition-all group bg-app-surface-2/20">
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-app-primary flex items-center justify-center text-app-foreground shadow-lg shadow-app-primary/20 group-hover:scale-110 transition-transform">
                            <Layers size={16} />
                        </div>
                        <span className="font-black text-app-foreground text-lg tracking-tighter group-hover:text-app-success transition-colors">{group.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-app-muted-foreground pl-11 uppercase tracking-widest">{group.brand?.name} ΓÇó {group.category?.name}</span>
                </div>
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col gap-2 pl-2 border-l-2 border-app-success/30 group-hover:border-app-success/30 transition-colors">
                    <span className="text-xs font-black text-app-success uppercase tracking-tighter">{variantCount} Active Variants</span>
                    <div className="flex gap-1 flex-wrap">
                        {uniqueCountries.map((c: any) => (
                            <span key={c} className="text-[9px] font-black bg-app-surface border border-app-border px-2 py-0.5 rounded shadow-sm text-app-muted-foreground uppercase">
                                {c}
                            </span>
                        ))}
                    </div>
                </div>
            </td>
            <td className="py-6 px-8">
                <div className="flex p-2 bg-app-foreground/50 rounded-xl border border-dashed border-app-border w-fit">
                    <span className="text-[10px] font-bold text-app-muted-foreground italic">Hierarchical Master</span>
                </div>
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col gap-0.5">
                    <span className="font-black text-app-primary text-2xl tracking-tighter group-hover:scale-105 transition-transform origin-left">{totalVarStock.toLocaleString()}</span>
                    <span className="text-[10px] font-black text-app-primary/50 uppercase tracking-widest">Aggregate Units</span>
                </div>
            </td>
            <td className="py-6 px-8 text-right">
                <Link
                    href={`/products/groups/${group.id}/edit`}
                    className="inline-flex items-center justify-center gap-2 bg-app-surface px-4 py-2 rounded-xl text-xs font-black text-app-primary border border-app-success/30 shadow-sm hover:shadow-md hover:bg-app-primary hover:text-app-foreground transition-all transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wider"
                >
                    <Edit2 size={12} strokeWidth={3} />
                    Manage Group
                </Link>
            </td>
        </tr>
    );
}
