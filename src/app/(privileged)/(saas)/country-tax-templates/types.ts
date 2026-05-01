export type DocReq = { type: string; label: string; required: boolean; renewable: boolean; renewal_months: number | null; condition?: string }

export type TaxDef = {
  id: string; name: string; category: 'ESSENTIAL' | 'CUSTOM'
  tax_type: string; rate: string; applies_to: string
  math_behavior: string; cost_treatment: string
  coa_hint: string; documents: DocReq[]; description: string
}

export type TaxTreatment = 'APPLIED' | 'EXEMPT' | 'REDUCED' | 'NOT_APPLICABLE'

export type OrgPreset = {
  name: string; tax_ids: string[]; rate_overrides: Record<string, string>
  tax_treatments: Record<string, TaxTreatment>
  vat_output_enabled: boolean; vat_input_recoverability: string
  official_vat_treatment: string; internal_vat_treatment: string
  cost_valuation: string; periodic_interval: string
  allowed_scopes: string[]; required_documents: DocReq[]
}

export type CounterpartyPreset = {
  name: string; vat_registered: boolean; reverse_charge: boolean
  tax_ids: string[]; tax_treatments: Record<string, TaxTreatment>; required_documents: DocReq[]
}

export type Template = {
  id: number; country_code: string; country_name: string; currency_code: string
  org_policy_defaults: OrgPreset | OrgPreset[] | Record<string, unknown>; document_requirements: DocReq[]
  counterparty_presets: CounterpartyPreset[]; custom_tax_rule_presets?: TaxDef[]
  tax_catalog?: TaxDef[]
  is_active: boolean; created_at: string; updated_at: string
  bad_debt_recovery_months?: number; self_supply_vat_threshold?: number | string | null
  gift_vat_threshold?: number | string | null; vat_on_advance_payment?: boolean
}

export const DOC_TYPES = ['TAX_ID','BIZ_REG','VAT_CERT','TAX_CLEARANCE','TAX_DECLARATION','INSURANCE','IMPORT_LICENSE','EXPORT_LICENSE','PHYTO','BANK_DETAILS','ID_PROOF','ADDRESS_PROOF','CUSTOM']

export const TAX_TYPE_OPTIONS = [
  { value: 'VAT', label: 'VAT / TVA' },
  { value: 'PURCHASE_TAX', label: 'Purchase Tax' },
  { value: 'PROFIT_TAX', label: 'Profit Tax' },
  { value: 'WITHHOLDING', label: 'Withholding (AIRSI/WHT)' },
  { value: 'EXCISE', label: 'Excise / Stamp' },
  { value: 'CUSTOM', label: 'Custom Tax' },
]

let _ctr = 0
export function genId() { return `tax_${Date.now()}_${++_ctr}` }

/** Convert legacy flat data into pipeline structure */
export function migrateFromLegacy(form: Record<string, unknown>): { catalog: TaxDef[]; orgPresets: OrgPreset[]; cpPresets: CounterpartyPreset[] } {
  // The legacy migration tolerates loose shapes; cast to any locally so the
  // shape-probing reads (`form.tax_catalog?.length`, etc.) don't require a
  // hundred narrow type guards.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f: any = form
  // If already migrated
  if (f.tax_catalog?.length) {
    const orgP = Array.isArray(f.org_policy_defaults) ? f.org_policy_defaults : []
    const cpP = Array.isArray(f.counterparty_presets) ? f.counterparty_presets : []
    return { catalog: f.tax_catalog, orgPresets: orgP, cpPresets: cpP }
  }

  const catalog: TaxDef[] = []
  // Migrate custom_tax_rule_presets
  const customTaxes = f.custom_tax_rule_presets || []
  for (const ct of customTaxes) {
    if (ct.id && ct.category) { catalog.push(ct); continue } // already new format
    catalog.push({
      id: genId(), name: ct.name || 'Custom Tax', category: 'CUSTOM',
      tax_type: 'CUSTOM', rate: ct.rate || '0.00',
      applies_to: ct.transaction_type || 'BOTH',
      math_behavior: ct.math_behavior || 'ADDED_TO_TTC',
      cost_treatment: ct.purchase_cost_treatment || 'EXPENSE',
      coa_hint: '', documents: [], description: ct.description || '',
    })
  }

  // Migrate org_policy_defaults (keep as-is but convert to OrgPreset shape)
  const rawPresets = Array.isArray(f.org_policy_defaults) ? f.org_policy_defaults
    : (f.org_policy_defaults && typeof f.org_policy_defaults === 'object' ? [f.org_policy_defaults] : [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgPresets: OrgPreset[] = rawPresets.map((p: any) => ({
    name: p.name || 'Preset', tax_ids: p.tax_ids || [], rate_overrides: p.rate_overrides || {},
    tax_treatments: p.tax_treatments || {},
    vat_output_enabled: p.vat_output_enabled ?? true,
    vat_input_recoverability: p.vat_input_recoverability || '1.000',
    official_vat_treatment: p.official_vat_treatment || 'RECOVERABLE',
    internal_vat_treatment: p.internal_vat_treatment || 'CAPITALIZE',
    cost_valuation: p.cost_valuation || 'COST_EFFECTIVE',
    periodic_interval: p.periodic_interval || 'ANNUAL',
    allowed_scopes: p.allowed_scopes || ['OFFICIAL', 'INTERNAL'],
    required_documents: p.required_documents || [],
  }))

  // Migrate counterparty_presets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cpPresets: CounterpartyPreset[] = (f.counterparty_presets || []).map((p: any) => ({
    name: p.name || '', vat_registered: p.vat_registered ?? false,
    reverse_charge: p.reverse_charge ?? false, tax_ids: p.tax_ids || [],
    tax_treatments: p.tax_treatments || {},
    required_documents: p.required_documents || [],
  }))

  return { catalog, orgPresets, cpPresets }
}
