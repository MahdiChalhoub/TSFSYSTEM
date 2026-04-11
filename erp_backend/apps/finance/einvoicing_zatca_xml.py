import base64
import hashlib
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from xml.etree import ElementTree as ET

from .einvoicing_constants import (
    UBL_NS, CAC_NS, CBC_NS, EXT_NS, SIG_NS, SBC_NS, DS_NS, NSMAP,
    ZATCA_TYPE_CODES,
)

logger = logging.getLogger(__name__)


class ZATCAXMLMixin:

    # ─── 1. UBL 2.1 XML Generation ──────────────────────────────────────

    def generate_ubl_xml(self, invoice, previous_hash=None):
        """
        Generate ZATCA-compliant UBL 2.1 XML invoice.

        Implements mandatory FATOORA business rules BR-KSA-01..72:
        - Invoice identification (ID, UUID, IssueDate, InvoiceTypeCode)
        - Supplier & customer party with TRN
        - Invoice lines with item info and pricing
        - Tax totals and legal monetary totals
        - Previous invoice hash for chain integrity

        Args:
            invoice: Invoice model instance with lines
            previous_hash: SHA-256 hash of the previous invoice (or '0'*64 for first)

        Returns:
            str: Complete UBL 2.1 XML string
        """
        inv_uuid = str(uuid.uuid4())
        raw_date = invoice.issue_date or datetime.now().date()
        if isinstance(raw_date, str):
            issue_date = raw_date  # Already a string
        else:
            issue_date = raw_date.strftime('%Y-%m-%d')
        issue_time = datetime.now().strftime('%H:%M:%S')

        # Determine invoice type code per ZATCA
        type_code = self._get_type_code(invoice)

        root = ET.Element('Invoice', NSMAP)

        # ── Profile & Customization IDs ──
        ET.SubElement(root, 'cbc:ProfileID').text = 'reporting:1.0'
        ET.SubElement(root, 'cbc:ID').text = invoice.invoice_number or f'INV-{invoice.id}'
        ET.SubElement(root, 'cbc:UUID').text = inv_uuid
        ET.SubElement(root, 'cbc:IssueDate').text = issue_date
        ET.SubElement(root, 'cbc:IssueTime').text = issue_time
        ET.SubElement(root, 'cbc:InvoiceTypeCode', name='0100000').text = type_code
        ET.SubElement(root, 'cbc:DocumentCurrencyCode').text = invoice.currency or 'SAR'
        ET.SubElement(root, 'cbc:TaxCurrencyCode').text = 'SAR'

        # ── Previous Invoice Hash (BR-KSA-13) ──
        prev_hash = previous_hash or ('0' * 64)
        additional_doc = ET.SubElement(root, 'cac:AdditionalDocumentReference')
        ET.SubElement(additional_doc, 'cbc:ID').text = 'PIH'
        attachment = ET.SubElement(additional_doc, 'cac:Attachment')
        embedded = ET.SubElement(attachment, 'cbc:EmbeddedDocumentBinaryObject', mimeCode='text/plain')
        embedded.text = base64.b64encode(prev_hash.encode()).decode()

        # ── Accounting Supplier Party (BR-KSA-02..05) ──
        self._add_supplier_party(root, invoice)

        # ── Accounting Customer Party (BR-KSA-06..09) ──
        self._add_customer_party(root, invoice)

        # ── Delivery (supply date — single element only) ──
        delivery = ET.SubElement(root, 'cac:Delivery')
        supply_date_el = ET.SubElement(delivery, 'cbc:ActualDeliveryDate')
        supply_date_el.text = issue_date

        # ── Payment Means ──
        pm = ET.SubElement(root, 'cac:PaymentMeans')
        ET.SubElement(pm, 'cbc:PaymentMeansCode').text = '10'  # Cash

        # ── Tax Total (BR-KSA-14..16) ──
        self._add_tax_total(root, invoice)

        # ── Legal Monetary Total (BR-KSA-17..22) ──
        self._add_monetary_total(root, invoice)

        # ── Invoice Lines (BR-KSA-33..52) ──
        self._add_invoice_lines(root, invoice)

        xml_string = ET.tostring(root, encoding='unicode', xml_declaration=True)
        logger.info(f"[ZATCA] Generated UBL 2.1 XML for invoice {invoice.invoice_number}")
        return xml_string


    def _get_type_code(self, invoice):
        """Map invoice type to ZATCA InvoiceTypeCode."""
        return ZATCA_TYPE_CODES.get(
            getattr(invoice, 'type', 'SALES'), '388'
        )

    def _resolve_country_code(self, invoice):
        """Resolve country code from org settings instead of hardcoding."""
        org = invoice.organization
        if org:
            # Try org-level country_code, falling back to SA for ZATCA
            code = getattr(org, 'country_code', None)
            if not code and hasattr(org, 'settings') and isinstance(org.settings, dict):
                code = org.settings.get('country_code')
            return code or 'SA'
        return 'SA'


    def _add_supplier_party(self, root, invoice):
        """Add cac:AccountingSupplierParty with ZATCA-required fields."""
        supplier = ET.SubElement(root, 'cac:AccountingSupplierParty')
        party = ET.SubElement(supplier, 'cac:Party')

        # Party identification (VAT TRN)
        org = invoice.organization
        vat_number = ''
        seller_name = org.name if org else 'Organization'

        if self.config:
            vat_number = self.config.vat_registration_number or ''
            seller_name = self.config.seller_name or seller_name

        pid = ET.SubElement(party, 'cac:PartyIdentification')
        ET.SubElement(pid, 'cbc:ID', schemeID='CRN').text = vat_number

        # Party name
        pn = ET.SubElement(party, 'cac:PartyName')
        ET.SubElement(pn, 'cbc:Name').text = seller_name

        # Postal address
        addr = ET.SubElement(party, 'cac:PostalAddress')
        ET.SubElement(addr, 'cbc:StreetName').text = getattr(org, 'address', '') or ''
        ET.SubElement(addr, 'cbc:CityName').text = getattr(org, 'city', '') or ''
        ET.SubElement(addr, 'cbc:PostalZone').text = getattr(org, 'zip_code', '') or ''
        country_el = ET.SubElement(addr, 'cac:Country')
        ET.SubElement(country_el, 'cbc:IdentificationCode').text = self._resolve_country_code(invoice)

        # Tax scheme (VAT)
        tax_scheme_party = ET.SubElement(party, 'cac:PartyTaxScheme')
        ET.SubElement(tax_scheme_party, 'cbc:CompanyID').text = vat_number
        ts = ET.SubElement(tax_scheme_party, 'cac:TaxScheme')
        ET.SubElement(ts, 'cbc:ID').text = 'VAT'

        # Legal entity
        legal = ET.SubElement(party, 'cac:PartyLegalEntity')
        ET.SubElement(legal, 'cbc:RegistrationName').text = seller_name


    def _add_customer_party(self, root, invoice):
        """Add cac:AccountingCustomerParty with contact info."""
        customer = ET.SubElement(root, 'cac:AccountingCustomerParty')
        party = ET.SubElement(customer, 'cac:Party')

        # Customer name
        contact_name = getattr(invoice, 'contact_name', '') or ''
        pn = ET.SubElement(party, 'cac:PartyName')
        ET.SubElement(pn, 'cbc:Name').text = contact_name

        # Address
        addr = ET.SubElement(party, 'cac:PostalAddress')
        ET.SubElement(addr, 'cbc:StreetName').text = getattr(invoice, 'contact_address', '') or ''
        country_el = ET.SubElement(addr, 'cac:Country')
        ET.SubElement(country_el, 'cbc:IdentificationCode').text = self._resolve_country_code(invoice)

        # Tax scheme
        vat_id = getattr(invoice, 'contact_vat_id', '') or ''
        tsp = ET.SubElement(party, 'cac:PartyTaxScheme')
        ET.SubElement(tsp, 'cbc:CompanyID').text = vat_id
        ts = ET.SubElement(tsp, 'cac:TaxScheme')
        ET.SubElement(ts, 'cbc:ID').text = 'VAT'

        # Legal entity
        legal = ET.SubElement(party, 'cac:PartyLegalEntity')
        ET.SubElement(legal, 'cbc:RegistrationName').text = contact_name


    def _add_tax_total(self, root, invoice):
        """Add cac:TaxTotal with tax subtotals."""
        tax_total = ET.SubElement(root, 'cac:TaxTotal')
        tax_amt = ET.SubElement(tax_total, 'cbc:TaxAmount', currencyID=invoice.currency or 'SAR')
        tax_amt.text = str(invoice.tax_amount or Decimal('0.00'))

        # Tax subtotal at default rate
        subtotal = ET.SubElement(tax_total, 'cac:TaxSubtotal')
        taxable = ET.SubElement(subtotal, 'cbc:TaxableAmount', currencyID=invoice.currency or 'SAR')
        taxable.text = str(invoice.subtotal_ht or Decimal('0.00'))
        sub_tax_amt = ET.SubElement(subtotal, 'cbc:TaxAmount', currencyID=invoice.currency or 'SAR')
        sub_tax_amt.text = str(invoice.tax_amount or Decimal('0.00'))

        cat = ET.SubElement(subtotal, 'cac:TaxCategory')
        ET.SubElement(cat, 'cbc:ID').text = 'S'  # Standard rate
        ET.SubElement(cat, 'cbc:Percent').text = str(invoice.default_tax_rate or Decimal('15.00'))
        ts = ET.SubElement(cat, 'cac:TaxScheme')
        ET.SubElement(ts, 'cbc:ID').text = 'VAT'


    def _add_monetary_total(self, root, invoice):
        """Add cac:LegalMonetaryTotal."""
        monetary = ET.SubElement(root, 'cac:LegalMonetaryTotal')
        curr = invoice.currency or 'SAR'

        line_ext = ET.SubElement(monetary, 'cbc:LineExtensionAmount', currencyID=curr)
        line_ext.text = str(invoice.subtotal_ht or Decimal('0.00'))

        tax_excl = ET.SubElement(monetary, 'cbc:TaxExclusiveAmount', currencyID=curr)
        tax_excl.text = str(invoice.subtotal_ht or Decimal('0.00'))

        tax_incl = ET.SubElement(monetary, 'cbc:TaxInclusiveAmount', currencyID=curr)
        tax_incl.text = str(invoice.total_amount or Decimal('0.00'))

        allowance = ET.SubElement(monetary, 'cbc:AllowanceTotalAmount', currencyID=curr)
        allowance.text = str(invoice.discount_amount or Decimal('0.00'))

        payable = ET.SubElement(monetary, 'cbc:PayableAmount', currencyID=curr)
        payable.text = str(invoice.total_amount or Decimal('0.00'))


    def _add_invoice_lines(self, root, invoice):
        """Add cac:InvoiceLine for each line item."""
        lines = invoice.lines.all() if hasattr(invoice, 'lines') else []
        for idx, line in enumerate(lines, start=1):
            inv_line = ET.SubElement(root, 'cac:InvoiceLine')
            ET.SubElement(inv_line, 'cbc:ID').text = str(idx)

            qty = ET.SubElement(inv_line, 'cbc:InvoicedQuantity', unitCode='PCE')
            qty.text = str(line.quantity)

            ext_amt = ET.SubElement(inv_line, 'cbc:LineExtensionAmount',
                                   currencyID=invoice.currency or 'SAR')
            ext_amt.text = str(line.line_total_ht or Decimal('0.00'))

            # Tax total per line
            line_tax = ET.SubElement(inv_line, 'cac:TaxTotal')
            lt_amt = ET.SubElement(line_tax, 'cbc:TaxAmount',
                                  currencyID=invoice.currency or 'SAR')
            lt_amt.text = str(line.tax_amount or Decimal('0.00'))

            lt_round = ET.SubElement(line_tax, 'cbc:RoundingAmount',
                                    currencyID=invoice.currency or 'SAR')
            lt_round.text = str(line.line_total_ttc or Decimal('0.00'))

            # Item info
            item = ET.SubElement(inv_line, 'cac:Item')
            ET.SubElement(item, 'cbc:Name').text = line.description or f'Item {idx}'

            # Classified tax category
            ctc = ET.SubElement(item, 'cac:ClassifiedTaxCategory')
            ET.SubElement(ctc, 'cbc:ID').text = 'S'
            ET.SubElement(ctc, 'cbc:Percent').text = str(line.tax_rate or Decimal('15.00'))
            ts = ET.SubElement(ctc, 'cac:TaxScheme')
            ET.SubElement(ts, 'cbc:ID').text = 'VAT'

            # Price
            price = ET.SubElement(inv_line, 'cac:Price')
            pa = ET.SubElement(price, 'cbc:PriceAmount',
                              currencyID=invoice.currency or 'SAR')
            pa.text = str(line.unit_price or Decimal('0.00'))

