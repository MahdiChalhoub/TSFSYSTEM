'use client';

interface PriceDisplayProps {
 price: number;
 originalPrice?: number;
 currency?: string;
 size?: 'sm' | 'md' | 'lg' | 'xl';
 label?: string;
 formatCurrency: (amount: number) => string;
}

const sizeMap = {
 sm: { price: 'text-xl', original: 'text-sm', label: 'text-xs' },
 md: { price: 'text-3xl', original: 'text-base', label: 'text-xs' },
 lg: { price: 'text-5xl', original: 'text-xl', label: 'text-sm' },
 xl: { price: 'text-7xl', original: 'text-2xl', label: 'text-base' },
};

export function PriceDisplay({
 price,
 originalPrice,
 size = 'md',
 label,
 formatCurrency,
}: PriceDisplayProps) {
 const sz = sizeMap[size];
 const hasDiscount = originalPrice !== undefined && originalPrice > price;
 const discountPct = hasDiscount
 ? Math.round(((originalPrice - price) / originalPrice) * 100)
 : 0;

 return (
 <div
 className="flex flex-col items-start gap-0.5"
 style={{ fontFamily: 'var(--sm-font-display, var(--sm-font))' }}
 >
 {label && (
 <p className={`${sz.label} font-medium uppercase tracking-widest`} style={{ color: 'var(--sm-text-muted)' }}>
 {label}
 </p>
 )}

 <div className="flex items-baseline gap-3">
 {/* Current price */}
 <span
 className={`${sz.price} font-black tracking-tight sm-anim-num-tick`}
 style={{ color: hasDiscount ? 'var(--sm-danger)' : 'var(--sm-text)' }}
 >
 {formatCurrency(price)}
 </span>

 {/* Original price strikethrough */}
 {hasDiscount && originalPrice !== undefined && (
 <span
 className={`${sz.original} font-medium line-through`}
 style={{ color: 'var(--sm-text-subtle)' }}
 >
 {formatCurrency(originalPrice)}
 </span>
 )}

 {/* Discount badge */}
 {hasDiscount && discountPct > 0 && (
 <span
 className="text-xs font-bold px-2 py-1 rounded-full sm-anim-promo"
 style={{
 background: 'var(--sm-danger)',
 color: '#fff',
 }}
 >
 -{discountPct}%
 </span>
 )}
 </div>
 </div>
 );
}
