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

    # ═══════════════════════════════════════════════════════════════════
    # Italy (Agenzia delle Entrate / SDI e-invoicing)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'IT',
        'country_name': 'Italy',
        'currency_code': 'EUR',
        'document_requirements': [
            _doc('TAX_ID', 'Partita IVA (VAT Number)'),
            _doc('TAX_ID', 'Codice Fiscale'),
            _doc('COMPLIANCE', 'SDI Destination Code / PEC'),
        ],
        'org_policy_defaults': [
            _policy('Regime Ordinario (Standard VAT)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Regime Forfettario (Flat-rate Scheme)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT',
                    sales_tax_rate='0.0500', sales_tax_trigger='ON_TURNOVER'),
        ],
        'counterparty_presets': [
            _profile('Italian Business (B2B)', vat_registered=True),
            _profile('Italian Consumer (B2C)', vat_registered=False),
            _profile('EU Business (Reverse Charge)', vat_registered=True, reverse_charge=True),
            _profile('Public Administration (B2G / SDI)', vat_registered=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('IVA 22%', '0.2200', is_default=True, description='Aliquota ordinaria — standard rate'),
            _tax_group('IVA 10%', '0.1000', description='Aliquota ridotta — food, tourism'),
            _tax_group('IVA 5%', '0.0500', description='Aliquota super-ridotta — social services'),
            _tax_group('IVA 4%', '0.0400', description='Aliquota minima — staples, books'),
            _tax_group('IVA 0%', '0.0000', description='Operazioni esenti / exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Spain (AEAT / Sistema Inmediato Información — SII)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'ES',
        'country_name': 'Spain',
        'currency_code': 'EUR',
        'document_requirements': [
            _doc('TAX_ID', 'NIF / CIF (Tax ID)'),
            _doc('BIZ_REG', 'Registro Mercantil'),
            _doc('COMPLIANCE', 'SII enrolment (if turnover > €6M)'),
        ],
        'org_policy_defaults': [
            _policy('Régimen General IVA', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Recargo de Equivalencia (Retail)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Régimen Simplificado', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='FORFAIT'),
        ],
        'counterparty_presets': [
            _profile('Empresa Española (B2B)', vat_registered=True),
            _profile('Consumidor Final (B2C)', vat_registered=False),
            _profile('Intracomunitario EU (Reverse Charge)', vat_registered=True, reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('Recargo de Equivalencia 5.2%', '0.0520', is_active=False,
                        description='Retail surcharge — applied only for RE regime'),
        ],
        'tax_group_presets': [
            _tax_group('IVA 21%', '0.2100', is_default=True, description='Tipo general'),
            _tax_group('IVA 10%', '0.1000', description='Tipo reducido'),
            _tax_group('IVA 4%', '0.0400', description='Tipo superreducido'),
            _tax_group('IVA 0%', '0.0000', description='Exento / exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Netherlands (Belastingdienst)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'NL',
        'country_name': 'Netherlands',
        'currency_code': 'EUR',
        'document_requirements': [
            _doc('TAX_ID', 'BTW-nummer (VAT ID)'),
            _doc('BIZ_REG', 'KvK (Chamber of Commerce) Registration'),
        ],
        'org_policy_defaults': [
            _policy('Standard BTW', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Kleine Ondernemers Regeling (KOR)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Dutch Business (B2B)', vat_registered=True),
            _profile('Dutch Consumer (B2C)', vat_registered=False),
            _profile('EU Business (Reverse Charge)', vat_registered=True, reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('BTW 21%', '0.2100', is_default=True, description='Hoog tarief — standard rate'),
            _tax_group('BTW 9%', '0.0900', description='Laag tarief — food, books, transport'),
            _tax_group('BTW 0%', '0.0000', description='Nultarief — exports, intra-EU'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Belgium
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'BE',
        'country_name': 'Belgium',
        'currency_code': 'EUR',
        'document_requirements': [
            _doc('TAX_ID', 'BTW/TVA Number'),
            _doc('BIZ_REG', 'BCE/KBO Enterprise Number'),
        ],
        'org_policy_defaults': [
            _policy('Standard BTW/TVA', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Franchise Exemption', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Belgian Business', vat_registered=True),
            _profile('Consumer', vat_registered=False),
            _profile('EU B2B (Reverse Charge)', vat_registered=True, reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('BTW/TVA 21%', '0.2100', is_default=True, description='Standard rate'),
            _tax_group('BTW/TVA 12%', '0.1200', description='Intermediate rate — catering, housing'),
            _tax_group('BTW/TVA 6%', '0.0600', description='Reduced rate — food, books, meds'),
            _tax_group('BTW/TVA 0%', '0.0000', description='Zero rate — exports, newspapers'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Switzerland (Federal Tax Administration — ESTV)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'CH',
        'country_name': 'Switzerland',
        'currency_code': 'CHF',
        'document_requirements': [
            _doc('TAX_ID', 'MWST / UID Number'),
            _doc('BIZ_REG', 'Handelsregister-Auszug'),
        ],
        'org_policy_defaults': [
            _policy('Standard MwSt (Effective Method)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Saldo-/Pauschalsteuersatz', vat_output_enabled=True,
                    vat_input_recoverability='0.000', profit_tax_mode='STANDARD',
                    sales_tax_rate='0.0600', sales_tax_trigger='ON_TURNOVER'),
            _policy('Below CHF 100k Turnover (Exempt)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Swiss Business (B2B)', vat_registered=True),
            _profile('Swiss Consumer', vat_registered=False),
            _profile('Foreign Vendor', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('MwSt 8.1%', '0.0810', is_default=True, description='Normalsatz (2024+)'),
            _tax_group('MwSt 3.8%', '0.0380', description='Sondersatz — accommodation'),
            _tax_group('MwSt 2.6%', '0.0260', description='Reduzierter Satz — food, books, meds'),
            _tax_group('MwSt 0%', '0.0000', description='Steuerfreie Umsätze / exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Australia (ATO — Australian Taxation Office)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'AU',
        'country_name': 'Australia',
        'currency_code': 'AUD',
        'document_requirements': [
            _doc('TAX_ID', 'ABN (Australian Business Number)'),
            _doc('TAX_ID', 'GST Registration Number'),
        ],
        'org_policy_defaults': [
            _policy('GST Registered — Full Input Credits', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Below GST Threshold (AUD 75k)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Australian Business (GST Registered)', vat_registered=True),
            _profile('Consumer / Small Business', vat_registered=False),
            _profile('Non-Resident Supplier (Reverse Charge)', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('GST 10%', '0.1000', is_default=True, description='Standard GST rate'),
            _tax_group('GST-Free', '0.0000', description='Food, health, education, exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # New Zealand (Inland Revenue / IRD)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'NZ',
        'country_name': 'New Zealand',
        'currency_code': 'NZD',
        'document_requirements': [
            _doc('TAX_ID', 'IRD Number'),
            _doc('TAX_ID', 'NZBN (Business Number)'),
        ],
        'org_policy_defaults': [
            _policy('GST Registered (Payments/Invoice/Hybrid)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Below GST Threshold (NZD 60k)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('NZ Business (GST Registered)', vat_registered=True),
            _profile('Consumer', vat_registered=False),
            _profile('Foreign Supplier (Reverse Charge)', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('GST 15%', '0.1500', is_default=True, description='Standard GST rate'),
            _tax_group('GST 0%', '0.0000', description='Zero-rated — exports, financial services'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Japan (NTA — National Tax Agency)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'JP',
        'country_name': 'Japan',
        'currency_code': 'JPY',
        'document_requirements': [
            _doc('TAX_ID', 'Corporate Number (13 digits)'),
            _doc('TAX_ID', 'Qualified Invoice Issuer Number (Peppol)'),
        ],
        'org_policy_defaults': [
            _policy('Consumption Tax Taxable Enterprise', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Simplified Tax Method', vat_output_enabled=True,
                    vat_input_recoverability='0.000', profit_tax_mode='STANDARD',
                    sales_tax_rate='0.1000', sales_tax_trigger='ON_TURNOVER'),
            _policy('Tax-Exempt Enterprise (< JPY 10M)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Japanese Business', vat_registered=True),
            _profile('Consumer', vat_registered=False),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('Consumption Tax 10%', '0.1000', is_default=True, description='Standard consumption tax'),
            _tax_group('Consumption Tax 8%', '0.0800', description='Reduced rate — food, subscriptions'),
            _tax_group('Consumption Tax 0%', '0.0000', description='Export / international transport'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Singapore (IRAS)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'SG',
        'country_name': 'Singapore',
        'currency_code': 'SGD',
        'document_requirements': [
            _doc('TAX_ID', 'UEN (Unique Entity Number)'),
            _doc('TAX_ID', 'GST Registration Number'),
        ],
        'org_policy_defaults': [
            _policy('GST Registered', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Below GST Threshold (SGD 1M)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Singapore Business (B2B)', vat_registered=True),
            _profile('Consumer / Overseas Customer', vat_registered=False),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('GST 9%', '0.0900', is_default=True, description='Standard GST rate (2024+)'),
            _tax_group('GST 0% (Zero-Rated)', '0.0000', description='Exports, international services'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Hong Kong (IRD)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'HK',
        'country_name': 'Hong Kong',
        'currency_code': 'HKD',
        'document_requirements': [
            _doc('TAX_ID', 'Business Registration Number'),
        ],
        'org_policy_defaults': [
            _policy('No VAT/GST — Standard Profits Tax', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='STANDARD'),
        ],
        'counterparty_presets': [
            _profile('Hong Kong Business', vat_registered=False),
            _profile('Overseas Customer', vat_registered=False),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('No Sales Tax', '0.0000', is_default=True, description='Hong Kong has no VAT/GST'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Mexico (SAT — CFDI 4.0 e-invoicing)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'MX',
        'country_name': 'Mexico',
        'currency_code': 'MXN',
        'document_requirements': [
            _doc('TAX_ID', 'RFC (Registro Federal de Contribuyentes)'),
            _doc('COMPLIANCE', 'FIEL / e.firma (Digital Certificate)'),
            _doc('COMPLIANCE', 'CSD (Certificado de Sello Digital) for CFDI'),
        ],
        'org_policy_defaults': [
            _policy('Régimen General', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('RESICO (Simplified for Small Biz)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='FORFAIT'),
        ],
        'counterparty_presets': [
            _profile('Mexican Business (B2B)', vat_registered=True),
            _profile('Mexican Consumer', vat_registered=False),
            _profile('Foreign Supplier', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('IEPS (Excise)', '0.0000', is_active=False,
                        description='Impuesto Especial sobre Producción y Servicios — varies by product'),
            _custom_tax('ISR Withholding 10%', '0.1000', is_active=False,
                        transaction_type='PURCHASE',
                        description='Professional services ISR retention'),
        ],
        'tax_group_presets': [
            _tax_group('IVA 16%', '0.1600', is_default=True, description='Tasa general'),
            _tax_group('IVA 8% (Border)', '0.0800', description='Frontera norte/sur'),
            _tax_group('IVA 0%', '0.0000', description='Exportaciones, alimentos, medicinas'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Brazil (SEFAZ — NF-e / NFS-e)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'BR',
        'country_name': 'Brazil',
        'currency_code': 'BRL',
        'document_requirements': [
            _doc('TAX_ID', 'CNPJ (Corporate) / CPF (Individual)'),
            _doc('COMPLIANCE', 'Inscrição Estadual (State Tax ID)'),
            _doc('COMPLIANCE', 'Digital Certificate (e-CNPJ A1 or A3)'),
        ],
        'org_policy_defaults': [
            _policy('Lucro Real', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Lucro Presumido', vat_output_enabled=True,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT'),
            _policy('Simples Nacional (MEI)', vat_output_enabled=True,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT',
                    sales_tax_rate='0.0600', sales_tax_trigger='ON_TURNOVER'),
        ],
        'counterparty_presets': [
            _profile('Brazilian Business (B2B)', vat_registered=True),
            _profile('Consumer (B2C)', vat_registered=False),
            _profile('Foreign Supplier', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('PIS 1.65%', '0.0165', transaction_type='BOTH', is_active=False,
                        description='Programa de Integração Social'),
            _custom_tax('COFINS 7.6%', '0.0760', transaction_type='BOTH', is_active=False,
                        description='Contribuição p/ Financiamento da Seguridade Social'),
            _custom_tax('ISS (Municipal Service Tax)', '0.0500', is_active=False,
                        description='Varies 2-5% by municipality'),
        ],
        'tax_group_presets': [
            _tax_group('ICMS 18% (default)', '0.1800', is_default=True, description='Varies 17-19% by state'),
            _tax_group('IPI', '0.0000', description='Federal Tax on Industrialized Products — varies by product'),
            _tax_group('ICMS 0% (Export)', '0.0000', description='Zero-rated exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Argentina (AFIP — Factura Electrónica)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'AR',
        'country_name': 'Argentina',
        'currency_code': 'ARS',
        'document_requirements': [
            _doc('TAX_ID', 'CUIT (Clave Única de Identificación Tributaria)'),
            _doc('COMPLIANCE', 'AFIP Digital Certificate for e-invoicing'),
        ],
        'org_policy_defaults': [
            _policy('Responsable Inscripto', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Monotributo (Simplified)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT'),
            _policy('Exento', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('Responsable Inscripto', vat_registered=True),
            _profile('Monotributista', vat_registered=True),
            _profile('Consumidor Final', vat_registered=False),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('IIBB (Ingresos Brutos)', '0.0300', is_active=False,
                        description='Provincial turnover tax — varies 1-5% by jurisdiction'),
        ],
        'tax_group_presets': [
            _tax_group('IVA 21%', '0.2100', is_default=True, description='Tasa general'),
            _tax_group('IVA 10.5%', '0.1050', description='Productos alimenticios, medicinas'),
            _tax_group('IVA 27%', '0.2700', description='Servicios regulados'),
            _tax_group('IVA 0%', '0.0000', description='Exportaciones'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Chile (SII — Servicio de Impuestos Internos)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'CL',
        'country_name': 'Chile',
        'currency_code': 'CLP',
        'document_requirements': [
            _doc('TAX_ID', 'RUT (Rol Único Tributario)'),
            _doc('COMPLIANCE', 'Folio autorizado SII for e-invoicing'),
        ],
        'org_policy_defaults': [
            _policy('Régimen General (Primera Categoría)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Régimen Pro-Pyme', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
        ],
        'counterparty_presets': [
            _profile('Empresa Chilena', vat_registered=True),
            _profile('Consumidor Final', vat_registered=False),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('IVA 19%', '0.1900', is_default=True, description='Tasa general'),
            _tax_group('IVA 0%', '0.0000', description='Exportaciones'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Colombia (DIAN)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'CO',
        'country_name': 'Colombia',
        'currency_code': 'COP',
        'document_requirements': [
            _doc('TAX_ID', 'NIT (Número de Identificación Tributaria)'),
            _doc('COMPLIANCE', 'DIAN Digital Signature for Factura Electrónica'),
        ],
        'org_policy_defaults': [
            _policy('Régimen Común', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Régimen Simple de Tributación', vat_output_enabled=True,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT'),
        ],
        'counterparty_presets': [
            _profile('Empresa Colombiana', vat_registered=True),
            _profile('Consumidor Final', vat_registered=False),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('ReteFuente (Income WHT)', '0.0250', is_active=False,
                        transaction_type='PURCHASE',
                        description='Retención en la Fuente — varies by concept'),
            _custom_tax('ReteICA (Municipal WHT)', '0.0069', is_active=False,
                        description='Municipal industry & commerce tax — varies'),
        ],
        'tax_group_presets': [
            _tax_group('IVA 19%', '0.1900', is_default=True, description='Tasa general'),
            _tax_group('IVA 5%', '0.0500', description='Alimentos, medicinas'),
            _tax_group('IVA 0%', '0.0000', description='Exportaciones, exentos'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # South Africa (SARS)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'ZA',
        'country_name': 'South Africa',
        'currency_code': 'ZAR',
        'document_requirements': [
            _doc('TAX_ID', 'VAT Number (SARS)'),
            _doc('BIZ_REG', 'CIPC Registration Number'),
        ],
        'org_policy_defaults': [
            _policy('VAT Vendor (Standard)', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Small Business (Below Threshold)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='EXEMPT'),
        ],
        'counterparty_presets': [
            _profile('SA Business (VAT-Registered)', vat_registered=True),
            _profile('Consumer', vat_registered=False),
            _profile('Non-SA Supplier', reverse_charge=True),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('VAT 15%', '0.1500', is_default=True, description='Standard VAT rate'),
            _tax_group('VAT 0%', '0.0000', description='Zero-rated — staples, exports'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Kenya (KRA)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'KE',
        'country_name': 'Kenya',
        'currency_code': 'KES',
        'document_requirements': [
            _doc('TAX_ID', 'KRA PIN Certificate'),
            _doc('TAX_ID', 'VAT Registration'),
            _doc('COMPLIANCE', 'eTIMS Device / ETR'),
        ],
        'org_policy_defaults': [
            _policy('Standard VAT Registered', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Turnover Tax (< KES 25M)', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT',
                    sales_tax_rate='0.0100', sales_tax_trigger='ON_TURNOVER'),
        ],
        'counterparty_presets': [
            _profile('Kenyan Business (PIN-Registered)', vat_registered=True),
            _profile('Consumer', vat_registered=False),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('WHT Professional Services 5%', '0.0500', is_active=False,
                        transaction_type='PURCHASE',
                        description='Withholding tax on consultancy / management fees'),
        ],
        'tax_group_presets': [
            _tax_group('VAT 16%', '0.1600', is_default=True, description='Standard rate'),
            _tax_group('VAT 8%', '0.0800', description='Petroleum products'),
            _tax_group('VAT 0%', '0.0000', description='Exports, zero-rated supplies'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Ghana (GRA)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'GH',
        'country_name': 'Ghana',
        'currency_code': 'GHS',
        'document_requirements': [
            _doc('TAX_ID', 'TIN (Tax Identification Number)'),
            _doc('TAX_ID', 'VAT Registration Certificate'),
        ],
        'org_policy_defaults': [
            _policy('Standard VAT', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('VAT Flat Rate Scheme (3%)', vat_output_enabled=True,
                    vat_input_recoverability='0.000', profit_tax_mode='STANDARD',
                    sales_tax_rate='0.0300', sales_tax_trigger='ON_TURNOVER'),
        ],
        'counterparty_presets': [
            _profile('Ghanaian Business', vat_registered=True),
            _profile('Consumer', vat_registered=False),
        ],
        'custom_tax_rule_presets': [
            _custom_tax('NHIL 2.5%', '0.0250', is_active=False,
                        description='National Health Insurance Levy'),
            _custom_tax('GETFund 2.5%', '0.0250', is_active=False,
                        description='Ghana Education Trust Fund'),
            _custom_tax('COVID Levy 1%', '0.0100', is_active=False,
                        description='COVID-19 Health Recovery Levy'),
        ],
        'tax_group_presets': [
            _tax_group('VAT 15%', '0.1500', is_default=True, description='Standard VAT rate'),
            _tax_group('VAT 0%', '0.0000', description='Exports, zero-rated'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Togo (OHADA — SYSCOHADA)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'TG',
        'country_name': 'Togo',
        'currency_code': 'XOF',
        'document_requirements': [
            _doc('TAX_ID', 'NIF (Numéro d\'Identification Fiscale)'),
            _doc('BIZ_REG', 'RCCM (OHADA Registre du Commerce)'),
        ],
        'org_policy_defaults': [
            _policy('Régime Réel Normal', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Régime Simplifié', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='FORFAIT'),
        ],
        'counterparty_presets': [
            _profile('Entreprise Togolaise', vat_registered=True),
            _profile('Consommateur', vat_registered=False),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('TVA 18%', '0.1800', is_default=True, description='Taux normal'),
            _tax_group('TVA 0%', '0.0000', description='Exportations, opérations exonérées'),
        ],
    },

    # ═══════════════════════════════════════════════════════════════════
    # Benin (OHADA / UEMOA)
    # ═══════════════════════════════════════════════════════════════════
    {
        'country_code': 'BJ',
        'country_name': 'Benin',
        'currency_code': 'XOF',
        'document_requirements': [
            _doc('TAX_ID', 'IFU (Identifiant Fiscal Unique)'),
            _doc('BIZ_REG', 'RCCM'),
        ],
        'org_policy_defaults': [
            _policy('Régime Réel', vat_output_enabled=True,
                    vat_input_recoverability='1.000', profit_tax_mode='STANDARD'),
            _policy('Régime des Micro-Entreprises', vat_output_enabled=False,
                    vat_input_recoverability='0.000', profit_tax_mode='FORFAIT'),
        ],
        'counterparty_presets': [
            _profile('Entreprise Béninoise', vat_registered=True),
            _profile('Consommateur', vat_registered=False),
        ],
        'custom_tax_rule_presets': [],
        'tax_group_presets': [
            _tax_group('TVA 18%', '0.1800', is_default=True, description='Taux normal'),
            _tax_group('TVA 0%', '0.0000', description='Exportations'),
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
