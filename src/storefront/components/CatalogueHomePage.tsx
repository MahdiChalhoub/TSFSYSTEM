'use client'

import { useConfig, useStore } from '@/storefront/engine/hooks'
import { FileText, Search, Filter, Mail } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '@/storefront/engine/types'

/**
 * Catalogue homepage — browse products with no prices displayed.
 * "Request Quote" replaces "Add to Cart". Used when storefront_type = CATALOGUE.
 */
export default function CatalogueHomePage({ products, categories }: { products: Product[]; categories: any[] }) {
    const { orgName, config } = useConfig()
    const [search, setSearch] = useState('')
    const [activeCat, setActiveCat] = useState<string | null>(null)

    const filtered = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
        const matchCat = !activeCat || p.category_id === activeCat || p.category_name === activeCat
        return matchSearch && matchCat
    })

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
            {/* Hero */}
            <section style={{
                padding: '3rem 2rem', textAlign: 'center',
                background: 'linear-gradient(135deg, var(--theme-primary, #6366f1), var(--theme-secondary, #8b5cf6))',
                color: '#fff',
            }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>{config?.storefront_title || orgName}</h1>
                <p style={{ opacity: 0.9, marginTop: '0.5rem', fontSize: '1.1rem' }}>
                    {config?.storefront_tagline || 'Browse our catalogue and request a quote'}
                </p>
            </section>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                {/* Search + filter */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
                        padding: '0.625rem 1rem', flex: 1, maxWidth: '400px',
                    }}>
                        <Search size={16} color="#94a3b8" />
                        <input
                            placeholder="Search catalogue..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setActiveCat(null)}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '20px',
                                border: `1px solid ${!activeCat ? 'var(--theme-primary, #6366f1)' : '#e2e8f0'}`,
                                background: !activeCat ? 'var(--theme-primary, #6366f1)' : '#fff',
                                color: !activeCat ? '#fff' : '#475569',
                                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                            }}
                        >All</button>
                        {categories.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setActiveCat(c.name)}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '20px',
                                    border: `1px solid ${activeCat === c.name ? 'var(--theme-primary, #6366f1)' : '#e2e8f0'}`,
                                    background: activeCat === c.name ? 'var(--theme-primary, #6366f1)' : '#fff',
                                    color: activeCat === c.name ? '#fff' : '#475569',
                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                                }}
                            >{c.name}</button>
                        ))}
                    </div>
                </div>

                {/* Product grid — no prices */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '1.25rem',
                }}>
                    {filtered.map(p => (
                        <div key={p.id} style={{
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px',
                            overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s',
                        }}>
                            <div style={{
                                height: '160px', background: '#f8fafc',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#cbd5e1',
                            }}>
                                {p.image_url
                                    ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <FileText size={40} />}
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem' }}>{p.name}</h3>
                                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                                    {p.category_name || 'Uncategorized'} • {p.sku}
                                </p>
                                <button style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '8px',
                                    border: '2px solid var(--theme-primary, #6366f1)',
                                    background: 'transparent', color: 'var(--theme-primary, #6366f1)',
                                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                }}>
                                    <Mail size={14} /> Request Quote
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        <FileText size={48} style={{ margin: '0 auto 1rem' }} />
                        <p style={{ fontWeight: 600 }}>No products found</p>
                    </div>
                )}
            </div>
        </div>
    )
}
