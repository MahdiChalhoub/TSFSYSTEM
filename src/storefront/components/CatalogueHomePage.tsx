'use client'

import { useConfig } from '@/storefront/engine/hooks/useConfig'
import { FileText, Search, Mail, X, Send, CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '@/storefront/engine/types'
import { submitQuoteRequest } from '@/app/tenant/[slug]/actions'

/**
 * Catalogue homepage — browse products with no prices displayed.
 * "Request Quote" opens a modal form. Used when storefront_type = CATALOGUE.
 */
export default function CatalogueHomePage({ products, categories }: { products: Product[]; categories: any[] }) {
    const { orgName, config, slug } = useConfig()
    const [search, setSearch] = useState('')
    const [activeCat, setActiveCat] = useState<string | null>(null)
    const [quoteProduct, setQuoteProduct] = useState<Product | null>(null)
    const [formData, setFormData] = useState({ full_name: '', email: '', phone: '', company_name: '', quantity: '1', message: '' })
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    const filtered = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
        const matchCat = !activeCat || p.category_id === activeCat || p.category_name === activeCat
        return matchSearch && matchCat
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!quoteProduct || !slug) return
        setSubmitting(true)
        setError('')
        const result = await submitQuoteRequest(slug, {
            product: quoteProduct.id,
            product_name: quoteProduct.name,
            quantity: parseFloat(formData.quantity) || 1,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            company_name: formData.company_name,
            message: formData.message,
        })
        setSubmitting(false)
        if (result.success) {
            setSubmitted(true)
            setTimeout(() => {
                setQuoteProduct(null)
                setSubmitted(false)
                setFormData({ full_name: '', email: '', phone: '', company_name: '', quantity: '1', message: '' })
            }, 2500)
        } else {
            setError(result.error || 'Something went wrong')
        }
    }

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
                                <button
                                    onClick={() => setQuoteProduct(p)}
                                    style={{
                                        width: '100%', padding: '0.625rem', borderRadius: '8px',
                                        border: '2px solid var(--theme-primary, #6366f1)',
                                        background: 'transparent', color: 'var(--theme-primary, #6366f1)',
                                        fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    }}
                                >
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

            {/* ── Quote Request Modal ─────────────────────────────────────── */}
            {quoteProduct && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '1rem',
                }} onClick={() => !submitting && setQuoteProduct(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.15)', overflow: 'hidden',
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid #f1f5f9',
                            background: 'linear-gradient(135deg, var(--theme-primary, #6366f1), var(--theme-secondary, #8b5cf6))',
                            color: '#fff',
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Request a Quote</h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.85 }}>{quoteProduct.name}</p>
                            </div>
                            <button onClick={() => setQuoteProduct(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {submitted ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>
                                <CheckCircle size={48} color="#22c55e" style={{ margin: '0 auto 1rem' }} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>Quote Request Sent!</h3>
                                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>We&apos;ll get back to you shortly.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <input required placeholder="Full Name *" value={formData.full_name}
                                        onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                                        style={inputStyle} />
                                    <input required type="email" placeholder="Email *" value={formData.email}
                                        onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <input placeholder="Phone" value={formData.phone}
                                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                        style={inputStyle} />
                                    <input placeholder="Company Name" value={formData.company_name}
                                        onChange={e => setFormData(p => ({ ...p, company_name: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <input type="number" min="1" placeholder="Quantity" value={formData.quantity}
                                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                                    style={inputStyle} />
                                <textarea required placeholder="Tell us about your requirements... *" rows={3}
                                    value={formData.message}
                                    onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' }} />
                                {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
                                <button type="submit" disabled={submitting} style={{
                                    padding: '0.75rem', borderRadius: '10px', border: 'none',
                                    background: 'var(--theme-primary, #6366f1)', color: '#fff',
                                    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    opacity: submitting ? 0.7 : 1,
                                }}>
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {submitting ? 'Sending...' : 'Submit Quote Request'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const inputStyle: React.CSSProperties = {
    padding: '0.625rem 0.875rem', borderRadius: '8px',
    border: '1px solid #e2e8f0', fontSize: '0.875rem',
    outline: 'none', width: '100%',
}
