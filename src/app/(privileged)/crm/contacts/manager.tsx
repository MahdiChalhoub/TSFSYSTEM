// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/lib/utils/currency';
import {
  Search, User, Briefcase, Building2, Phone, Mail,
  TrendingUp, TrendingDown, Star, Users,
  ChevronRight, Wrench, BookUser, UserPlus, X, RefreshCw,
  Activity, CircleDot
} from 'lucide-react';
import ContactModal from './form';

type Contact = Record<string, any>;

/* ─── Type chips config ─────────────────────────────────── */
const TYPES: { key: string; label: string; icon: any; color: string; bg: string }[] = [
  { key: 'ALL', label: 'All', icon: Users, color: 'var(--app-text)', bg: 'var(--app-surface-2)' },
  { key: 'CUSTOMER', label: 'Customers', icon: User, color: 'var(--app-info)', bg: 'var(--app-info-bg)' },
  { key: 'SUPPLIER', label: 'Suppliers', icon: Briefcase, color: 'var(--app-warning)', bg: 'var(--app-warning-bg)' },
  { key: 'BOTH', label: 'Client+Supplier', icon: RefreshCw, color: '#D946EF', bg: 'rgba(217,70,239,0.08)' },
  { key: 'LEAD', label: 'Leads', icon: TrendingUp, color: 'var(--app-success)', bg: 'var(--app-success-bg)' },
  { key: 'CONTACT', label: 'Address Book', icon: BookUser, color: 'var(--app-primary)', bg: 'var(--app-primary-light)' },
  { key: 'SERVICE', label: 'Services', icon: Wrench, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  { key: 'PARTNER', label: 'Partners', icon: Building2, color: 'var(--app-text-muted)', bg: 'var(--app-surface-2)' },
];

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.key, t]));

/* ─── Activity helpers ──────────────────────────────────── */
function getActivityInfo(c: Contact) {
  const orders = Number(c.total_orders || 0) + Number(c.supplier_total_orders || 0);
  const lastDate = c.last_purchase_date;
  const hasActivity = orders > 0 || !!lastDate;
  let recency = 'never'; let recencyColor = 'var(--app-text-faint)';
  if (lastDate) {
    const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
    if (days <= 7) { recency = 'this week'; recencyColor = 'var(--app-success)'; }
    else if (days <= 30) { recency = 'this month'; recencyColor = 'var(--app-info)'; }
    else if (days <= 90) { recency = `${Math.floor(days / 30)}mo ago`; recencyColor = 'var(--app-warning)'; }
    else { recency = `${Math.floor(days / 30)}mo ago`; }
  }
  return { orders, hasActivity, recency, recencyColor };
}

function formatRelDate(d: string | null | undefined): string {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  if (days <= 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/* ════════════════════════════════════════════════════════════ */
export default function ContactManager({
  contacts, sites, deliveryZones = [], taxProfiles = [], contactTags = [],
}: {
  contacts: Contact[]; sites: Record<string, any>[]; deliveryZones?: Record<string, any>[];
  taxProfiles?: Record<string, any>[]; contactTags?: Record<string, any>[];
}) {
  const { fmt } = useCurrency();
  const router = useRouter();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('CUSTOMER');

  /* ── counts ── */
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: contacts.length };
    contacts.forEach(x => { c[x.type] = (c[x.type] || 0) + 1; });
    return c;
  }, [contacts]);

  const activeCount = useMemo(
    () => contacts.filter(c => getActivityInfo(c).hasActivity).length,
    [contacts]
  );

  /* ── filter ── */
  const filtered = useMemo(() => {
    let r = contacts;
    if (typeFilter === 'CUSTOMER') r = r.filter(c => c.type === 'CUSTOMER' || c.type === 'BOTH');
    else if (typeFilter === 'SUPPLIER') r = r.filter(c => c.type === 'SUPPLIER' || c.type === 'BOTH');
    else if (typeFilter !== 'ALL') r = r.filter(c => c.type === typeFilter);

    if (activityFilter === 'active') r = r.filter(c => getActivityInfo(c).hasActivity);
    else if (activityFilter === 'inactive') r = r.filter(c => !getActivityInfo(c).hasActivity);

    if (search) {
      const t = search.toLowerCase();
      r = r.filter(c =>
        c.name?.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t) ||
        c.phone?.includes(t) || c.company_name?.toLowerCase().includes(t)
      );
    }
    return r;
  }, [contacts, typeFilter, activityFilter, search]);

  const getCfg = (type: string) => TYPE_MAP[type] || TYPE_MAP.ALL;

  /* ═══════════════════════ RENDER ═══════════════════════════ */
  return (
    <div>
      {/* ══════════════════════════════════════════════
                CONTROL PANEL — tabs, search, filters, actions
            ══════════════════════════════════════════════ */}
      <div
        className="app-card"
        style={{
          padding: '0.75rem',
          borderRadius: 'var(--app-radius)',
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        {/* Row 1 — Type tabs */}
        <div
          className="flex gap-1 overflow-x-auto hide-scrollbar"
          style={{
            padding: '0.1875rem',
            background: 'var(--app-bg)',
            borderRadius: 'calc(var(--app-radius) - 0.25rem)',
          }}
        >
          {TYPES.map(cfg => {
            let count = typeCounts[cfg.key] || 0;
            if (cfg.key === 'CUSTOMER') count += (typeCounts['BOTH'] || 0);
            if (cfg.key === 'SUPPLIER') count += (typeCounts['BOTH'] || 0);
            if (cfg.key !== 'ALL' && count === 0) return null;
            const active = typeFilter === cfg.key;
            return (
              <button
                key={cfg.key}
                onClick={() => setTypeFilter(cfg.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.4375rem 0.75rem',
                  borderRadius: 'calc(var(--app-radius) - 0.375rem)',
                  fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                  background: active ? 'var(--app-surface)' : 'transparent',
                  color: active ? cfg.color : 'var(--app-text-muted)',
                  border: 'none', cursor: 'pointer',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                <cfg.icon size={13} />
                <span>{cfg.label}</span>
                <span
                  style={{
                    fontSize: '0.5625rem', fontWeight: 800,
                    background: active ? cfg.color + '15' : 'transparent',
                    color: active ? cfg.color : 'var(--app-text-faint)',
                    padding: '0.0625rem 0.3125rem', borderRadius: '99px',
                    minWidth: '1.125rem', textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2 — Search + Activity + Quick-add */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Search input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{
              position: 'absolute', left: '0.75rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--app-text-faint)',
            }} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: '2.25rem', paddingRight: search ? '2rem' : '0.75rem',
                height: '2.125rem', fontSize: '0.8125rem',
                background: 'var(--app-bg)', color: 'var(--app-text)',
                border: '1px solid var(--app-border)',
                borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--app-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--app-border)'}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: '0.5rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'var(--app-surface-2)',
                  border: 'none', cursor: 'pointer', color: 'var(--app-text-faint)',
                  padding: '0.125rem', borderRadius: '99px', display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Activity toggle */}
          <div
            className="flex"
            style={{
              background: 'var(--app-bg)',
              borderRadius: 'calc(var(--app-radius) - 0.25rem)',
              padding: '0.125rem', gap: '0.125rem',
              border: '1px solid var(--app-border)',
            }}
          >
            {([
              { key: 'all', label: 'All', count: contacts.length },
              { key: 'active', label: 'Interacted', count: activeCount },
              { key: 'inactive', label: 'Never', count: contacts.length - activeCount },
            ] as const).map(af => {
              const isOn = activityFilter === af.key;
              return (
                <button
                  key={af.key}
                  onClick={() => setActivityFilter(af.key)}
                  style={{
                    padding: '0.3125rem 0.625rem',
                    borderRadius: 'calc(var(--app-radius) - 0.375rem)',
                    fontSize: '0.6875rem', fontWeight: isOn ? 700 : 500,
                    background: isOn ? 'var(--app-surface)' : 'transparent',
                    color: isOn ? 'var(--app-primary)' : 'var(--app-text-muted)',
                    border: 'none', cursor: 'pointer',
                    boxShadow: isOn ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                  }}
                >
                  {af.label}
                  <span style={{ fontSize: '0.5625rem', opacity: isOn ? 0.9 : 0.5 }}>{af.count}</span>
                </button>
              );
            })}
          </div>

          {/* Quick add */}
          {can('crm.create_contact') && (
            <div className="flex gap-1">
              {([
                { type: 'CUSTOMER', icon: User, label: 'Customer', color: 'var(--app-info)', bg: 'var(--app-info-bg)' },
                { type: 'SUPPLIER', icon: Briefcase, label: 'Supplier', color: 'var(--app-warning)', bg: 'var(--app-warning-bg)' },
                { type: 'BOTH', icon: RefreshCw, label: 'Both', color: '#D946EF', bg: 'rgba(217,70,239,0.08)' },
                { type: 'CONTACT', icon: BookUser, label: '', color: 'var(--app-text-muted)', bg: 'var(--app-surface-2)' },
              ] as const).map(btn => (
                <button
                  key={btn.type}
                  onClick={() => { setModalType(btn.type); setIsModalOpen(true); }}
                  title={`Create ${btn.label || 'Contact'}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3125rem',
                    padding: btn.label ? '0.3125rem 0.625rem' : '0.3125rem 0.4375rem',
                    borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                    fontSize: '0.6875rem', fontWeight: 600,
                    background: btn.bg, color: btn.color,
                    border: `1px solid ${btn.color}30`,
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}
                >
                  <btn.icon size={12} />
                  {btn.label && <span className="hidden sm:inline">{btn.label}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 3 — Results summary */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid var(--app-border)',
            paddingTop: '0.5rem', marginTop: '-0.125rem',
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
            <strong style={{ color: 'var(--app-text)', fontWeight: 700 }}>{filtered.length}</strong>
            {' '}contact{filtered.length !== 1 ? 's' : ''}
            {typeFilter !== 'ALL' && (
              <> in <span style={{ color: getCfg(typeFilter).color, fontWeight: 600 }}>{getCfg(typeFilter).label}</span></>
            )}
            {activityFilter === 'active' && <> • <span style={{ color: 'var(--app-success)', fontWeight: 600 }}>previously interacted</span></>}
            {activityFilter === 'inactive' && <> • <span style={{ fontWeight: 600 }}>never interacted</span></>}
          </span>
          {(search || typeFilter !== 'ALL' || activityFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('ALL'); setActivityFilter('all'); }}
              style={{
                fontSize: '0.625rem', fontWeight: 600,
                color: 'var(--app-primary)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '0.125rem 0.25rem',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
                DESKTOP TABLE
            ══════════════════════════════════════════════ */}
      <div className="hidden md:block">
        <div className="app-card" style={{ overflow: 'hidden', borderRadius: 'var(--app-radius)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Contact', 'Type', 'Phone / Email', 'Tags', 'Activity', 'Balance', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className="app-th"
                      style={{
                        textAlign: i === 5 ? 'right' : i === 6 ? 'center' : 'left',
                        width: i === 6 ? '3rem' : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cfg = getCfg(c.type);
                  const bal = Number(c.balance || 0);
                  const act = getActivityInfo(c);
                  return (
                    <tr
                      key={c.id}
                      className="app-table-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/crm/contacts/${c.id}`)}
                    >
                      {/* Name */}
                      <td className="app-td">
                        <div className="flex items-center gap-2.5">
                          <div style={{
                            width: '2rem', height: '2rem', borderRadius: '0.5rem',
                            background: cfg.bg, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                          }}>
                            <cfg.icon size={13} style={{ color: cfg.color }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700, fontSize: '0.8125rem', color: 'var(--app-text)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '14rem',
                            }}>
                              {c.name}
                            </div>
                            {c.company_name && (
                              <div style={{
                                fontSize: '0.6875rem', color: 'var(--app-text-muted)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '14rem',
                              }}>
                                {c.company_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="app-td">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.125rem 0.5rem', borderRadius: '99px',
                            fontSize: '0.625rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            background: cfg.bg, color: cfg.color,
                          }}>
                            {c.type === 'BOTH' ? 'CLIENT+SUPPLIER' : c.type}
                          </span>
                          {c.customer_tier && c.customer_tier !== 'STANDARD' && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.125rem',
                              padding: '0.125rem 0.375rem', borderRadius: '99px',
                              fontSize: '0.5625rem', fontWeight: 700,
                              background: c.customer_tier === 'VIP' ? '#FEF3C7' : 'var(--app-surface-2)',
                              color: c.customer_tier === 'VIP' ? '#B45309' : 'var(--app-text-muted)',
                            }}>
                              {c.customer_tier === 'VIP' && <Star size={8} style={{ fill: '#EAB308' }} />}
                              {c.customer_tier}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Phone/Email */}
                      <td className="app-td">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                          {c.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--app-text)' }}>
                              <Phone size={11} style={{ color: 'var(--app-text-faint)' }} /> {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                              <Mail size={10} style={{ color: 'var(--app-text-faint)' }} /> {c.email}
                            </span>
                          )}
                          {!c.phone && !c.email && <span style={{ color: 'var(--app-text-faint)', fontSize: '0.6875rem' }}>—</span>}
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="app-td">
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(c.tagNames || []).slice(0, 2).map((t: any) => (
                            <span key={t.id || t.name} style={{
                              padding: '0.0625rem 0.375rem', borderRadius: '99px',
                              fontSize: '0.5625rem', fontWeight: 600,
                              background: (t.color || '#6366F1') + '18',
                              color: t.color || '#6366F1',
                            }}>
                              {t.name}
                            </span>
                          ))}
                          {(c.tagNames || []).length > 2 && (
                            <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)' }}>+{c.tagNames.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="app-td" style={{ textAlign: 'center' }}>
                        {act.hasActivity ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.0625rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              fontSize: '0.6875rem', fontWeight: 700, color: act.recencyColor,
                            }}>
                              <CircleDot size={8} />
                              {act.orders} order{act.orders !== 1 ? 's' : ''}
                            </span>
                            {c.last_purchase_date && (
                              <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)' }}>
                                {formatRelDate(c.last_purchase_date)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.625rem', color: 'var(--app-text-faint)', fontStyle: 'italic' }}>
                            no activity
                          </span>
                        )}
                      </td>

                      {/* Balance */}
                      <td className="app-td" style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.8125rem',
                          color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        }}>
                          {bal > 0 && <TrendingUp size={12} />}
                          {bal < 0 && <TrendingDown size={12} />}
                          {fmt(Math.abs(bal))}
                        </span>
                      </td>

                      {/* Arrow */}
                      <td className="app-td" style={{ textAlign: 'center' }}>
                        <ChevronRight size={14} style={{ color: 'var(--app-text-faint)' }} />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Users size={28} style={{ color: 'var(--app-text-faint)', margin: '0 auto 0.5rem' }} />
                      <p style={{ fontSize: '0.8125rem', color: 'var(--app-text-muted)', fontWeight: 600 }}>No contacts found</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--app-text-faint)', marginTop: '0.25rem' }}>
                        {search ? 'Try a different search term' : 'Create your first contact to get started'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
                MOBILE CARDS
            ══════════════════════════════════════════════ */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map(c => {
          const cfg = getCfg(c.type);
          const bal = Number(c.balance || 0);
          const act = getActivityInfo(c);
          return (
            <div
              key={c.id}
              className="app-card app-card-hover"
              style={{ padding: '0.75rem', cursor: 'pointer' }}
              onClick={() => router.push(`/crm/contacts/${c.id}`)}
            >
              <div className="flex items-start gap-3">
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                  background: cfg.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <cfg.icon size={15} style={{ color: cfg.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex justify-between items-start">
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{
                        fontWeight: 700, fontSize: '0.875rem', color: 'var(--app-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {c.name}
                      </h3>
                      {c.company_name && (
                        <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)', marginTop: '0.0625rem' }}>
                          {c.company_name}
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0, marginLeft: '0.5rem',
                      color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
                    }}>
                      {fmt(Math.abs(bal))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.0625rem 0.375rem', borderRadius: '99px',
                      fontSize: '0.5625rem', fontWeight: 700,
                      textTransform: 'uppercase', background: cfg.bg, color: cfg.color,
                    }}>
                      {c.type === 'BOTH' ? 'CLIENT+SUPPLIER' : c.type}
                    </span>
                    {c.customer_tier && c.customer_tier !== 'STANDARD' && (
                      <span style={{
                        padding: '0.0625rem 0.375rem', borderRadius: '99px',
                        fontSize: '0.5625rem', fontWeight: 700,
                        background: '#FEF3C7', color: '#B45309',
                      }}>
                        {c.customer_tier === 'VIP' && '⭐ '}{c.customer_tier}
                      </span>
                    )}
                    {act.hasActivity && (
                      <span style={{
                        padding: '0.0625rem 0.375rem', borderRadius: '99px',
                        fontSize: '0.5625rem', fontWeight: 600,
                        color: act.recencyColor, background: act.recencyColor + '15',
                      }}>
                        {act.orders} orders • {act.recency}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                    {c.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                        <Phone size={10} /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                        <Mail size={10} /> {c.email}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--app-text-faint)', flexShrink: 0, marginTop: '0.5rem' }} />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Users size={28} style={{ color: 'var(--app-text-faint)', margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--app-text-muted)' }}>No contacts found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ContactModal
          sites={sites}
          type={modalType}
          onClose={() => { setIsModalOpen(false); router.refresh(); }}
          deliveryZones={deliveryZones}
          taxProfiles={taxProfiles}
        />
      )}
    </div>
  );
}