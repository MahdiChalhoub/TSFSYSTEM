'use client'

import { useState } from "react"
import {
    Settings, Tag, Users, Trophy, Shield,
    Bell, Database, ShieldCheck, ChevronRight,
    ArrowLeft, LayoutDashboard, Palette, Lock
} from "lucide-react"

const SETTINGS_GROUPS = [
    {
        title: "Entity Configuration",
        items: [
            {
                title: "Tags & Categories",
                desc: "Manage the hierarchy of client types (Wholesale, VIP, Family...)",
                icon: Tag,
                href: "/crm/settings/tags",
                color: "var(--app-info)",
            },
            {
                title: "Segments & Tiers",
                desc: "Define automatic classification thresholds for customers",
                icon: Users,
                href: "/crm/settings/segments",
                color: "var(--app-primary)",
            }
        ]
    },
    {
        title: "Loyalty & Engagement",
        items: [
            {
                title: "Loyalty Rules",
                desc: "Configure points-per-purchase and reward tier thresholds",
                icon: Trophy,
                href: "/crm/settings/loyalty",
                color: "var(--app-warning)",
            }
        ]
    },
    {
        title: "Security & Audit",
        items: [
            {
                title: "Sensitive Fields",
                desc: "Define which fields trigger an audit alert",
                icon: ShieldCheck,
                href: "/crm/settings/audit",
                color: "var(--app-accent)",
            },
            {
                title: "Merge Rules",
                desc: "Conflict resolution strategies when merging duplicate contacts",
                icon: Lock,
                href: "/crm/settings/merge-rules",
                color: "var(--app-muted-foreground)",
            }
        ]
    }
]

export default function CrmSettingsPage() {
    return (
        <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
            {/* Header */}
            <header
                className="fade-in-up"
                style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
                    justifyContent: 'space-between', gap: '1rem',
                    marginBottom: 'clamp(1.5rem, 3vw, 2.5rem)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <button
                        onClick={() => window.history.back()}
                        style={{
                            width: '2.25rem', height: '2.25rem', borderRadius: 'var(--app-radius-sm)',
                            background: 'var(--app-surface)', border: '1px solid var(--app-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--app-muted-foreground)', flexShrink: 0,
                        }}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div
                        style={{
                            width: '2.75rem', height: '2.75rem', borderRadius: 'var(--app-radius-sm)',
                            background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary)cc)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Settings size={20} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{
                            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 800,
                            color: 'var(--app-foreground)', letterSpacing: '-0.03em',
                        }}>
                            CRM <span style={{ color: 'var(--app-primary)' }}>Settings</span>
                        </h1>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--app-muted-foreground)', marginTop: '0.0625rem' }}>
                            Configure business rules and third-party taxonomy
                        </p>
                    </div>
                </div>
            </header>

            {/* Settings Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
                {SETTINGS_GROUPS.map((group, idx) => (
                    <div key={idx} className="fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                        {/* Section Label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
                            <h2 style={{
                                fontSize: '0.5625rem', fontWeight: 800, textTransform: 'uppercase',
                                letterSpacing: '0.12em', color: 'var(--app-muted-foreground)', whiteSpace: 'nowrap',
                            }}>
                                {group.title}
                            </h2>
                            <div style={{ flex: 1, height: '1px', background: 'var(--app-border)' }} />
                        </div>

                        {/* Cards Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '0.75rem',
                        }}>
                            {group.items.map((item, iIdx) => (
                                <a
                                    key={iIdx}
                                    href={item.href}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div
                                        className="app-card"
                                        style={{
                                            padding: '1.25rem', cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                        }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                            (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.08)';
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                            (e.currentTarget as HTMLElement).style.boxShadow = '';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                            <div
                                                style={{
                                                    width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                                                    background: `${item.color}12`,
                                                    border: `1px solid ${item.color}25`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: item.color,
                                                }}
                                            >
                                                <item.icon size={18} />
                                            </div>
                                            <ChevronRight
                                                size={16}
                                                style={{ color: 'var(--app-muted-foreground)', transition: 'transform 0.2s' }}
                                            />
                                        </div>
                                        <div>
                                            <h3 style={{
                                                fontSize: '0.9375rem', fontWeight: 700,
                                                color: 'var(--app-foreground)', marginBottom: '0.25rem',
                                            }}>
                                                {item.title}
                                            </h3>
                                            <p style={{
                                                fontSize: '0.75rem', color: 'var(--app-muted-foreground)',
                                                lineHeight: 1.5,
                                            }}>
                                                {item.desc}
                                            </p>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
