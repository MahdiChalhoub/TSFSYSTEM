'use client';

import { useEffect, useState } from 'react';
import { Search, Tag, Grid, Filter } from 'lucide-react';

export default function EcommerceCatalogPage() {
    const [products] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Product Catalog</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Manage which products appear on your storefront.</p>
                </div>
            </div>

            {/* Search bar */}
            <div style={{
                display: 'flex', gap: '0.75rem', marginBottom: '1.5rem',
                alignItems: 'center',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '0.5rem 1rem', flex: 1, maxWidth: '400px',
                }}>
                    <Search size={16} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            border: 'none', outline: 'none', width: '100%',
                            fontSize: '0.9rem', background: 'transparent',
                        }}
                    />
                </div>
            </div>

            {/* Products */}
            {products.length === 0 ? (
                <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                }}>
                    <Tag size={48} style={{ margin: '0 auto 1rem' }} />
                    <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Catalog is empty</p>
                    <p>Products from inventory will appear here when your storefront is active.</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        Add products in <strong>Inventory → Products</strong> to populate the catalog.
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '1rem',
                }}>
                    {products.map((p: any) => (
                        <div key={p.id} style={{
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '1rem',
                        }}>
                            <div style={{
                                height: '120px',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '0.75rem',
                                color: '#cbd5e1',
                            }}>
                                <Grid size={32} />
                            </div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{p.name}</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0' }}>{p.category || 'Uncategorized'}</p>
                            <p style={{ fontWeight: 700, color: '#1e293b' }}>${p.price}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
