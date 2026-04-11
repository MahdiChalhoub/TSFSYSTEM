'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { createContact, updateContact } from '@/app/actions/people';
import {
  User, ArrowLeft, Briefcase, Phone, Mail, MapPin, Building2,
  CreditCard, Globe, FileText, Clock, Tag, MessageCircle, Shield,
  Save, Plus
} from 'lucide-react';

type ContactData = Record<string, any>;

export default function ContactFormPage({
  sites,
  type = 'CUSTOMER',
  deliveryZones = [],
  taxProfiles = [],
  contactTags = [],
  contact,
}: {
  sites: Record<string, any>[],
  type?: string,
  deliveryZones?: Record<string, any>[],
  taxProfiles?: Record<string, any>[],
  contactTags?: Record<string, any>[],
  contact?: ContactData,
}) {
  const router = useRouter();
  const isEdit = !!contact?.id;
  const [entityType, setEntityType] = useState(contact?.entity_type || 'INDIVIDUAL');

  const [state, action, isPending] = useActionState(
    async (prevState: Record<string, any>, formData: FormData) => {
      let result;
      if (isEdit) {
        formData.append('id', String(contact!.id));
        result = await updateContact(prevState, formData);
      } else {
        result = await createContact(prevState, formData);
      }
      if (result.success) {
        setTimeout(() => router.push('/crm/contacts'), 500);
      }
      return result;
    },
    { success: false, message: '' }
  );

  const typeLabel = type === 'CUSTOMER' ? 'Customer' : type === 'SUPPLIER' ? 'Supplier' : type === 'BOTH' ? 'Client + Supplier' : type === 'SERVICE' ? 'Service Provider' : type === 'LEAD' ? 'Lead' : 'Contact';

  /* ── shared field style ── */
  const fieldCls = "w-full pl-12 pr-4 py-3.5 rounded-xl bg-[var(--app-bg)] border border-[var(--app-border)] focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-primary)]30 outline-none transition-all font-semibold text-[var(--app-text)] text-sm";
  const labelCls = "block text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-[var(--app-text-muted)] mb-1.5 ml-0.5";
  const iconCls: React.CSSProperties = { position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--app-text-faint)' };

  return (
    <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
      {/* ── Header ── */}
      <header className="fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: 'clamp(1rem, 2vw, 1.5rem)' }}>
        <button
          onClick={() => router.back()}
          style={{
            width: '2.25rem', height: '2.25rem', borderRadius: 'var(--app-radius-sm)',
            background: 'var(--app-surface)', border: '1px solid var(--app-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--app-text-muted)', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div
          className="app-icon-badge"
          style={{ width: '2.75rem', height: '2.75rem', borderRadius: 'var(--app-radius-sm)', flexShrink: 0 }}
        >
          {type === 'CUSTOMER' || type === 'BOTH' ? <User size={18} color="#fff" /> : <Briefcase size={18} color="#fff" />}
        </div>
        <div>
          <h1 style={{
            fontSize: 'clamp(1.125rem, 2vw, 1.5rem)', fontWeight: 800,
            color: 'var(--app-text)', letterSpacing: '-0.03em',
          }}>
            {isEdit ? 'Edit' : 'Create'} <span style={{ color: 'var(--app-primary)' }}>{typeLabel}</span>
          </h1>
          <p className="theme-text-sm" style={{ marginTop: '0.0625rem' }}>
            {isEdit ? `Updating ${contact!.name}` : `Add a new ${typeLabel.toLowerCase()} to your contact list`}
          </p>
        </div>
      </header>

      {/* ── Form Card ── */}
      <div className="app-card fade-in-up" style={{ maxWidth: '56rem', padding: 'clamp(1rem, 2vw, 1.75rem)', animationDelay: '40ms' }}>
        {state.message && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--app-radius-sm)',
            background: state.success ? 'var(--app-success-bg)' : 'rgba(239,68,68,0.08)',
            color: state.success ? 'var(--app-success)' : 'var(--app-error)',
            fontSize: '0.8125rem', fontWeight: 600,
          }}>
            {state.message}
          </div>
        )}

        <form action={action}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="entity_type" value={entityType} />

          {/* ── Entity Type Toggle ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p className={labelCls}>Entity Type</p>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--app-bg)', padding: '0.1875rem', borderRadius: 'var(--app-radius-sm)', border: '1px solid var(--app-border)' }}>
              {(['INDIVIDUAL', 'BUSINESS'] as const).map(et => (
                <button
                  key={et}
                  type="button"
                  onClick={() => setEntityType(et)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                    padding: '0.5rem', borderRadius: 'calc(var(--app-radius-sm) - 0.125rem)',
                    fontSize: '0.8125rem', fontWeight: entityType === et ? 700 : 500,
                    background: entityType === et ? 'var(--app-primary)' : 'transparent',
                    color: entityType === et ? '#fff' : 'var(--app-text-muted)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {et === 'INDIVIDUAL' ? <User size={14} /> : <Building2 size={14} />}
                  {et === 'INDIVIDUAL' ? 'Individual' : 'Business'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Fields Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Name */}
            <div>
              <label className={labelCls}>Entity / Individual Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={iconCls} />
                <input name="name" className={fieldCls} placeholder="Full Name or Company" required defaultValue={contact?.name || ''} />
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className={labelCls}>Company Name</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={15} style={iconCls} />
                <input name="companyName" className={fieldCls} placeholder="Company / Organization" defaultValue={contact?.company_name || ''} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={iconCls} />
                <input name="email" type="email" className={fieldCls} placeholder="contact@example.com" defaultValue={contact?.email || ''} />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={15} style={iconCls} />
                <input name="phone" type="tel" className={fieldCls} placeholder="+1 (555) 000-0000" defaultValue={contact?.phone || ''} />
              </div>
            </div>

            {/* Home Site */}
            <div>
              <label className={labelCls}>Home Site</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={15} style={iconCls} />
                <select name="homeSiteId" className={fieldCls} style={{ appearance: 'none' }} defaultValue={contact?.home_site || ''}>
                  <option value="">Select Site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Supplier Category */}
            {(type === 'SUPPLIER' || type === 'BOTH') && (
              <div>
                <label className={labelCls}>Supplier Category</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={15} style={iconCls} />
                  <select name="supplierCategory" className={fieldCls} style={{ appearance: 'none' }} defaultValue={contact?.supplier_category || 'REGULAR'}>
                    <option value="REGULAR">Regular Supplier</option>
                    <option value="DEPOT_VENTE">Consignment</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>
              </div>
            )}

            {/* Customer Tier */}
            {(type === 'CUSTOMER' || type === 'BOTH') && (
              <div>
                <label className={labelCls}>Client Tier</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={15} style={iconCls} />
                  <select name="customerTier" className={fieldCls} style={{ appearance: 'none' }} defaultValue={contact?.customer_tier || 'STANDARD'}>
                    <option value="STANDARD">Standard</option>
                    <option value="VIP">VIP</option>
                    <option value="WHOLESALE">Wholesale</option>
                    <option value="RETAIL">Retail</option>
                  </select>
                </div>
              </div>
            )}

            {/* Home Zone */}
            {(type === 'CUSTOMER' || type === 'BOTH') && deliveryZones.length > 0 && (
              <div>
                <label className={labelCls}>Delivery Zone</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} style={iconCls} />
                  <select name="homeZoneId" className={fieldCls} style={{ appearance: 'none' }} defaultValue={contact?.home_zone || ''}>
                    <option value="">No Zone Assigned</option>
                    {deliveryZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* WhatsApp Group ID */}
            <div>
              <label className={labelCls}>WhatsApp Group ID</label>
              <div style={{ position: 'relative' }}>
                <MessageCircle size={15} style={iconCls} />
                <input name="whatsappGroupId" className={fieldCls} placeholder="Optional (Group Alerts)" defaultValue={contact?.whatsapp_group_id || ''} />
              </div>
            </div>

            {/* Payment Terms */}
            <div>
              <label className={labelCls}>Payment Terms (Days)</label>
              <div style={{ position: 'relative' }}>
                <Clock size={15} style={iconCls} />
                <input name="paymentTermsDays" type="number" min="0" className={fieldCls} placeholder="0 = Immediate" defaultValue={contact?.payment_terms_days || 0} />
              </div>
            </div>

            {/* Credit Limit */}
            <div>
              <label className={labelCls}>Credit Limit</label>
              <div style={{ position: 'relative' }}>
                <CreditCard size={15} style={iconCls} />
                <input name="creditLimit" type="number" min="0" step="0.01" className={fieldCls} placeholder="0.00" defaultValue={contact?.credit_limit || ''} />
              </div>
            </div>

            {/* Tax Profile */}
            <div>
              <label className={labelCls}>Tax Profile <span style={{ color: 'var(--app-primary)', fontSize: '0.5rem' }}>● FISCAL</span></label>
              <div style={{ position: 'relative' }}>
                <Shield size={15} style={iconCls} />
                <select name="taxProfileId" className={fieldCls} style={{ appearance: 'none' }} defaultValue={contact?.tax_profile_id || contact?.tax_profile || ''}>
                  <option value="">— Auto-detect (legacy fallback) —</option>
                  {taxProfiles.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_system_preset ? ' ★' : ''}
                      {p.vat_registered ? ' · VAT' : ''}
                      {p.reverse_charge ? ' · RC' : ''}
                      {p.airsi_subject ? ' · AIRSI' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {taxProfiles.length === 0 && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.625rem', fontWeight: 600, color: 'var(--app-warning, #f59e0b)' }}>
                  No profiles configured — create them in Finance → Counterparty Tax Profiles
                </p>
              )}
            </div>

            {/* Address (full width) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className={labelCls}>Address</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={15} style={{ ...iconCls, top: '1rem', transform: 'none' }} />
                <textarea name="address" rows={2} className={fieldCls} style={{ resize: 'none', paddingTop: '0.75rem' }} placeholder="Street address, city, state, zip" defaultValue={contact?.address || ''} />
              </div>
            </div>

            {/* Notes (full width) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className={labelCls}>Notes</label>
              <div style={{ position: 'relative' }}>
                <FileText size={15} style={{ ...iconCls, top: '1rem', transform: 'none' }} />
                <textarea name="notes" rows={3} className={fieldCls} style={{ resize: 'none', paddingTop: '0.75rem' }} placeholder="Internal notes about this contact..." defaultValue={contact?.notes || ''} />
              </div>
            </div>
          </div>

          {/* ── Ledger Note ── */}
          {!isEdit && (
            <div style={{
              marginTop: '1.25rem', padding: '0.875rem 1rem', borderRadius: 'var(--app-radius-sm)',
              background: 'var(--app-primary-light)', border: '1px dashed var(--app-primary)',
              display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
            }}>
              <CreditCard size={16} style={{ color: 'var(--app-primary)', flexShrink: 0, marginTop: '0.125rem' }} />
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--app-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Autonomous Ledger Automation
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  Creating this contact will automatically propagate a sub-account in the General Ledger for accurate balance tracking.
                </p>
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div style={{
            marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--app-border)',
            display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
          }}>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isPending}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: 'var(--app-radius-sm)',
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                background: 'var(--app-surface)', color: 'var(--app-text-muted)',
                border: '1px solid var(--app-border)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '0.5rem 1.5rem', borderRadius: 'var(--app-radius-sm)',
                fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
                background: 'var(--app-primary)', color: '#fff',
                border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? (
                <>
                  <div style={{
                    width: '0.875rem', height: '0.875rem', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  {isEdit ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  {isEdit ? <Save size={14} /> : <Plus size={14} />}
                  {isEdit ? 'Save Changes' : `Create ${typeLabel}`}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
