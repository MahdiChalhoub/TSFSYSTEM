"""
E-Invoicing Constants
====================
Shared XML namespace constants and helpers for all e-invoicing providers
(ZATCA, FNE, UBL/PEPPOL, etc.).

Single source of truth — all einvoicing_* modules import from here.
"""

# ── UBL 2.1 Namespaces ──────────────────────────────────────────────────────
UBL_NS  = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
CAC_NS  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
CBC_NS  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
EXT_NS  = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
SIG_NS  = 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2'
SBC_NS  = 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2'
DS_NS   = 'http://www.w3.org/2000/09/xmldsig#'

# Standard namespace map for UBL 2.1 XML generation
NSMAP = {
    'xmlns':     UBL_NS,
    'xmlns:cac': CAC_NS,
    'xmlns:cbc': CBC_NS,
    'xmlns:ext': EXT_NS,
}

# ── ZATCA Invoice Type Codes ────────────────────────────────────────────────
ZATCA_TYPE_CODES = {
    'SALES':       '388',  # Standard tax invoice
    'PURCHASE':    '388',
    'CREDIT_NOTE': '381',  # Credit note
    'DEBIT_NOTE':  '383',  # Debit note
    'PROFORMA':    '386',  # Proforma
}

# ── E-Invoice Certification Statuses ────────────────────────────────────────
class EInvoiceStatus:
    NONE = 'NONE'
    PENDING = 'PENDING'
    CERTIFIED = 'CERTIFIED'
    FAILED = 'FAILED'
    REFUNDED = 'REFUNDED'
