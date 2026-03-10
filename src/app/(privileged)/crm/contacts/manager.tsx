// @ts-nocheck
'use client';
import { useState, useCallback, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import {
  Search, Plus, User, Briefcase, Building2, Phone, Mail,
  TrendingUp, TrendingDown, Tag, Star, Users, ExternalLink,
  ChevronRight, Wrench, BookUser, UserPlus, Filter, MoreHorizontal,
  Eye, Edit, Trash2, X, RefreshCw, ArrowUpDown, Clock, Activity,
  MessageCircle
} from 'lucide-react';
import ContactModal from './form';

type Contact = Record<string, any>;

// ── Type configuration ──────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  ALL: { label: 'All', icon: Users, color: 'var(--app-text-muted)', bg: 'var(--app-surface-2)' },
  CUSTOMER: { label: 'Customers', icon: User, color: 'var(--app-info)', bg: 'var(--app-info-bg)' },
  SUPPLIER: { label: 'Suppliers', icon: Briefcase, color: 'var(--app-warning)', bg: 'var(--app-warning-bg)' },
  BOTH: { label: 'Client + Supplier', icon: RefreshCw, color: '#D946EF', bg: 'rgba(217,70,239,0.1)' },
  LEAD: { label: 'Leads', icon: TrendingUp, color: 'var(--app-success)', bg: 'var(--app-success-bg)' },
  CONTACT: { label: 'Address Book', icon: BookUser, color: 'var(--app-primary)', bg: 'var(--app-primary-light)' },
  SERVICE: { label: 'Services', icon: Wrench, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  PARTNER: { label: 'Partners', icon: Building2, color: 'var(--app-text-muted)', bg: 'var(--app-surface-2)' },
};

// ── Activity helpers ────────────────────────────────────────
function getActivityInfo(c: Contact) {
  const orders = Number(c.total_orders || 0) + Number(c.supplier_total_orders || 0);
  const lastDate = c.last_purchase_date;
  const hasActivity = orders > 0 || !!lastDate;

  let recency = 'never';
  let recencyColor = 'var(--app-text-faint)';
  if (lastDate) {
    const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
    if (days <= 7) { recency = 'this week'; recencyColor = 'var(--app-success)'; }
    else if (days <= 30) { recency = 'this month'; recencyColor = 'var(--app-info)'; }
    else if (days <= 90) { recency = `${Math.floor(days / 30)}mo ago`; recencyColor = 'var(--app-warning)'; }
    else { recency = `${Math.floor(days / 30)}mo ago`; recencyColor = 'var(--app-text-faint)'; }
  }

  return { orders, hasActivity, recency, recencyColor };
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  if (days <= 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ContactManager({
  contacts,
  sites,
  deliveryZones = [],
  taxProfiles = [],
  contactTags = [],
}: {
  contacts: Contact[];
  sites: Record<string, any>[];
  deliveryZones?: Record<string, any>[];
  taxProfiles?: Record<string, any>[];
  contactTags?: Record<string, any>[];
}) {
  const { fmt } = useCurrency();
  const router = useRouter();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('CUSTOMER');

  // ── Counts per type ──────────────────────────────────────
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: contacts.length };
    contacts.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    return counts;
  }, [contacts]);

  // ── Filter ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = contacts;

    // Type filter — BOTH also matches in Customer/Supplier tabs
    if (typeFilter === 'CUSTOMER') {
      result = result.filter(c => c.type === 'CUSTOMER' || c.type === 'BOTH');
    } else if (typeFilter === 'SUPPLIER') {
      result = result.filter(c => c.type === 'SUPPLIER' || c.type === 'BOTH');
    } else if (typeFilter !== 'ALL') {
      result = result.filter(c => c.type === typeFilter);
    }

    // Activity filter
    if (activityFilter === 'active') {
      result = result.filter(c => {
        const info = getActivityInfo(c);
        return info.hasActivity;
      });
    } else if (activityFilter === 'inactive') {
      result = result.filter(c => {
        const info = getActivityInfo(c);
        return !info.hasActivity;
      });
    }

    // Search
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.company_name?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [contacts, typeFilter, activityFilter, search]);

  // ── Helpers ──────────────────────────────────────────────
  const getTypeConfig = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.ALL;
  const activeCount = useMemo(() => contacts.filter(c => getActivityInfo(c).hasActivity).length, [contacts]);

  return (
    <div>
      {/* ═══ Type Tabs ═══ */}
      <div
        className="flex gap-1 overflow-x-auto hide-scrollbar"
        style={{
          padding: '0.25rem',
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 'var(--app-radius)',
          marginBottom: '0.5rem',
        }}
      >
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          let count = typeCounts[key] || 0;
          // For CUSTOMER/SUPPLIER tabs, include BOTH in count
          if (key === 'CUSTOMER') count += (typeCounts['BOTH'] || 0);
          if (key === 'SUPPLIER') count += (typeCounts['BOTH'] || 0);
          if (key !== 'ALL' && count === 0) return null;
          const isActive = typeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className="flex items-center gap-1.5 whitespace-nowrap transition-all"
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 500,
                background: isActive ? cfg.bg : 'transparent',
                color: isActive ? cfg.color : 'var(--app-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <cfg.icon size={13} />
              <span className="hidden sm:inline">{cfg.label}</span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  opacity: isActive ? 1 : 0.5,
                  background: isActive ? cfg.color + '20' : 'transparent',
                  padding: '0.0625rem 0.375rem',
                  borderRadius: '99px',
                  color: isActive ? cfg.color : 'var(--app-text-faint)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ Search + Activity Filter + Actions Bar ═══ */}
      <div
        className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
        style={{ marginBottom: '0.5rem' }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{
              position: 'absolute', left: '0.75rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--app-text-faint)',
            }}
          />
          <input
            type="text"
            placeholder="Search by name, email, phone, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="app-input"
            style={{ width: '100%', paddingLeft: '2.25rem', height: '2.25rem' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '0.5rem', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--app-text-faint)',
                padding: '0.25rem',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Activity filter pills */}
        <div className="flex gap-1">
          {[
            { key: 'all' as const, label: 'All', count: contacts.length },
            { key: 'active' as const, label: 'Interacted', count: activeCount },
            { key: 'inactive' as const, label: 'Never', count: contacts.length - activeCount },
          ].map(af => (
            <button
              key={af.key}
              onClick={() => setActivityFilter(af.key)}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '99px',
                fontSize: '0.6875rem',
                fontWeight: activityFilter === af.key ? 700 : 500,
                background: activityFilter === af.key ? 'var(--app-primary-light)' : 'transparent',
                color: activityFilter === af.key ? 'var(--app-primary)' : 'var(--app-text-muted)',
                border: activityFilter === af.key ? '1px solid var(--app-primary)' : '1px solid var(--app-border)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {af.label}
              <span style={{ marginLeft: '0.25rem', opacity: 0.6, fontSize: '0.5625rem' }}>
                {af.count}
              </span>
            </button>
          ))}
        </div>

        {/* Quick Add buttons */}
        {can('crm.create_contact') && (
          <div className="flex gap-1.5">
            <button
              onClick={() => { setModalType('CUSTOMER'); setIsModalOpen(true); }}
              className="app-btn app-btn-sm"
              style={{
                background: 'var(--app-info-bg)', color: 'var(--app-info)',
                border: '1px solid var(--app-info)',
              }}
            >
              <UserPlus size={13} /> <span className="hidden sm:inline">Customer</span>
            </button>
            <button
              onClick={() => { setModalType('SUPPLIER'); setIsModalOpen(true); }}
              className="app-btn app-btn-sm"
              style={{
                background: 'var(--app-warning-bg)', color: 'var(--app-warning)',
                border: '1px solid var(--app-warning)',
              }}
            >
              <Briefcase size={13} /> <span className="hidden sm:inline">Supplier</span>
            </button>
            <button
              onClick={() => { setModalType('BOTH'); setIsModalOpen(true); }}
              className="app-btn app-btn-sm"
              style={{
                background: 'rgba(217,70,239,0.1)', color: '#D946EF',
                border: '1px solid #D946EF',
              }}
            >
              <RefreshCw size={13} /> <span className="hidden sm:inline">Both</span>
            </button>
            <button
              onClick={() => { setModalType('CONTACT'); setIsModalOpen(true); }}
              className="app-btn app-btn-sm app-btn-ghost"
            >
              <BookUser size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ═══ Results Count ═══ */}
      <div
        className="theme-text-xs"
        style={{
          marginBottom: '0.375rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>
          Showing <strong style={{ color: 'var(--app-text)' }}>{filtered.length}</strong> of {contacts.length} contacts
          {typeFilter !== 'ALL' && (
            <span> • <strong style={{ color: getTypeConfig(typeFilter).color }}>{getTypeConfig(typeFilter).label}</strong></span>
          )}
          {activityFilter !== 'all' && (
            <span> • <strong>{activityFilter === 'active' ? 'previously interacted' : 'never interacted'}</strong></span>
          )}
        </span>
      </div>

      {/* ═══ Desktop Table ═══ */}
      <div className="hidden md:block">
        <div
          className="app-card"
          style={{ overflow: 'hidden', borderRadius: 'var(--app-radius)' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <th className="app-th" style={{ textAlign: 'left' }}>Contact</th>
                  <th className="app-th" style={{ textAlign: 'left' }}>Type</th>
                  <th className="app-th" style={{ textAlign: 'left' }}>Phone / Email</th>
                  <th className="app-th" style={{ textAlign: 'left' }}>Tags</th>
                  <th className="app-th" style={{ textAlign: 'center' }}>Activity</th>
                  <th className="app-th" style={{ textAlign: 'right' }}>Balance</th>
                  <th className="app-th" style={{ textAlign: 'center', width: '3rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cfg = getTypeConfig(c.type);
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
                          <div
                            style={{
                              width: '2rem', height: '2rem', borderRadius: '0.5rem',
                              background: cfg.bg, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', flexShrink: 0,
                            }}
                          >
                            <cfg.icon size={13} style={{ color: cfg.color }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700, fontSize: '0.8125rem',
                                color: 'var(--app-text)', whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '14rem',
                              }}
                            >
                              {c.name}
                            </div>
                            {c.company_name && (
                              <div style={{
                                fontSize: '0.6875rem', color: 'var(--app-text-muted)',
                                whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis', maxWidth: '14rem',
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
                          <span
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              padding: '0.125rem 0.5rem', borderRadius: '99px',
                              fontSize: '0.625rem', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: cfg.bg, color: cfg.color,
                            }}
                          >
                            {c.type === 'BOTH' ? 'CLIENT + SUPPLIER' : c.type}
                          </span>
                          {c.customer_tier && c.customer_tier !== 'STANDARD' && (
                            <span
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.125rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '99px', fontSize: '0.5625rem', fontWeight: 700,
                                background: c.customer_tier === 'VIP' ? '#FEF3C7' : 'var(--app-surface-2)',
                                color: c.customer_tier === 'VIP' ? '#B45309' : 'var(--app-text-muted)',
                              }}
                            >
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
                              <Phone size={11} style={{ color: 'var(--app-text-faint)' }} />
                              {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                              <Mail size={10} style={{ color: 'var(--app-text-faint)' }} />
                              {c.email}
                            </span>
                          )}
                          {!c.phone && !c.email && <span style={{ color: 'var(--app-text-faint)', fontSize: '0.6875rem' }}>—</span>}
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="app-td">
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(c.tagNames || []).slice(0, 2).map((t: any) => (
                            <span
                              key={t.id || t.name}
                              style={{
                                padding: '0.0625rem 0.375rem', borderRadius: '99px',
                                fontSize: '0.5625rem', fontWeight: 600,
                                background: (t.color || '#6366F1') + '18',
                                color: t.color || '#6366F1',
                              }}
                            >
                              {t.name}
                            </span>
                          ))}
                          {(c.tagNames || []).length > 2 && (
                            <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)' }}>
                              +{c.tagNames.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="app-td" style={{ textAlign: 'center' }}>
                        {act.hasActivity ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.0625rem' }}>
                            <span
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                fontSize: '0.6875rem', fontWeight: 700, color: act.recencyColor,
                              }}
                            >
                              <Activity size={10} />
                              {act.orders} order{act.orders !== 1 ? 's' : ''}
                            </span>
                            {c.last_purchase_date && (
                              <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)' }}>
                                {formatRelativeDate(c.last_purchase_date)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.625rem', color: 'var(--app-text-faint)',
                              fontStyle: 'italic',
                            }}
                          >
                            no activity
                          </span>
                        )}
                      </td>

                      {/* Balance */}
                      <td className="app-td" style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700, fontSize: '0.8125rem',
                            color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          }}
                        >
                          {bal > 0 && <TrendingUp size={12} />}
                          {bal < 0 && <TrendingDown size={12} />}
                          {fmt(Math.abs(bal))}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="app-td" style={{ textAlign: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/crm/contacts/${c.id}`); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--app-text-faint)', padding: '0.25rem',
                            borderRadius: '0.25rem', transition: 'color 0.15s',
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = 'var(--app-primary)')}
                          onMouseOut={e => (e.currentTarget.style.color = 'var(--app-text-faint)')}
                          title="View details"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Users size={32} style={{ color: 'var(--app-text-faint)', margin: '0 auto 0.5rem' }} />
                      <p className="theme-text-muted">No contacts found</p>
                      <p className="theme-text-sm" style={{ marginTop: '0.25rem' }}>
                        {search ? 'Try a different search term' : activityFilter !== 'all' ? 'No contacts match this activity filter' : 'Create your first contact to get started'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ Mobile Cards ═══ */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map(c => {
          const cfg = getTypeConfig(c.type);
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
                <div
                  style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                    background: cfg.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <cfg.icon size={15} style={{ color: cfg.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex justify-between items-start">
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          fontWeight: 700, fontSize: '0.875rem',
                          color: 'var(--app-text)', whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        {c.name}
                      </h3>
                      {c.company_name && (
                        <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)', marginTop: '0.0625rem' }}>
                          {c.company_name}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0, marginLeft: '0.5rem',
                        color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
                      }}
                    >
                      {fmt(Math.abs(bal))}
                    </span>
                  </div>

                  {/* Tags + Type row */}
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '0.0625rem 0.375rem', borderRadius: '99px',
                        fontSize: '0.5625rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: cfg.bg, color: cfg.color,
                      }}
                    >
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
                    {(c.tagNames || []).slice(0, 2).map((t: any) => (
                      <span
                        key={t.id || t.name}
                        style={{
                          padding: '0.0625rem 0.375rem', borderRadius: '99px',
                          fontSize: '0.5625rem', fontWeight: 600,
                          background: (t.color || '#6366F1') + '18',
                          color: t.color || '#6366F1',
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>

                  {/* Contact info */}
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
            <Users size={32} style={{ color: 'var(--app-text-faint)', margin: '0 auto 0.5rem' }} />
            <p className="theme-text-muted">No contacts found</p>
          </div>
        )}
      </div>

      {/* ═══ Modal ═══ */}
      {isModalOpen && (
        <ContactModal
          sites={sites}
          type={modalType}
          onClose={() => {
            setIsModalOpen(false);
            router.refresh();
          }}
          deliveryZones={deliveryZones}
          taxProfiles={taxProfiles}
        />
      )}
    </div>
  );
}