'use client'

import { useConfig } from '@/storefront/engine/hooks'
import { ShoppingCart, ArrowRight, Star, Zap, Shield, Globe } from 'lucide-react'

/**
 * Landing Page homepage — hero banner + about + services + contact.
 * Used when storefront_type = LANDING_PAGE.
 */
export default function LandingHomePage() {
    const { orgName, config } = useConfig()
    const tagline = config?.storefront_tagline || 'Welcome to our business'

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
            {/* Hero Section */}
            <section style={{
                minHeight: '70vh',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: '4rem 2rem',
                background: 'linear-gradient(135deg, var(--theme-primary, #6366f1) 0%, var(--theme-secondary, #8b5cf6) 50%, var(--theme-accent, #a855f7) 100%)',
                color: '#fff',
            }}>
                <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                    {orgName}
                </h1>
                <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.35rem)', opacity: 0.9, maxWidth: '600px', marginTop: '1.25rem', lineHeight: 1.6 }}>
                    {tagline}
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <a href="#contact" style={{
                        padding: '0.875rem 2rem', borderRadius: '12px', fontWeight: 700,
                        background: '#fff', color: '#1e293b', textDecoration: 'none',
                        fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                        Get in Touch <ArrowRight size={18} />
                    </a>
                    <a href="#services" style={{
                        padding: '0.875rem 2rem', borderRadius: '12px', fontWeight: 600,
                        background: 'rgba(255,255,255,0.15)', color: '#fff', textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.25)', fontSize: '1rem',
                    }}>
                        Our Services
                    </a>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" style={{ padding: '5rem 2rem', background: 'var(--theme-surface, #fff)' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>What We Offer</h2>
                    <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '3rem' }}>
                        Tailored solutions for your needs
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {[
                            { icon: Zap, title: 'Fast Delivery', desc: 'Quick turnaround on all orders and services.' },
                            { icon: Shield, title: 'Quality Guaranteed', desc: 'Premium products and services you can trust.' },
                            { icon: Star, title: 'Expert Support', desc: 'Dedicated team available to help you succeed.' },
                            { icon: Globe, title: 'Global Reach', desc: 'Serving customers worldwide with excellence.' },
                        ].map((s, i) => (
                            <div key={i} style={{
                                padding: '2rem', borderRadius: '16px',
                                border: '1px solid #e2e8f0', background: '#fff',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}>
                                <s.icon size={32} color="var(--theme-primary, #6366f1)" style={{ marginBottom: '1rem' }} />
                                <h3 style={{ fontWeight: 700, fontSize: '1.15rem', margin: '0 0 0.5rem' }}>{s.title}</h3>
                                <p style={{ color: '#64748b', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section style={{ padding: '5rem 2rem', background: '#f8fafc' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>About {orgName}</h2>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: '#475569' }}>
                        We are a passionate team committed to delivering exceptional products and services.
                        Our mission is to help businesses succeed through innovation and excellence.
                    </p>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" style={{ padding: '5rem 2rem', background: 'var(--theme-surface, #fff)' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center', marginBottom: '2rem' }}>Contact Us</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input placeholder="Your Name" style={{
                            padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                            fontSize: '0.95rem', outline: 'none',
                        }} />
                        <input placeholder="Email Address" type="email" style={{
                            padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                            fontSize: '0.95rem', outline: 'none',
                        }} />
                        <textarea placeholder="Your Message" rows={4} style={{
                            padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                            fontSize: '0.95rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                        }} />
                        <button style={{
                            padding: '0.875rem', borderRadius: '10px', border: 'none',
                            background: 'var(--theme-primary, #6366f1)', color: '#fff',
                            fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                        }}>
                            Send Message
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}
