// @ts-nocheck
'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import {
  Search, User, Briefcase, Building2, Phone, Mail, Plus,
  TrendingUp, TrendingDown, Star, Users, MapPin, Trash2,
  ChevronRight, Wrench, BookUser, X, RefreshCw,
  CircleDot, ChevronDown, Tag
} from 'lucide-react';
import ContactModal from './form';

type Contact = Record<string, any>;

/* ─── Type chips ─────────────────────────────────── */
const TYPES = [
  { key: 'ALL', label: 'All', shortLabel: 'All', icon: Users, color: 'var(--app-text)', bg: 'var(--app-surface-2)' },
  { key: 'CUSTOMER', label: 'Customers', shortLabel: 'Clients', icon: User, color: 'var(--app-info)', bg: 'var(--app-info-bg)' },
  { key: 'SUPPLIER', label: 'Suppliers', shortLabel: 'Suppliers', icon: Briefcase, color: 'var(--app-warning)', bg: 'var(--app-warning-bg)' },
  { key: 'BOTH', label: 'Client + Supplier', shortLabel: 'Both', icon: RefreshCw, color: '#D946EF', bg: 'rgba(217,70,239,0.08)' },
  { key: 'LEAD', label: 'Leads', shortLabel: 'Leads', icon: TrendingUp, color: 'var(--app-success)', bg: 'var(--app-success-bg)' },
  { key: 'CONTACT', label: 'Address Book', shortLabel: 'Contacts', icon: BookUser, color: 'var(--app-primary)', bg: 'var(--app-primary-light)' },
  { key: 'SERVICE', label: 'Service Providers', shortLabel: 'Services', icon: Wrench, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  { key: 'CREDITOR', label: 'Creditors', shortLabel: 'Creditors', icon: TrendingDown, color: 'var(--app-error)', bg: 'rgba(239,68,68,0.08)' },
  { key: 'DEBTOR', label: 'Debtors', shortLabel: 'Debtors', icon: TrendingUp, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
] as const;

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.key, t]));

/* ─── Tier config ─────────────────────────────────── */
const TIERS = [
  { value: '', label: 'All Tiers' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'VIP', label: 'VIP' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'RETAIL', label: 'Retail' },
];

const SUPPLIER_CATS = [
  { value: '', label: 'All Categories' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'DEPOT_VENTE', label: 'Consignment' },
  { value: 'MIXED', label: 'Mixed' },
];

/* ─── Activity helpers ──────────────────────────────── */
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

/* ── Mini dropdown component ── */
function FilterDropdown({
  label, icon: Icon, value, options, onChange,
}: {
  label: string; icon: any; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={12} style={{
        position: 'absolute', left: '0.5rem', top: '50%',
        transform: 'translateY(-50%)', color: value ? 'var(--app-primary)' : 'var(--app-text-faint)',
        pointerEvents: 'none',
      }} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          paddingLeft: '1.625rem', paddingRight: '1.25rem',
          height: '2rem', fontSize: '0.6875rem', fontWeight: value ? 700 : 500,
          background: value ? 'var(--app-primary-light)' : 'var(--app-bg)',
          color: value ? 'var(--app-primary)' : 'var(--app-text-muted)',
          border: value ? '1px solid var(--app-primary)' : '1px solid var(--app-border)',
          borderRadius: 'calc(var(--app-radius) - 0.25rem)',
          outline: 'none', cursor: 'pointer', appearance: 'none',
          WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.375rem center',
          transition: 'all 0.15s',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
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
  const [tierFilter, setTierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('CUSTOMER');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');
  const [newTagType, setNewTagType] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const [managedTags, setManagedTags] = useState(contactTags);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  /* ── counts ── */
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: contacts.length };
    contacts.forEach(x => { c[x.type] = (c[x.type] || 0) + 1; });
    return c;
  }, [contacts]);

  /* ── available zones/sites from contacts ── */
  const zonesUsed = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach(c => {
      if (c.home_zone) {
        const zone = typeof c.home_zone === 'object' ? c.home_zone : deliveryZones.find(z => z.id === c.home_zone);
        if (zone) map.set(String(zone.id), zone.name);
      }
    });
    return [{ value: '', label: 'All Zones' }, ...Array.from(map.entries()).map(([v, l]) => ({ value: v, label: l }))];
  }, [contacts, deliveryZones]);

  const sitesUsed = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach(c => {
      const s = c.homeSite || c.home_site;
      if (s) {
        const site = typeof s === 'object' ? s : sites.find(x => x.id === s);
        if (site) map.set(String(site.id), site.name);
      }
    });
    return [{ value: '', label: 'All Sites' }, ...Array.from(map.entries()).map(([v, l]) => ({ value: v, label: l }))];
  }, [contacts, sites]);

  const hasActiveFilters = search || typeFilter !== 'ALL' || tierFilter || categoryFilter || zoneFilter || siteFilter || activityFilter !== 'all';

  /* ── filter ── */
  const filtered = useMemo(() => {
    let r = contacts;
    if (typeFilter === 'CUSTOMER') r = r.filter(c => c.type === 'CUSTOMER' || c.type === 'BOTH');
    else if (typeFilter === 'SUPPLIER') r = r.filter(c => c.type === 'SUPPLIER' || c.type === 'BOTH');
    else if (typeFilter !== 'ALL') r = r.filter(c => c.type === typeFilter);

    if (tierFilter) r = r.filter(c => c.customer_tier === tierFilter);
    if (categoryFilter) r = r.filter(c => c.supplier_category === categoryFilter);
    if (zoneFilter) r = r.filter(c => {
      const zId = typeof c.home_zone === 'object' ? c.home_zone?.id : c.home_zone;
      return String(zId) === zoneFilter;
    });
    if (siteFilter) r = r.filter(c => {
      const s = c.homeSite || c.home_site;
      const sId = typeof s === 'object' ? s?.id : s;
      return String(sId) === siteFilter;
    });

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
  }, [contacts, typeFilter, tierFilter, categoryFilter, zoneFilter, siteFilter, activityFilter, search]);

  const getCfg = (type: string) => TYPE_MAP[type] || TYPE_MAP.ALL;

  function clearAll() {
    setSearch(''); setTypeFilter('ALL'); setTierFilter(''); setCategoryFilter('');
    setZoneFilter(''); setSiteFilter(''); setActivityFilter('all');
  }

  function openAddMenu() {
    if (addBtnRef.current) {
      const rect = addBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowAddMenu(true);
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    setTagSaving(true);
    try {
      const body: any = { name: newTagName.trim(), color: newTagColor };
      if (newTagType) body.contact_type = newTagType;
      const data = await erpFetch('/crm/contact-tags/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setManagedTags(prev => [...prev, data]);
      setNewTagName('');
      setNewTagColor('#6366F1');
      setNewTagType('');
      toast.success(`Category "${data.name}" created`);
    } catch (e: any) {
      toast.error(`Failed: ${e.message || 'Unknown error'}`);
    } finally {
      setTagSaving(false);
    }
  }

  async function handleDeleteTag(tag: any) {
    if (!confirm(`Delete category "${tag.name}"?`)) return;
    try {
      await erpFetch(`/crm/contact-tags/${tag.id}/`, { method: 'DELETE' });
      setManagedTags(prev => prev.filter((t: any) => t.id !== tag.id));
      toast.success(`Deleted "${tag.name}"`);
    } catch {
      toast.error('Failed to delete');
    }
  }

  /* Group tags by contact_type for display */
  const tagsByType = useMemo(() => {
    const groups: Record<string, any[]> = { '': [] };
    TYPES.filter(t => t.key !== 'ALL').forEach(t => { groups[t.key] = []; });
    managedTags.forEach((tag: any) => {
      const k = tag.contact_type || '';
      if (!groups[k]) groups[k] = [];
      groups[k].push(tag);
    });
    return groups;
  }, [managedTags]);

  /* ═══════════════════════ RENDER ═══════════════════════════ */
  return (
    <div>
      {/* ══════════════════════════════════════════════
                CONTROL PANEL — no overflow:hidden so dropdown works
            ══════════════════════════════════════════════ */}
      <div
        className="app-card"
        style={{
          padding: '0',
          borderRadius: 'var(--app-radius)',
          marginBottom: '0.75rem',
        }}
      >
        {/* ── Row 1: Type tabs + Add button ── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.5rem 0.625rem',
            borderBottom: '1px solid var(--app-border)',
            background: 'var(--app-surface)',
            overflowX: 'auto',
          }}
          className="hide-scrollbar"
        >
          {TYPES.map(cfg => {
            let count = typeCounts[cfg.key] || 0;
            if (cfg.key === 'CUSTOMER') count += (typeCounts['BOTH'] || 0);
            if (cfg.key === 'SUPPLIER') count += (typeCounts['BOTH'] || 0);
            const active = typeFilter === cfg.key;
            return (
              <button
                key={cfg.key}
                onClick={() => setTypeFilter(cfg.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3125rem',
                  padding: '0.375rem 0.5rem',
                  borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                  fontSize: '0.6875rem', fontWeight: active ? 700 : 500,
                  background: active ? cfg.bg : 'transparent',
                  color: active ? cfg.color : 'var(--app-text-muted)',
                  border: active ? `1px solid ${cfg.color}25` : '1px solid transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                <cfg.icon size={12} />
                <span className="hidden sm:inline">{cfg.shortLabel}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: '0.5625rem', fontWeight: 800,
                    color: active ? cfg.color : 'var(--app-text-faint)',
                    opacity: active ? 1 : 0.6,
                    minWidth: '0.875rem', textAlign: 'center',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Add + Categories buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem', paddingLeft: '0.5rem', flexShrink: 0 }}>
            <button
              ref={addBtnRef}
              onClick={openAddMenu}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.3125rem 0.625rem', borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                fontSize: '0.6875rem', fontWeight: 700,
                background: 'var(--app-primary)', color: '#fff',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <Plus size={12} /> New Contact <ChevronDown size={10} />
            </button>
            <button
              onClick={() => setShowTagManager(true)}
              title="Manage Categories"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.3125rem 0.5rem', borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                fontSize: '0.625rem', fontWeight: 600,
                background: 'var(--app-surface-2)', color: 'var(--app-text-muted)',
                border: '1px solid var(--app-border)', cursor: 'pointer',
              }}
            >
              <Tag size={11} /> Categories
            </button>
          </div>
        </div>

        {/* ── Row 2: Search + Smart Filters ── */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
            padding: '0.5rem 0.625rem',
            background: 'var(--app-bg)',
            alignItems: 'center',
            borderRadius: '0 0 var(--app-radius) var(--app-radius)',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
            <Search size={13} style={{
              position: 'absolute', left: '0.625rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--app-text-faint)',
            }} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: '2rem', paddingRight: search ? '1.75rem' : '0.5rem',
                height: '2rem', fontSize: '0.75rem',
                background: 'var(--app-surface)', color: 'var(--app-text)',
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
                  position: 'absolute', right: '0.375rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'var(--app-surface-2)',
                  border: 'none', cursor: 'pointer', color: 'var(--app-text-faint)',
                  padding: '0.0625rem', borderRadius: '99px', display: 'flex',
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '1.25rem', background: 'var(--app-border)', margin: '0 0.125rem' }} className="hidden sm:block" />

          {/* Tier filter */}
          <FilterDropdown label="Tier" icon={Star} value={tierFilter} options={TIERS} onChange={setTierFilter} />

          {/* Supplier Category filter */}
          <FilterDropdown label="Category" icon={Tag} value={categoryFilter} options={SUPPLIER_CATS} onChange={setCategoryFilter} />

          {/* Zone filter */}
          {zonesUsed.length > 1 && (
            <FilterDropdown label="Zone" icon={MapPin} value={zoneFilter} options={zonesUsed} onChange={setZoneFilter} />
          )}

          {/* Site filter */}
          {sitesUsed.length > 1 && (
            <FilterDropdown label="Site" icon={Building2} value={siteFilter} options={sitesUsed} onChange={setSiteFilter} />
          )}

          {/* Divider */}
          <div style={{ width: '1px', height: '1.25rem', background: 'var(--app-border)', margin: '0 0.125rem' }} className="hidden sm:block" />

          {/* Activity toggle pills */}
          <div
            className="flex"
            style={{
              borderRadius: 'calc(var(--app-radius) - 0.25rem)',
              padding: '0.0625rem', gap: '0.0625rem',
              background: 'var(--app-surface)',
              border: '1px solid var(--app-border)',
            }}
          >
            {([
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'inactive', label: 'Never' },
            ] as const).map(af => {
              const isOn = activityFilter === af.key;
              return (
                <button
                  key={af.key}
                  onClick={() => setActivityFilter(af.key)}
                  style={{
                    padding: '0.1875rem 0.4375rem',
                    borderRadius: 'calc(var(--app-radius) - 0.375rem)',
                    fontSize: '0.625rem', fontWeight: isOn ? 700 : 500,
                    background: isOn ? 'var(--app-primary-light)' : 'transparent',
                    color: isOn ? 'var(--app-primary)' : 'var(--app-text-muted)',
                    border: 'none', cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}
                >
                  {af.label}
                </button>
              );
            })}
          </div>

          {/* Results count + Clear */}
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.6875rem', color: 'var(--app-text-muted)',
          }}>
            <span>
              <strong style={{ color: 'var(--app-text)', fontWeight: 700 }}>{filtered.length}</strong> of {contacts.length}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                style={{
                  fontSize: '0.5625rem', fontWeight: 700,
                  color: 'var(--app-primary)', background: 'var(--app-primary-light)',
                  border: 'none', cursor: 'pointer',
                  padding: '0.125rem 0.375rem', borderRadius: '99px',
                  display: 'flex', alignItems: 'center', gap: '0.1875rem',
                }}
              >
                <X size={9} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
                DESKTOP TABLE
            ══════════════════════════════════════════════ */}
      <div className="hidden md:block">
        <div className="app-card" style={{ overflow: 'hidden', borderRadius: 'var(--app-radius)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Contact', 'Type', 'Phone / Email', 'Tags', 'Activity', 'Balance', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className="app-th"
                      style={{
                        textAlign: i === 5 ? 'right' : i === 6 ? 'center' : 'left',
                        width: i === 6 ? '2.5rem' : undefined,
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

                      {/* Type + Tier */}
                      <td className="app-td">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1875rem', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.125rem',
                            padding: '0.0625rem 0.375rem', borderRadius: '99px',
                            fontSize: '0.5625rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.03em',
                            background: cfg.bg, color: cfg.color,
                          }}>
                            {c.type === 'BOTH' ? 'CLIENT+SUPPLIER' : c.type}
                          </span>
                          {c.customer_tier && c.customer_tier !== 'STANDARD' && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.125rem',
                              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
                              fontSize: '0.5rem', fontWeight: 700,
                              background: c.customer_tier === 'VIP' ? '#FEF3C7' : 'var(--app-surface-2)',
                              color: c.customer_tier === 'VIP' ? '#B45309' : 'var(--app-text-muted)',
                            }}>
                              {c.customer_tier === 'VIP' && <Star size={7} style={{ fill: '#EAB308' }} />}
                              {c.customer_tier}
                            </span>
                          )}
                          {c.supplier_category && c.supplier_category !== 'REGULAR' && (
                            <span style={{
                              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
                              fontSize: '0.5rem', fontWeight: 700,
                              background: 'var(--app-warning-bg)', color: 'var(--app-warning)',
                            }}>
                              {c.supplier_category === 'DEPOT_VENTE' ? 'CONSIGN' : c.supplier_category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Phone/Email */}
                      <td className="app-td">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.0625rem' }}>
                          {c.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', fontSize: '0.75rem', color: 'var(--app-text)' }}>
                              <Phone size={10} style={{ color: 'var(--app-text-faint)' }} /> {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                              <Mail size={9} style={{ color: 'var(--app-text-faint)' }} /> {c.email}
                            </span>
                          )}
                          {!c.phone && !c.email && <span style={{ color: 'var(--app-text-faint)', fontSize: '0.6875rem' }}>—</span>}
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="app-td">
                        <div style={{ display: 'flex', gap: '0.1875rem', flexWrap: 'wrap' }}>
                          {(c.tagNames || c.tag_names || []).slice(0, 2).map((t: any) => (
                            <span key={t.id || t.name} style={{
                              padding: '0.0625rem 0.3125rem', borderRadius: '99px',
                              fontSize: '0.5rem', fontWeight: 600,
                              background: (t.color || '#6366F1') + '18',
                              color: t.color || '#6366F1',
                            }}>
                              {t.name}
                            </span>
                          ))}
                          {(c.tagNames || c.tag_names || []).length > 2 && (
                            <span style={{ fontSize: '0.5rem', color: 'var(--app-text-faint)' }}>+{(c.tagNames || c.tag_names).length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="app-td" style={{ textAlign: 'center' }}>
                        {act.hasActivity ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.1875rem',
                              fontSize: '0.6875rem', fontWeight: 700, color: act.recencyColor,
                            }}>
                              <CircleDot size={7} />
                              {act.orders}
                            </span>
                            {c.last_purchase_date && (
                              <span style={{ fontSize: '0.5rem', color: 'var(--app-text-faint)' }}>
                                {formatRelDate(c.last_purchase_date)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      {/* Balance */}
                      <td className="app-td" style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.8125rem',
                          color: bal > 0 ? 'var(--app-success)' : bal < 0 ? 'var(--app-error)' : 'var(--app-text-faint)',
                          display: 'inline-flex', alignItems: 'center', gap: '0.1875rem',
                        }}>
                          {bal > 0 && <TrendingUp size={11} />}
                          {bal < 0 && <TrendingDown size={11} />}
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
                        {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first contact to get started'}
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
                  <div style={{ display: 'flex', gap: '0.1875rem', marginTop: '0.3125rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.0625rem 0.3125rem', borderRadius: '99px',
                      fontSize: '0.5rem', fontWeight: 700,
                      textTransform: 'uppercase', background: cfg.bg, color: cfg.color,
                    }}>
                      {c.type === 'BOTH' ? 'CLIENT+SUPPLIER' : c.type}
                    </span>
                    {c.customer_tier && c.customer_tier !== 'STANDARD' && (
                      <span style={{ padding: '0.0625rem 0.3125rem', borderRadius: '99px', fontSize: '0.5rem', fontWeight: 700, background: '#FEF3C7', color: '#B45309' }}>
                        {c.customer_tier === 'VIP' && '⭐ '}{c.customer_tier}
                      </span>
                    )}
                    {act.hasActivity && (
                      <span style={{ padding: '0.0625rem 0.3125rem', borderRadius: '99px', fontSize: '0.5rem', fontWeight: 600, color: act.recencyColor, background: act.recencyColor + '15' }}>
                        {act.orders} orders • {act.recency}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.3125rem', flexWrap: 'wrap' }}>
                    {c.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                        <Phone size={9} /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem', fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>
                        <Mail size={9} /> {c.email}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--app-text-faint)', flexShrink: 0, marginTop: '0.5rem' }} />
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

      {/* ══════════════════════════════════════════════
                ADD CONTACT DROPDOWN (fixed position, not clipped)
            ══════════════════════════════════════════════ */}
      {showAddMenu && (
        <>
          <div
            onClick={() => setShowAddMenu(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: 'fixed', top: menuPos.top, right: menuPos.right,
              background: 'var(--app-surface)', border: '1px solid var(--app-border)',
              borderRadius: 'var(--app-radius)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              minWidth: '13rem', zIndex: 100, padding: '0.25rem',
            }}
          >
            <div style={{ padding: '0.375rem 0.625rem', fontSize: '0.5625rem', fontWeight: 700, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Choose Contact Type
            </div>
            {TYPES.filter(t => t.key !== 'ALL').map(cfg => (
              <button
                key={cfg.key}
                onClick={() => {
                  setShowAddMenu(false);
                  setModalType(cfg.key);
                  setIsModalOpen(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.4375rem 0.625rem',
                  borderRadius: 'calc(var(--app-radius) - 0.375rem)',
                  fontSize: '0.75rem', fontWeight: 600,
                  background: 'transparent', color: 'var(--app-text)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseOver={e => e.currentTarget.style.background = cfg.bg}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '1.375rem', height: '1.375rem', borderRadius: '0.3125rem',
                  background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <cfg.icon size={11} style={{ color: cfg.color }} />
                </div>
                <span>{cfg.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
                CONTACT CREATION MODAL
            ══════════════════════════════════════════════ */}
      {isModalOpen && (
        <ContactModal
          sites={sites}
          type={modalType}
          onClose={() => { setIsModalOpen(false); router.refresh(); }}
          deliveryZones={deliveryZones}
          taxProfiles={taxProfiles}
        />
      )}

      {/* ══════════════════════════════════════════════
                TAG / CATEGORY MANAGER MODAL
            ══════════════════════════════════════════════ */}
      {showTagManager && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowTagManager(false)}
        >
          <div
            className="app-card"
            style={{
              width: '100%', maxWidth: '32rem', maxHeight: '85vh',
              borderRadius: 'var(--app-radius)', overflow: 'hidden',
              boxShadow: '0 16px 64px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--app-text)' }}>
                  Contact Categories
                </h3>
                <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)', marginTop: '0.125rem' }}>
                  Each parent type can have its own child categories
                </p>
              </div>
              <button
                onClick={() => setShowTagManager(false)}
                style={{
                  background: 'var(--app-surface-2)', border: 'none', cursor: 'pointer',
                  color: 'var(--app-text-muted)', padding: '0.375rem', borderRadius: '0.375rem',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Create new tag */}
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="color"
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  title="Pick color"
                  style={{
                    width: '2rem', height: '2rem', border: '2px solid var(--app-border)',
                    borderRadius: '0.375rem', cursor: 'pointer', padding: 0,
                  }}
                />
                <input
                  type="text"
                  placeholder="Category name..."
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newTagName.trim() && handleCreateTag()}
                  style={{
                    flex: 1, height: '2rem', fontSize: '0.8125rem', fontWeight: 600,
                    background: 'var(--app-surface)', color: 'var(--app-text)',
                    border: '1px solid var(--app-border)',
                    borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                    padding: '0 0.625rem', outline: 'none', minWidth: '100px',
                  }}
                />
                <select
                  value={newTagType}
                  onChange={e => setNewTagType(e.target.value)}
                  style={{
                    height: '2rem', fontSize: '0.6875rem', fontWeight: 600,
                    background: 'var(--app-surface)', color: 'var(--app-text)',
                    border: '1px solid var(--app-border)',
                    borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                    padding: '0 0.5rem', outline: 'none', appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.375rem center',
                    paddingRight: '1.25rem',
                  }}
                >
                  <option value="">All Types</option>
                  {TYPES.filter(t => t.key !== 'ALL').map(t => (
                    <option key={t.key} value={t.key}>{t.shortLabel}</option>
                  ))}
                </select>
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || tagSaving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.375rem 0.75rem', borderRadius: 'calc(var(--app-radius) - 0.25rem)',
                    fontSize: '0.6875rem', fontWeight: 700,
                    background: 'var(--app-primary)', color: '#fff',
                    border: 'none', cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
                    opacity: newTagName.trim() ? 1 : 0.5,
                  }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {/* Tag list grouped by parent type */}
            <div style={{ overflowY: 'auto', maxHeight: '24rem' }}>
              {managedTags.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <Tag size={28} style={{ color: 'var(--app-text-faint)', margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--app-text-muted)', fontWeight: 600 }}>No categories yet</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--app-text-faint)', marginTop: '0.25rem' }}>
                    Create your first category above — pick a name, color, and parent type
                  </p>
                </div>
              ) : (
                <div style={{ padding: '0.5rem' }}>
                  {/* Global categories (no parent type) */}
                  {tagsByType['']?.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{
                        padding: '0.3125rem 0.5rem', fontSize: '0.5625rem', fontWeight: 700,
                        color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        ● Global (All Types)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                        {tagsByType[''].map((tag: any) => (
                          <TagRow key={tag.id} tag={tag} onDelete={handleDeleteTag} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Type-scoped categories */}
                  {TYPES.filter(t => t.key !== 'ALL').map(typeCfg => {
                    const tags = tagsByType[typeCfg.key] || [];
                    if (tags.length === 0) return null;
                    return (
                      <div key={typeCfg.key} style={{ marginBottom: '0.5rem' }}>
                        <div style={{
                          padding: '0.3125rem 0.5rem', fontSize: '0.5625rem', fontWeight: 700,
                          color: typeCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em',
                          display: 'flex', alignItems: 'center', gap: '0.3125rem',
                        }}>
                          <typeCfg.icon size={10} />
                          {typeCfg.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                          {tags.map((tag: any) => (
                            <TagRow key={tag.id} tag={tag} onDelete={handleDeleteTag} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable tag row ── */
function TagRow({ tag, onDelete }: { tag: any; onDelete: (t: any) => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.375rem 0.5rem', borderRadius: 'calc(var(--app-radius, 12px) - 0.25rem)',
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
      }}
    >
      <div style={{
        width: '1rem', height: '1rem', borderRadius: '0.25rem',
        background: tag.color || '#6366F1', flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--app-text)' }}>
        {tag.name}
      </span>
      <button
        onClick={() => onDelete(tag)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--app-text-faint)', padding: '0.1875rem',
          borderRadius: '0.25rem', transition: 'color 0.1s',
        }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--app-error)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--app-text-faint)'}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}