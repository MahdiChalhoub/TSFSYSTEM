'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, Star } from 'lucide-react';
import { useFavorites } from '@/context/FavoritesContext';

export function FavoritesPanel({ openTab }: { openTab: (title: string, path: string) => void }) {
    const { favorites, removeFavorite } = useFavorites();
    const [favOpen, setFavOpen] = useState(true);

    if (favorites.length === 0) return null;

    return (
        <>
            <div
                className="mb-1 mx-1 flex items-center gap-1.5 cursor-pointer select-none"
                onClick={() => setFavOpen(v => !v)}
            >
                <Star size={10} fill="currentColor" style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.85 }}>
                    Favorites
                </span>
                <span className="text-[8px] font-bold px-1 rounded ml-0.5" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                    {favorites.length}
                </span>
                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' }} />
                <ChevronRight
                    size={11}
                    className={clsx('transition-transform duration-200', favOpen ? 'rotate-90' : '')}
                    style={{ color: 'var(--app-primary)', opacity: 0.5 }}
                />
            </div>
            {favOpen && (
                <div className="space-y-0.5 mb-3">
                    {favorites.map((fav, idx) => (
                        <div
                            key={`${fav.path}-${idx}`}
                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                            onClick={() => openTab(fav.title, fav.path)}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-sidebar-active)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                            <Star size={10} fill="currentColor" style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                            <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--app-sidebar-text)' }}>
                                {fav.title}
                            </span>
                            <button
                                title="Remove from favorites"
                                onClick={(e) => { e.stopPropagation(); removeFavorite(fav.path); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                                style={{ color: 'var(--app-sidebar-muted)' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--app-sidebar-muted)'; }}
                            >
                                <Star size={9} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="my-2 mx-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-sidebar-border) 60%, transparent)' }} />
        </>
    );
}
