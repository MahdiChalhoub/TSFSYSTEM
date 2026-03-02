/**
 * SalesKpiCard — Reusable KPI card for Sales module pages
 * =========================================================
 * Extracted from sales/history/page.tsx where this layout was
 * repeated 3 times (Volume, Exposure, Count).
 *
 * Uses --app-* CSS variables for full theme-engine compatibility.
 */

import React from 'react';

interface SalesKpiCardProps {
 /** Icon element to display in the left badge */
 icon: React.ReactNode;
 /** Small uppercase badge label (e.g. "VOLUME") */
 badge: string;
 /** Main descriptive label */
 label: string;
 /** Formatted value string */
 value: string;
 /**
 * Visual variant:
 * - `default` — white card (standard)
 * - `dark` — dark/accent card (highlighted metric)
 */
 variant?: 'default' | 'dark';
}

export function SalesKpiCard({ icon, badge, label, value, variant = 'default' }: SalesKpiCardProps) {
 const isDark = variant === 'dark';

 return (
 <div
 className="rounded-[2rem] overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
 style={{
 background: isDark ? 'var(--app-accent)' : 'var(--app-surface)',
 boxShadow: isDark
 ? '0 4px 24px color-mix(in srgb, var(--app-accent) 20%, transparent)'
 : '0 1px 4px var(--app-shadow)',
 border: isDark ? 'none' : '1px solid var(--app-border)',
 }}
 >
 <div className="p-7">
 <div className="flex justify-between items-start mb-4">
 {/* Icon circle */}
 <div
 className="w-12 h-12 rounded-2xl flex items-center justify-center"
 style={{
 background: isDark ? 'rgba(255,255,255,0.15)' : 'var(--app-accent-soft)',
 color: isDark ? '#fff' : 'var(--app-accent)',
 }}
 >
 {icon}
 </div>
 {/* Badge */}
 <span
 className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
 style={{
 background: isDark ? 'rgba(255,255,255,0.15)' : 'var(--app-accent-soft)',
 color: isDark ? '#fff' : 'var(--app-accent)',
 }}
 >
 {badge}
 </span>
 </div>
 {/* Label */}
 <p
 className="text-[11px] font-black uppercase tracking-widest"
 style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--app-text-muted)' }}
 >
 {label}
 </p>
 {/* Value */}
 <h2
 className="text-3xl font-black mt-1"
 style={{ color: isDark ? '#fff' : 'var(--app-text)' }}
 >
 {value}
 </h2>
 </div>
 </div>
 );
}
