'use client'

import { useConfig } from '@/storefront/engine/hooks'
import { Eye, ArrowRight, ExternalLink } from 'lucide-react'
import { useState } from 'react'

/**
 * Portfolio homepage — project gallery, case studies, inquiry CTA.
 * Used when storefront_type = PORTFOLIO.
 */
const PLACEHOLDER_PROJECTS = [
    { id: '1', title: 'Brand Identity Redesign', category: 'Branding', desc: 'Complete brand overhaul for a tech startup.', color: '#6366f1' },
    { id: '2', title: 'E-Commerce Platform', category: 'Web Development', desc: 'Full-stack online store with custom CMS.', color: '#ec4899' },
    { id: '3', title: 'Mobile App UI/UX', category: 'Design', desc: 'Award-winning mobile banking experience.', color: '#10b981' },
    { id: '4', title: 'Marketing Campaign', category: 'Marketing', desc: '360° digital campaign with 2M+ reach.', color: '#f59e0b' },
    { id: '5', title: 'Corporate Website', category: 'Web Development', desc: 'Responsive website for a Fortune 500 company.', color: '#3b82f6' },
    { id: '6', title: 'Product Photography', category: 'Photography', desc: 'Studio shoot for a luxury fashion brand.', color: '#8b5cf6' },
]

export default function PortfolioHomePage() {
    const { orgName, config } = useConfig()
    const [activeFilter, setActiveFilter] = useState<string | null>(null)

    const allCategories = [...new Set(PLACEHOLDER_PROJECTS.map(p => p.category))]
    const filtered = activeFilter
        ? PLACEHOLDER_PROJECTS.filter(p => p.category === activeFilter)
        : PLACEHOLDER_PROJECTS

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
            {/* Hero */}
            <section style={{
                padding: '5rem 2rem', textAlign: 'center',
                background: '#0f172a', color: '#fff',
            }}>
                <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--theme-primary, #8b5cf6)', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Portfolio
                </p>
                <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, margin: 0 }}>
                    {config?.storefront_title || orgName}
                </h1>
                <p style={{ fontSize: '1.15rem', color: '#94a3b8', maxWidth: '600px', margin: '1rem auto 0', lineHeight: 1.6 }}>
                    {config?.storefront_tagline || 'Crafting digital experiences that make an impact.'}
                </p>
            </section>

            {/* Project Gallery */}
            <section style={{ padding: '4rem 2rem', background: '#fff' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={() => setActiveFilter(null)}
                            style={{
                                padding: '0.5rem 1.25rem', borderRadius: '20px',
                                border: !activeFilter ? 'none' : '1px solid #e2e8f0',
                                background: !activeFilter ? '#0f172a' : '#fff',
                                color: !activeFilter ? '#fff' : '#475569',
                                cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem',
                            }}
                        >All Projects</button>
                        {allCategories.map(c => (
                            <button
                                key={c}
                                onClick={() => setActiveFilter(c)}
                                style={{
                                    padding: '0.5rem 1.25rem', borderRadius: '20px',
                                    border: activeFilter === c ? 'none' : '1px solid #e2e8f0',
                                    background: activeFilter === c ? '#0f172a' : '#fff',
                                    color: activeFilter === c ? '#fff' : '#475569',
                                    cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem',
                                }}
                            >{c}</button>
                        ))}
                    </div>

                    {/* Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                        gap: '1.5rem',
                    }}>
                        {filtered.map(project => (
                            <div key={project.id} style={{
                                borderRadius: '16px', overflow: 'hidden',
                                border: '1px solid #e2e8f0',
                                background: '#fff', cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}>
                                <div style={{
                                    height: '200px',
                                    background: `linear-gradient(135deg, ${project.color}20, ${project.color}40)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    position: 'relative',
                                }}>
                                    <Eye size={40} color={project.color} opacity={0.4} />
                                    <div style={{
                                        position: 'absolute', top: '12px', right: '12px',
                                        padding: '0.25rem 0.75rem', borderRadius: '12px',
                                        background: '#fff', fontSize: '0.7rem', fontWeight: 600, color: '#475569',
                                    }}>{project.category}</div>
                                </div>
                                <div style={{ padding: '1.25rem' }}>
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.5rem' }}>{project.title}</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{project.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{
                padding: '5rem 2rem', textAlign: 'center',
                background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
                color: '#fff',
            }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0 }}>Let's Work Together</h2>
                <p style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '1.1rem' }}>
                    Have a project in mind? We'd love to hear from you.
                </p>
                <a href="#" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    marginTop: '2rem', padding: '0.875rem 2.5rem', borderRadius: '12px',
                    background: 'var(--theme-primary, #8b5cf6)', color: '#fff',
                    fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
                }}>
                    Start a Conversation <ArrowRight size={18} />
                </a>
            </section>
        </div>
    )
}
