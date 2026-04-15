"""
Seed Country Tax Templates
===========================
Populates the country_tax_template table with defaults for key countries.
Idempotent — safe to run multiple times (uses update_or_create on country_code).

Architecture:
  - org_policy_defaults: Array of named policy presets, each with its own
    required_documents list (documents the ORG must provide for this regime)
  - counterparty_presets: Array of named profile types, each with its own
    required_documents list (documents a COUNTERPARTY must provide for this profile)
  - document_requirements: Kept as country-level UNIVERSAL documents that
    apply regardless of policy or profile type

Usage:
    python manage.py seed_country_tax_templates
"""
from django.core.management.base import BaseCommand
from apps.finance.models.country_tax_template import CountryTaxTemplate


# ── Shared helpers ──────────────────────────────────────────
def _doc(doc_type, label, required=True, renewable=False, renewal_months=None):
    return {'type': doc_type, 'label': label, 'required': required, 'renewable': renewable, 'renewal_months': renewal_months}

def _policy(name, required_documents=None, **overrides):
    """Build an org policy preset with sensible defaults + overrides.
    
    Cost valuation determines how inventory cost is presented:
      - COST_EFFECTIVE (default): HT if VAT recoverable, TTC if capitalized.
        Standard accounting — VAT is transparent (pass-through).
      - FORCE_TTC: Always TTC. VAT recovery is posted as a gain.
        Cash-flow focused — input VAT absorbed into cost, recovery = profit line.
    
    In both modes, the NET VAT payment to the State is identical:
      TVA collectée (output) − TVA déductible (input) = net due.
    Only the P&L presentation of the 'recovered' input VAT differs.
    """
    base = {
        'name': name,
        'vat_output_enabled': True,
        'vat_input_recoverability': '1.000',
        'official_vat_treatment': 'RECOVERABLE',
        'internal_vat_treatment': 'CAPITALIZE',
        'purchase_tax_rate': '0.0000',
        'purchase_tax_mode': 'RECOVERABLE',
        'sales_tax_rate': '0.0000',
        'sales_tax_trigger': 'ON_TURNOVER',
        'periodic_amount': '0.00',
        'periodic_interval': 'ANNUAL',
        'profit_tax_mode': 'STANDARD',
        'cost_valuation': 'COST_EFFECTIVE',
        'internal_sales_vat_mode': 'NONE',
        'allowed_scopes': ['OFFICIAL', 'INTERNAL'],
        'required_documents': required_documents or [],
    }
    base.update(overrides)
    return base

def _profile(name, vat_registered=False, reverse_charge=False, required_documents=None):
    return {
        'name': name,
        'vat_registered': vat_registered,
        'reverse_charge': reverse_charge,
        'required_documents': required_documents or [],
    }

def _custom_tax(name, rate, **overrides):
    """Build a custom tax rule preset."""
    base = {
        'name': name,
        'rate': str(rate),
        'transaction_type': 'BOTH',
        'math_behavior': 'ADDED_TO_TTC',
        'purchase_cost_treatment': 'EXPENSE',
        'tax_base_mode': 'HT',
        'base_tax_type': '',
        'calculation_order': 100,
        'compound_group': '',
        'is_active': True,
    }
    base.update(overrides)
    return base

def _tax_group(name, rate, is_default=False, description=''):
    """Build a TaxGroup preset entry."""
    return {'name': name, 'rate': str(rate), 'is_default': is_default, 'description': description}


TEMPLATES = [
    # ═══════════════════════════════════════════════════════════════════
    # Côte d'Ivoire (OHADA / SYSCOHADA)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'CI',
        'country_name': "Côte d'Ivoire (OHADA)",
        'currency_code': 'XOF',
        # Universal docs — every entity in CI needs these
        'document_requirements': [
            _doc('TAX_ID', 'NCC — Numéro Compte Contribuable'),
            _doc('BIZ_REG', 'RCCM — Registre du Commerce', renewable=True, renewal_months=12),
            _doc('TAX_DECLARATION', "DFE — Déclaration Fiscale d'Existence"),
        ],
        'org_policy_defaults': [
            _policy('Régime Normal (Assujetti TVA)',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='CAPITALIZE', profit_tax_mode='STANDARD',
                    cost_valuation='FORCE_TTC',
                    required_documents=[
                        _doc('VAT_CERT', 'Attestation TVA', renewable=True, renewal_months=12),
                        _doc('TAX_CLEARANCE', 'Attestation de Régularité Fiscale', required=False, renewable=True, renewal_months=12),
                    ]),
            _policy('Régime Simplifié (RSI)',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='FORFAIT',
                    periodic_amount='500000.00', periodic_interval='ANNUAL',
                    cost_valuation='FORCE_TTC',
                    required_documents=[
                        _doc('VAT_CERT', 'Attestation TVA (RSI)', renewable=True, renewal_months=12),
                    ]),
            _policy('Micro-Entreprise (Forfait)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='CAPITALIZE', profit_tax_mode='FORFAIT',
                    periodic_amount='200000.00', periodic_interval='ANNUAL',
                    allowed_scopes=['OFFICIAL']),
            _policy('Zone Franche (Exonéré)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='EXEMPT',
                    allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('CUSTOM', 'Agrément Zone Franche'),
                    ]),
        ],
        'counterparty_presets': [
            _profile('Assujetti TVA', vat_registered=True, required_documents=[
                _doc('VAT_CERT', 'Attestation TVA du fournisseur/client'),
                _doc('TAX_CLEARANCE', 'Attestation de Régularité Fiscale', required=False, renewable=True, renewal_months=12),
            ]),
            _profile('Non-Assujetti', required_documents=[
                _doc('TAX_ID', 'NCC du fournisseur/client'),
            ]),
            _profile('Foreign B2B (Reverse Charge)', reverse_charge=True, required_documents=[
                _doc('CUSTOM', "Certificat d'immatriculation étranger"),
            ]),
            _profile('Export Client (Exonéré)', required_documents=[
                _doc('CUSTOM', 'Bon de commande export'),
                _doc('CUSTOM', "Certificat d'exonération TVA export", required=False),
            ]),
            _profile('Client Particulier'),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('AIRSI (Acompte IS sur prestations)', '0.0750',
                        transaction_type='PURCHASE', math_behavior='WITHHELD_FROM_AP',
                        calculation_order=20),
            _custom_tax('Taxe sur la Publicité', '0.03',
                        transaction_type='SALE', math_behavior='ADDED_TO_TTC',
                        calculation_order=110),
            _custom_tax('Prélèvement Forfaitaire Libératoire (PFL)', '0.12',
                        transaction_type='PURCHASE', math_behavior='WITHHELD_FROM_AP',
                        calculation_order=120),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # France
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'FR',
        'country_name': 'France',
        'currency_code': 'EUR',
        'document_requirements': [
            _doc('TAX_ID', 'SIRET / SIREN'),
            _doc('BANK_DETAILS', 'RIB / IBAN'),
        ],
        'org_policy_defaults': [
            _policy('Régime Normal (TVA Classique)',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('VAT_CERT', 'Numéro TVA Intracommunautaire'),
                        _doc('BIZ_REG', 'Extrait Kbis', renewable=True, renewal_months=3),
                        _doc('INSURANCE', 'Attestation RC Pro', required=False, renewable=True, renewal_months=12),
                    ]),
            _policy("Régime Simplifié d'Imposition (RSI)",
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    periodic_interval='ANNUAL',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('VAT_CERT', 'Numéro TVA Intracommunautaire'),
                    ]),
            _policy('Micro-Entreprise (Franchise TVA)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='FORFAIT',
                    allowed_scopes=['OFFICIAL']),
            _policy('Auto-Entrepreneur',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='FORFAIT',
                    periodic_amount='0.00', periodic_interval='MONTHLY',
                    allowed_scopes=['OFFICIAL']),
        ],
        'counterparty_presets': [
            _profile('Assujetti TVA (EU)', vat_registered=True, required_documents=[
                _doc('VAT_CERT', 'Numéro TVA Intracommunautaire'),
                _doc('BIZ_REG', 'Extrait Kbis', required=False, renewable=True, renewal_months=3),
            ]),
            _profile('Non-Assujetti (Micro-Entreprise)', required_documents=[
                _doc('TAX_ID', 'SIRET du fournisseur'),
            ]),
            _profile('Intracommunautaire (Reverse Charge)', vat_registered=True, reverse_charge=True, required_documents=[
                _doc('VAT_CERT', 'VAT Number (EU validation via VIES)'),
            ]),
            _profile('Client Export (Hors EU)', required_documents=[
                _doc('CUSTOM', 'Justificatif export / DAU'),
            ]),
            _profile('Client Particulier (B2C)'),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('Taxe sur les Bureaux (IDF)', '0.0195',
                        transaction_type='SALE', math_behavior='ADDED_TO_TTC',
                        calculation_order=110),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # United States
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'US',
        'country_name': 'United States',
        'currency_code': 'USD',
        'document_requirements': [
            _doc('TAX_ID', 'EIN — Employer Identification Number'),
            _doc('BANK_DETAILS', 'ACH / Wire Details'),
        ],
        'org_policy_defaults': [
            _policy('Standard (C-Corp / LLC)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('BIZ_REG', 'State Business Registration', required=False, renewable=True, renewal_months=12),
                        _doc('INSURANCE', 'Certificate of Insurance (COI)', required=False, renewable=True, renewal_months=12),
                    ]),
            _policy('S-Corporation (Pass-Through)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL']),
            _policy('Tax-Exempt Organization (501c3)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='EXEMPT',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('CUSTOM', 'IRS Determination Letter (501c3)'),
                    ]),
            _policy('Sales Tax Nexus (Retail)',
                    vat_output_enabled=True, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE',
                    sales_tax_rate='0.0000', sales_tax_trigger='ON_TURNOVER',
                    profit_tax_mode='STANDARD',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('CUSTOM', 'Sales Tax Permit / Resale Certificate'),
                    ]),
        ],
        'counterparty_presets': [
            _profile('Domestic Vendor (W-9)', required_documents=[
                _doc('TAX_DECLARATION', 'W-9 Form', renewable=True, renewal_months=12),
            ]),
            _profile('Domestic Customer (Tax Exempt)', required_documents=[
                _doc('CUSTOM', 'Sales Tax Exemption Certificate'),
            ]),
            _profile('Domestic Customer (Taxable)'),
            _profile('Foreign Vendor (W-8)', required_documents=[
                _doc('TAX_DECLARATION', 'W-8BEN / W-8BEN-E'),
            ]),
            _profile('Foreign Customer (Export)'),
        ],
        'custom_tax_rule_presets': [],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Lebanon
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'LB',
        'country_name': 'Lebanon',
        'currency_code': 'LBP',
        'document_requirements': [
            _doc('TAX_ID', 'Tax Registration Number (رقم السجل الضريبي)'),
            _doc('BIZ_REG', 'Commercial Register (السجل التجاري)'),
        ],
        'org_policy_defaults': [
            _policy('Régime Réel (TVA Standard)',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    cost_valuation='FORCE_TTC', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('VAT_CERT', 'VAT Registration Certificate'),
                        _doc('TAX_CLEARANCE', 'MOF Tax Clearance (إبراء ذمة)', required=False, renewable=True, renewal_months=12),
                    ]),
            _policy('Régime Forfaitaire',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='FORFAIT',
                    periodic_amount='0.00', periodic_interval='ANNUAL',
                    allowed_scopes=['OFFICIAL']),
            _policy('Exonéré TVA (Small Business)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    allowed_scopes=['OFFICIAL']),
        ],
        'counterparty_presets': [
            _profile('TVA Registered', vat_registered=True, required_documents=[
                _doc('VAT_CERT', 'VAT Registration Certificate'),
            ]),
            _profile('Non-TVA (Small Business)', required_documents=[
                _doc('TAX_ID', 'Tax Registration Number'),
            ]),
            _profile('Customer — Individual'),
            _profile('Foreign Supplier', reverse_charge=True, required_documents=[
                _doc('CUSTOM', 'Foreign Business Registration'),
            ]),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('Timbre Fiscal (Revenue Stamp)', '0.003',
                        transaction_type='SALE', math_behavior='ADDED_TO_TTC',
                        calculation_order=110),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # UAE
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'AE',
        'country_name': 'United Arab Emirates',
        'currency_code': 'AED',
        'document_requirements': [
            _doc('TAX_ID', 'TRN — Tax Registration Number'),
            _doc('BIZ_REG', 'Trade License', renewable=True, renewal_months=12),
        ],
        'org_policy_defaults': [
            _policy('Standard VAT (5%)',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='EXEMPT',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('VAT_CERT', 'VAT Registration Certificate (FTA)'),
                    ]),
            _policy('Designated Free Zone (0%)',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='EXEMPT',
                    allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('VAT_CERT', 'VAT Registration Certificate (FTA)'),
                        _doc('CUSTOM', 'Free Zone License'),
                    ]),
            _policy('VAT Exempt (Below Threshold)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='EXEMPT',
                    allowed_scopes=['OFFICIAL']),
        ],
        'counterparty_presets': [
            _profile('VAT Registered (5%)', vat_registered=True, required_documents=[
                _doc('VAT_CERT', 'VAT Registration Certificate'),
            ]),
            _profile('Designated Zone (0%)', vat_registered=True, required_documents=[
                _doc('CUSTOM', 'Designated Zone Certificate'),
            ]),
            _profile('Non-VAT Registered', required_documents=[
                _doc('ID_PROOF', 'Emirates ID / Passport Copy', required=False),
            ]),
            _profile('Customer — Individual'),
            _profile('Foreign Supplier (Reverse Charge)', reverse_charge=True, required_documents=[
                _doc('CUSTOM', 'Foreign Business Registration'),
            ]),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('Tourism Dirham Fee', '0.0000',
                        transaction_type='SALE', math_behavior='ADDED_TO_TTC',
                        calculation_order=110,
                        purchase_cost_treatment='EXPENSE'),
            _custom_tax('Corporate Tax (9%)', '0.09',
                        transaction_type='BOTH', math_behavior='ADDED_TO_TTC',
                        calculation_order=200,
                        purchase_cost_treatment='EXPENSE'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Saudi Arabia
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'SA',
        'country_name': 'Saudi Arabia',
        'currency_code': 'SAR',
        'document_requirements': [
            _doc('TAX_ID', 'CR — Commercial Registration (سجل تجاري)', renewable=True, renewal_months=12),
            _doc('BANK_DETAILS', 'IBAN Verification'),
        ],
        'org_policy_defaults': [
            _policy('Standard VAT (15%)',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('VAT_CERT', 'ZATCA VAT Certificate'),
                        _doc('TAX_CLEARANCE', 'Zakat Certificate (شهادة زكاة)', renewable=True, renewal_months=12),
                    ]),
            _policy('Zakat-Only Entity',
                    vat_output_enabled=True, official_vat_treatment='RECOVERABLE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='FORFAIT',
                    periodic_interval='ANNUAL',
                    cost_valuation='COST_EFFECTIVE', allowed_scopes=['OFFICIAL'],
                    required_documents=[
                        _doc('TAX_CLEARANCE', 'Zakat Certificate (شهادة زكاة)', renewable=True, renewal_months=12),
                    ]),
            _policy('VAT Exempt (Below Threshold)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    official_vat_treatment='CAPITALIZE',
                    purchase_tax_mode='EXPENSE', profit_tax_mode='STANDARD',
                    allowed_scopes=['OFFICIAL']),
        ],
        'counterparty_presets': [
            _profile('VAT Registered (15%)', vat_registered=True, required_documents=[
                _doc('VAT_CERT', 'ZATCA VAT Certificate'),
            ]),
            _profile('Non-VAT (Below Threshold)', required_documents=[
                _doc('TAX_ID', 'Commercial Registration'),
            ]),
            _profile('GCC Counterparty (Reverse Charge)', vat_registered=True, reverse_charge=True, required_documents=[
                _doc('CUSTOM', 'GCC VAT Registration Proof'),
            ]),
            _profile('Customer — Individual'),
            _profile('Foreign Vendor', reverse_charge=True, required_documents=[
                _doc('CUSTOM', 'Foreign Business Registration'),
            ]),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('Zakat (2.5% Islamic Levy)', '0.025',
                        transaction_type='BOTH', math_behavior='ADDED_TO_TTC',
                        calculation_order=200,
                        purchase_cost_treatment='EXPENSE'),
        ],
        'tax_group_presets': [
            _tax_group('VAT 5% (GCC)', '0.0500', is_default=True, description='Standard GCC VAT rate'),
            _tax_group('VAT 0% (Zero-Rated)', '0.0000', description='Exports and zero-rated supplies'),
            _tax_group('VAT Exempt', '0.0000', description='Exempt from VAT'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Morocco (OHADA+ / PCG Marocain)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'MA',
        'country_name': 'Morocco',
        'currency_code': 'MAD',
        'document_requirements': [
            _doc('TAX_ID', 'ICE — Identifiant Commun de l\'Entreprise'),
            _doc('BIZ_REG', 'RC — Registre du Commerce'),
            _doc('TAX_DECLARATION', 'Attestation du Régime Fiscal'),
        ],
        'org_policy_defaults': [
            _policy('Assujetti TVA — Régime Normal',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', internal_cost_mode='SAME_AS_OFFICIAL',
                    profit_tax_mode='STANDARD'),
            _policy('Exonéré de TVA',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    airsi_treatment='CAPITALIZE', internal_cost_mode='TTC_ALWAYS',
                    profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Assujetti TVA', vat_registered=True),
            _profile('Non Assujetti TVA', vat_registered=False),
            _profile('Fournisseur Étranger', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('TVA 20%', '0.2000', is_default=True, description='Taux normal TVA Maroc'),
            _tax_group('TVA 14%', '0.1400', description='Taux réduit — eau, électricité, transport'),
            _tax_group('TVA 10%', '0.1000', description='Taux réduit — restauration, opérations bancaires'),
            _tax_group('TVA 7%', '0.0700', description='Taux réduit — eau potable, médicaments'),
            _tax_group('TVA 0%', '0.0000', description='Exonéré ou taux zéro'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Senegal (OHADA / SYSCOHADA — similar to Côte d'Ivoire)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'SN',
        'country_name': 'Senegal',
        'currency_code': 'XOF',
        'document_requirements': [
            _doc('TAX_ID', 'NINEA — Numéro d\'Identification National des Entreprises et Associations'),
            _doc('BIZ_REG', 'RCCM — Registre du Commerce et du Crédit Mobilier'),
        ],
        'org_policy_defaults': [
            _policy('Assujetti TVA — Réel Normal',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', internal_cost_mode='SAME_AS_OFFICIAL',
                    profit_tax_mode='STANDARD'),
            _policy('Régime du Réel Simplifié',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='CAPITALIZE', profit_tax_mode='STANDARD'),
            _policy('Non Assujetti / Exonéré',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    airsi_treatment='CAPITALIZE', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Assujetti TVA', vat_registered=True),
            _profile('Non Assujetti', vat_registered=False),
            _profile('Fournisseur Étranger', reverse_charge=True),
            _profile('Client Export', vat_registered=False),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('COSEC — Accise Importation', '0.010',
                        transaction_type='BOTH', calculation_order=150),
        ],
        'tax_group_presets': [
            _tax_group('TVA 18%', '0.1800', is_default=True, description='Taux standard TVA Sénégal'),
            _tax_group('TVA 0%', '0.0000', description='Exportations et opérations exonérées'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Nigeria (FIRS — Federal Inland Revenue Service)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'NG',
        'country_name': 'Nigeria',
        'currency_code': 'NGN',
        'document_requirements': [
            _doc('TAX_ID', 'TIN — Tax Identification Number'),
            _doc('BIZ_REG', 'CAC — Corporate Affairs Commission Registration'),
            _doc('COMPLIANCE', 'FIRS VAT Registration Certificate'),
        ],
        'org_policy_defaults': [
            _policy('VAT Registered — Standard',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', profit_tax_mode='STANDARD'),
            _policy('VAT Exempt / Small Business',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('VAT Registered Business', vat_registered=True),
            _profile('Individual / Non-VAT Business', vat_registered=False),
            _profile('Foreign Vendor (Reverse Charge)', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('WHT — Withholding Tax (5% Goods)', '0.050',
                        transaction_type='BOTH', calculation_order=200,
                        math_behavior='DEDUCTED_FROM_PAYMENT'),
            _custom_tax('WHT — Withholding Tax (10% Services)', '0.100',
                        transaction_type='BOTH', calculation_order=210,
                        math_behavior='DEDUCTED_FROM_PAYMENT'),
        ],
        'tax_group_presets': [
            _tax_group('VAT 7.5%', '0.0750', is_default=True, description='Standard Nigeria VAT rate (VATA 2019)'),
            _tax_group('VAT 0% (Zero-Rated)', '0.0000', description='Exported goods and services'),
            _tax_group('VAT Exempt', '0.0000', description='Basic food, education, healthcare'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Egypt (Egyptian Tax Authority — ETA)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'EG',
        'country_name': 'Egypt',
        'currency_code': 'EGP',
        'document_requirements': [
            _doc('TAX_ID', 'Tax Registration Number (TRN)'),
            _doc('BIZ_REG', 'Commercial Registration — Ministry of Trade'),
            _doc('COMPLIANCE', 'ETA E-Invoice Registration'),
        ],
        'org_policy_defaults': [
            _policy('VAT Registered — Standard',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', profit_tax_mode='STANDARD'),
            _policy('Special Rate / Exempt',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    profit_tax_mode='STANDARD'),
        ],
        'counterparty_presets': [
            _profile('VAT Registered', vat_registered=True),
            _profile('Individual Consumer', vat_registered=False),
            _profile('Foreign Supplier', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('WHT — Withholding on Services (10%)', '0.100',
                        transaction_type='BOTH', calculation_order=200),
        ],
        'tax_group_presets': [
            _tax_group('VAT 14%', '0.1400', is_default=True, description='Standard Egypt VAT rate'),
            _tax_group('VAT 5%', '0.0500', description='Reduced rate — selected goods'),
            _tax_group('VAT 0%', '0.0000', description='Exports and zero-rated'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Germany (EU / UStG)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'DE',
        'country_name': 'Germany',
        'currency_code': 'EUR',
        'document_requirements': [
            _doc('TAX_ID', 'Steuernummer / USt-IdNr (VAT ID)'),
            _doc('BIZ_REG', 'Handelsregister (Commercial Register)'),
        ],
        'org_policy_defaults': [
            _policy('Regelbesteuerung (Full VAT)',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', profit_tax_mode='STANDARD'),
            _policy('Kleinunternehmer (§ 19 UStG)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    profit_tax_mode='EXEMPT',
                    sales_tax_rate='0.0000', sales_tax_trigger='ON_TURNOVER'),
        ],
        'counterparty_presets': [
            _profile('VAT-Registered Business (EU)', vat_registered=True),
            _profile('Private Consumer', vat_registered=False),
            _profile('EU B2B (Reverse Charge)', vat_registered=True, reverse_charge=True),
            _profile('Non-EU Supplier (Reverse Charge)', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('MwSt 19%', '0.1900', is_default=True, description='Regelsteuersatz — standard VAT rate'),
            _tax_group('MwSt 7%', '0.0700', description='Ermäßigter Steuersatz — food, books, culture'),
            _tax_group('MwSt 0%', '0.0000', description='Steuerfreie Umsätze / exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # United Kingdom (HMRC / Making Tax Digital)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'GB',
        'country_name': 'United Kingdom',
        'currency_code': 'GBP',
        'document_requirements': [
            _doc('TAX_ID', 'VAT Registration Number (VRN)'),
            _doc('BIZ_REG', 'Companies House Registration Number'),
            _doc('COMPLIANCE', 'HMRC MTD Enrolment'),
        ],
        'org_policy_defaults': [
            _policy('VAT Registered — Standard Rate',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', profit_tax_mode='STANDARD'),
            _policy('VAT Registered — Flat Rate Scheme',
                    vat_output_enabled=True, vat_input_recoverability='0.000',
                    profit_tax_mode='STANDARD',
                    sales_tax_rate='0.1250', sales_tax_trigger='ON_TURNOVER'),
            _policy('VAT Exempt / Below Threshold',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('VAT-Registered Business', vat_registered=True),
            _profile('Consumer / Non-VAT Business', vat_registered=False),
            _profile('EU Business (Post-Brexit Reverse Charge)', reverse_charge=True),
            _profile('Non-UK Supplier', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('VAT 20%', '0.2000', is_default=True, description='Standard UK VAT rate'),
            _tax_group('VAT 5%', '0.0500', description='Reduced rate — energy, children car seats, etc.'),
            _tax_group('VAT 0%', '0.0000', description='Zero-rated — food, books, children clothing, exports'),
            _tax_group('VAT Exempt', '0.0000', description='Exempt — insurance, finance, education, healthcare'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # India (GST — Goods & Services Tax)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'IN',
        'country_name': 'India',
        'currency_code': 'INR',
        'document_requirements': [
            _doc('TAX_ID', 'GSTIN — GST Identification Number'),
            _doc('BIZ_REG', 'Certificate of Incorporation (MCA)'),
            _doc('COMPLIANCE', 'GST Registration Certificate'),
        ],
        'org_policy_defaults': [
            _policy('Regular GST — Full ITC',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', profit_tax_mode='STANDARD'),
            _policy('Composition Scheme (Turnover-Based)',
                    vat_output_enabled=True, vat_input_recoverability='0.000',
                    profit_tax_mode='FORFAIT',
                    sales_tax_rate='0.0100', sales_tax_trigger='ON_TURNOVER'),
        ],
        'counterparty_presets': [
            _profile('GSTIN Registered Business', vat_registered=True),
            _profile('Unregistered Consumer (B2C)', vat_registered=False),
            _profile('Foreign Vendor (RCM)', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('CGST (Split 50%)', '0.0000',
                        description='CGST component — set rate as half of applicable GST slab',
                        is_active=False),
            _custom_tax('SGST (Split 50%)', '0.0000',
                        description='SGST component — set rate as half of applicable GST slab',
                        is_active=False),
        ],
        'tax_group_presets': [
            _tax_group('GST 18%', '0.1800', is_default=True, description='Standard slab — most goods & services'),
            _tax_group('GST 12%', '0.1200', description='Reduced — processed food, computers, textiles'),
            _tax_group('GST 5%', '0.0500', description='Essential goods — common man items'),
            _tax_group('GST 0%', '0.0000', description='Exempt — unprocessed food, education, health'),
            _tax_group('GST 28%', '0.2800', description='Luxury goods, tobacco, automobiles'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Canada (CRA — Canada Revenue Agency)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'CA',
        'country_name': 'Canada',
        'currency_code': 'CAD',
        'document_requirements': [
            _doc('TAX_ID', 'Business Number (BN) — CRA'),
            _doc('COMPLIANCE', 'GST/HST Registration Number'),
        ],
        'org_policy_defaults': [
            _policy('GST/HST Registrant — Full ITC',
                    vat_output_enabled=True, vat_input_recoverability='1.000',
                    airsi_treatment='RECOVER', profit_tax_mode='STANDARD'),
            _policy('Small Supplier (No GST/HST)',
                    vat_output_enabled=False, vat_input_recoverability='0.000',
                    profit_tax_mode='STANDARD'),
        ],
        'counterparty_presets': [
            _profile('GST/HST Registered Business', vat_registered=True),
            _profile('Consumer / Non-Registrant', vat_registered=False),
            _profile('Foreign Vendor', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('PST — Provincial Sales Tax (note: varies by province)', '0.0000',
                        is_active=False,
                        description='Manually configure PST rate per province: QC=9.975%, ON=0% HST combined, BC=7%, SK=6%, MB=7%'),
        ],
        'tax_group_presets': [
            _tax_group('GST 5%', '0.0500', is_default=True, description='Federal Goods & Services Tax'),
            _tax_group('HST 13% (Ontario)', '0.1300', description='Harmonized HST — Ontario'),
            _tax_group('HST 15% (Atlantic)', '0.1500', description='Harmonized HST — NS, NB, NL, PEI'),
            _tax_group('GST 0% (Zero-Rated)', '0.0000', description='Basic groceries, prescription drugs, exports'),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed country tax templates (idempotent)'

    def handle(self, *args, **options):
        created, updated = 0, 0
        for tpl in TEMPLATES:
            obj, is_new = CountryTaxTemplate.objects.update_or_create(
                country_code=tpl['country_code'],
                defaults={
                    'country_name': tpl['country_name'],
                    'currency_code': tpl['currency_code'],
                    'org_policy_defaults': tpl['org_policy_defaults'],
                    'document_requirements': tpl['document_requirements'],
                    'counterparty_presets': tpl['counterparty_presets'],
                    'custom_tax_rule_presets': tpl.get('custom_tax_rule_presets', []),
                    'tax_group_presets': tpl.get('tax_group_presets', []),
                    'is_active': True,
                }
            )
            pol_count = len(tpl['org_policy_defaults'])
            profile_count = len(tpl['counterparty_presets'])
            tg_count = len(tpl.get('tax_group_presets', []))
            if is_new:
                created += 1
                self.stdout.write(self.style.SUCCESS(
                    f'  ✅ Created: {obj} ({pol_count} policies, {profile_count} profiles, {tg_count} tax groups)'
                ))
            else:
                updated += 1
                self.stdout.write(
                    f'  ♻️  Updated: {obj} ({pol_count} policies, {profile_count} profiles, {tg_count} tax groups)'
                )

        self.stdout.write(self.style.SUCCESS(
            f'\n🌍 Country Tax Templates: {created} created, {updated} updated ({len(TEMPLATES)} total)'
        ))
