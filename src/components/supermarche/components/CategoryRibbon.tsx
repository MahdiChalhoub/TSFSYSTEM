'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react';

export interface ProductCategory {
    id: string;
    name: string;
    icon?: string;
    count?: number;
}

interface CategoryRibbonProps {
    categories: ProductCategory[];
    activeId: string | null;
    onSelect: (id: string | null) => void;
}

export function CategoryRibbon({ categories, activeId, onSelect }: CategoryRibbonProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    };

    const allCategory: ProductCategory = { id: '__all__', name: 'All Products', icon: '🏪' };
    const cats = [allCategory, ...categories];

    return (
        <div className="flex items-center gap-1">
            {/* Scroll left */}
            <button
                onClick={() => scroll('left')}
                aria-label="Scroll categories left"
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors sm-btn-ghost"
            >
                <ChevronLeft size={14} />
            </button>

            {/* Scroll container */}
            <div
                ref={scrollRef}
                className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {cats.map((cat) => {
                    const isActive = cat.id === '__all__'
                        ? activeId === null
                        : activeId === cat.id;

                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelect(cat.id === '__all__' ? null : cat.id)}
                            aria-pressed={isActive}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap"
                            style={{
                                fontFamily: 'var(--sm-font)',
                                background: isActive
                                    ? 'var(--sm-category-active, var(--sm-primary))'
                                    : 'var(--sm-surface)',
                                color: isActive ? '#fff' : 'var(--sm-text-muted)',
                                border: `1px solid ${isActive ? 'transparent' : 'var(--sm-border)'}`,
                                boxShadow: isActive ? 'var(--sm-shadow-glow)' : 'none',
                                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                            }}
                        >
                            {cat.icon && <span>{cat.icon}</span>}
                            <span>{cat.name}</span>
                            {cat.count !== undefined && (
                                <span
                                    className="ml-0.5 px-1 rounded-full text-[10px]"
                                    style={{
                                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--sm-surface-2)',
                                        color: isActive ? '#fff' : 'var(--sm-text-subtle)',
                                    }}
                                >
                                    {cat.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Scroll right */}
            <button
                onClick={() => scroll('right')}
                aria-label="Scroll categories right"
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors sm-btn-ghost"
            >
                <ChevronRight size={14} />
            </button>
        </div>
    );
}
