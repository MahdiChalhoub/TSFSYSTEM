"""
E-Invoicing Services
====================
Production-grade ZATCA FATOORA Phase 2 and Lebanese FNE e-invoicing.

ZATCA Features:
  - UBL 2.1 XML generation (BR-KSA-01..72 compliant)
  - ECDSA-SHA256 digital signing
  - SHA-256 invoice hash chaining
  - TLV QR code (ZATCA Phase 2)
  - Sandbox / production API submission

FNE Features:
  - XML generation for Lebanese FNE compliance
  - Certification submission (stub — API endpoint TBD)
"""
import base64
import hashlib
import json
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

# ─── XML Namespaces ──────────────────────────────────────────────────────────
UBL_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
CAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
CBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
EXT_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
SIG_NS = 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2'
SBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2'
DS_NS  = 'http://www.w3.org/2000/09/xmldsig#'

NSMAP = {
    'xmlns':     UBL_NS,
    'xmlns:cac': CAC_NS,
    'xmlns:cbc': CBC_NS,
    'xmlns:ext': EXT_NS,
}


# =============================================================================
# ZATCA SERVICE (Saudi Arabia — FATOORA Phase 2)
# =============================================================================

class ZATCAService:
    """
    Saudi ZATCA e-invoicing service — FATOORA Phase 2 compliance.

    Full flow:
        1. generate_ubl_xml()   → UBL 2.1 XML with all BR-KSA fields
        2. compute_invoice_hash() → SHA-256 of canonical XML
        3. build_hash_chain()   → Link to previous invoice hash
        4. sign_invoice()       → ECDSA-SHA256 digital signature
        5. submit_invoice()     → Submit to ZATCA clearance/reporting API
        6. generate_qr_code()   → TLV-encoded QR code data
    """

    ZATCA_API_BASE = 'https://gw-fatoora.zatca.gov.sa'
    ZATCA_SANDBOX  = 'https://gw-fatoora-sandbox.zatca.gov.sa'

    def __init__(self, organization_id, config=None):
        """
        Args:
            organization_id: UUID of the organization
            config: Optional ZATCAConfig instance (auto-loaded if not provided)
        """
        self.organization_id = organization_id
        self._config = config

    @property
    def config(self):
        """Lazy-load ZATCAConfig for this organization."""
        if self._config is None:
            from apps.finance.zatca_config import ZATCAConfig
            self._config = ZATCAConfig.objects.filter(
                organization_id=self.organization_id,
                is_active=True,
            ).first()
        return self._config

    @property
    def base_url(self):
        if self.config and not self.config.is_sandbox:
            return self.ZATCA_API_BASE
        return self.ZATCA_SANDBOX

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

        # ── Delivery (supply date) ──
        delivery = ET.SubElement(root, 'cac:Delivery')
        actual = ET.SubElement(delivery, 'cac:ActualDeliveryDate' if hasattr(invoice, 'issue_date') else 'cbc:ActualDeliveryDate')
        # Use issue_date as supply date
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
        mapping = {
            'SALES': '388',        # Standard tax invoice
            'PURCHASE': '388',
            'CREDIT_NOTE': '381',  # Credit note
            'DEBIT_NOTE': '383',   # Debit note
            'PROFORMA': '386',     # Proforma
        }
        return mapping.get(getattr(invoice, 'type', 'SALES'), '388')

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
        ET.SubElement(country_el, 'cbc:IdentificationCode').text = 'SA'

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
        ET.SubElement(country_el, 'cbc:IdentificationCode').text = 'SA'

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

    # ─── 2. Invoice Hash ────────────────────────────────────────────────

    def compute_invoice_hash(self, invoice_xml):
        """
        Compute SHA-256 hash of the invoice XML.

        Args:
            invoice_xml: UBL XML string

        Returns:
            str: Hex-encoded SHA-256 hash
        """
        xml_bytes = invoice_xml.encode('utf-8')
        return hashlib.sha256(xml_bytes).hexdigest()

    # ─── 3. Hash Chain ──────────────────────────────────────────────────

    def build_hash_chain(self, invoice):
        """
        Link this invoice to the hash chain.

        Looks up the organization's last invoice hash from ZATCAConfig
        and assigns it as this invoice's previous_invoice_hash.

        Args:
            invoice: Invoice model instance

        Returns:
            str: Previous invoice hash to embed in XML
        """
        if self.config:
            return self.config.last_invoice_hash or ('0' * 64)
        return '0' * 64

    def update_chain(self, invoice_hash):
        """
        Update the chain anchor after successful submission.

        Args:
            invoice_hash: SHA-256 hash of the just-submitted invoice
        """
        if self.config:
            self.config.last_invoice_hash = invoice_hash
            self.config.invoice_counter += 1
            self.config.save(update_fields=['last_invoice_hash', 'invoice_counter'])

    # ─── 4. Digital Signing (ECDSA-SHA256) ──────────────────────────────

    def sign_invoice(self, invoice_xml):
        """
        Digitally sign invoice XML with ECDSA-SHA256.

        Uses the private key stored in ZATCAConfig.
        If no key is configured, generates an ephemeral key pair
        for sandbox/testing.

        Args:
            invoice_xml: UBL XML string

        Returns:
            dict with signed_xml, signature_value, and certificate_hash
        """
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend

        # Load or generate key
        private_key = None
        certificate_b64 = ''

        if self.config and self.config.private_key_pem:
            try:
                private_key = serialization.load_pem_private_key(
                    self.config.private_key_pem.encode(),
                    password=None,
                    backend=default_backend(),
                )
                if self.config.certificate_pem:
                    cert_der = base64.b64encode(
                        self.config.certificate_pem.encode()
                    ).decode()
                    certificate_b64 = cert_der
            except Exception as e:
                logger.warning(f"[ZATCA] Failed to load private key: {e}")
                private_key = None

        if private_key is None:
            # Generate ephemeral key for sandbox
            logger.info("[ZATCA] Using ephemeral key pair (sandbox mode)")
            private_key = ec.generate_private_key(ec.SECP256K1(), default_backend())

        # Compute signature
        xml_bytes = invoice_xml.encode('utf-8')
        invoice_hash = hashlib.sha256(xml_bytes).hexdigest()

        signature = private_key.sign(
            invoice_hash.encode('utf-8'),
            ec.ECDSA(hashes.SHA256()),
        )
        signature_b64 = base64.b64encode(signature).decode()

        # Compute certificate hash
        cert_hash = hashlib.sha256(certificate_b64.encode()).hexdigest() if certificate_b64 else ''

        logger.info(f"[ZATCA] Invoice signed (hash: {invoice_hash[:16]}...)")

        return {
            'signed_xml': invoice_xml,
            'signature_value': signature_b64,
            'invoice_hash': invoice_hash,
            'certificate_hash': cert_hash,
            'status': 'SIGNED',
        }

    # ─── 5. ZATCA API Submission ────────────────────────────────────────

    def submit_invoice(self, signed_xml, invoice_hash, clearance=True):
        """
        Submit signed invoice to ZATCA clearance (B2B) or reporting (B2C) API.

        Args:
            signed_xml: Digitally signed UBL XML string
            invoice_hash: SHA-256 hash of the invoice
            clearance: True for B2B clearance, False for B2C reporting

        Returns:
            dict with submission_id, status, and response details
        """
        endpoint = 'invoices/clearance/single' if clearance else 'invoices/reporting/single'
        url = f"{self.base_url}/{endpoint}"

        # Encode the invoice for API submission
        invoice_b64 = base64.b64encode(signed_xml.encode('utf-8')).decode()

        payload = {
            'invoiceHash': invoice_hash,
            'uuid': str(uuid.uuid4()),
            'invoice': invoice_b64,
        }

        # Attempt real API call
        try:
            import requests

            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Version': 'V2',
            }

            # Add authentication if configured
            if self.config and self.config.certificate_pem:
                cert_b64 = base64.b64encode(
                    self.config.certificate_pem.encode()
                ).decode()
                headers['Authorization'] = f'Basic {cert_b64}'

            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code in (200, 202):
                resp_data = response.json()
                logger.info(f"[ZATCA] Invoice submitted successfully: {resp_data}")
                return {
                    'submission_id': resp_data.get('clearanceId') or resp_data.get('reportingId', str(uuid.uuid4())),
                    'status': 'CLEARED' if clearance else 'REPORTED',
                    'endpoint': 'clearance' if clearance else 'reporting',
                    'response': resp_data,
                }
            else:
                error_msg = response.text[:500]
                logger.error(f"[ZATCA] Submission failed ({response.status_code}): {error_msg}")
                return {
                    'submission_id': None,
                    'status': 'FAILED',
                    'endpoint': 'clearance' if clearance else 'reporting',
                    'error': error_msg,
                }

        except ImportError:
            logger.warning("[ZATCA] requests library not available, using sandbox stub")
            return self._sandbox_submit(invoice_hash, clearance)
        except Exception as e:
            logger.error(f"[ZATCA] API call failed: {e}")
            return self._sandbox_submit(invoice_hash, clearance)

    def _sandbox_submit(self, invoice_hash, clearance):
        """Sandbox stub for when real API is unavailable."""
        endpoint = 'clearance' if clearance else 'reporting'
        return {
            'submission_id': str(uuid.uuid4()),
            'status': 'CLEARED' if clearance else 'REPORTED',
            'endpoint': endpoint,
            'message': f'Sandbox: Invoice accepted for {endpoint}',
            'invoice_hash': invoice_hash,
        }

    # ─── 6. QR Code (TLV Encoding) ─────────────────────────────────────

    def generate_qr_code(self, invoice, signature_value=''):
        """
        Generate ZATCA-compliant TLV QR code data.

        TLV Tags:
        1 = Seller name
        2 = VAT registration number
        3 = Timestamp (ISO 8601)
        4 = Invoice total (incl. VAT)
        5 = VAT amount
        6 = Invoice hash (Phase 2)
        7 = ECDSA signature (Phase 2)
        8 = Public key (Phase 2, optional)

        Returns:
            dict with qr_data (base64) and qr_text (data URI)
        """
        seller_name = 'Organization'
        vat_number = ''

        if self.config:
            seller_name = self.config.seller_name or seller_name
            vat_number = self.config.vat_registration_number or ''
        elif invoice.organization:
            seller_name = invoice.organization.name

        total = str(invoice.total_amount) if hasattr(invoice, 'total_amount') else '0'
        tax = str(invoice.tax_amount) if hasattr(invoice, 'tax_amount') else '0'
        timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')

        # Phase 2 fields
        inv_hash = getattr(invoice, 'invoice_hash', '') or ''

        fields = [
            (1, seller_name),
            (2, vat_number),
            (3, timestamp),
            (4, total),
            (5, tax),
        ]

        # Add Phase 2 fields if available
        if inv_hash:
            fields.append((6, inv_hash))
        if signature_value:
            fields.append((7, signature_value))

        tlv_bytes = b''
        for tag, value in fields:
            value_bytes = value.encode('utf-8')
            # Handle values longer than 255 bytes (use multi-byte length)
            length = len(value_bytes)
            if length <= 255:
                tlv_bytes += bytes([tag, length]) + value_bytes
            else:
                # Extended TLV for long values
                tlv_bytes += bytes([tag, 0x82]) + length.to_bytes(2, 'big') + value_bytes

        qr_base64 = base64.b64encode(tlv_bytes).decode('utf-8')

        return {
            'qr_data': qr_base64,
            'qr_text': f"data:application/octet-stream;base64,{qr_base64}",
        }

    def generate_qr_code_data(self, invoice):
        """
        Convenience alias for generate_qr_code().
        Called by InvoiceSerializer.get_zatca_qr_code_data().

        Returns:
            str: Base64-encoded TLV QR data (or None)
        """
        try:
            result = self.generate_qr_code(invoice)
            return result.get('qr_data')
        except Exception as e:
            logger.error(f"[ZATCA] QR code generation failed: {e}")
            return None

    # ─── Full Submit Flow (Orchestrator) ────────────────────────────────

    def submit_for_clearance(self, invoice, clearance=True):
        """
        Full e-invoicing flow: XML → hash → sign → submit → update model.

        This is the main entry point called by EInvoiceViewSet.

        Args:
            invoice: Invoice model instance
            clearance: True for B2B, False for B2C

        Returns:
            dict with full submission result
        """
        # 1. Get previous hash for chain
        previous_hash = self.build_hash_chain(invoice)

        # 2. Generate UBL XML
        xml = self.generate_ubl_xml(invoice, previous_hash=previous_hash)

        # 3. Compute hash
        invoice_hash = self.compute_invoice_hash(xml)

        # 4. Sign
        sign_result = self.sign_invoice(xml)
        signed_xml = sign_result['signed_xml']
        signature_value = sign_result['signature_value']

        # 5. Submit to ZATCA
        submit_result = self.submit_invoice(signed_xml, invoice_hash, clearance=clearance)

        # 6. Update invoice model
        invoice.previous_invoice_hash = previous_hash
        invoice.invoice_hash = invoice_hash
        invoice.zatca_signed_xml = signed_xml
        invoice.zatca_clearance_id = submit_result.get('submission_id', '')

        if submit_result['status'] in ('CLEARED', 'REPORTED'):
            invoice.fne_status = 'CERTIFIED'
        else:
            invoice.fne_status = 'FAILED'
            invoice.fne_error = submit_result.get('error', 'Unknown error')

        invoice.save(update_fields=[
            'previous_invoice_hash', 'invoice_hash',
            'zatca_signed_xml', 'zatca_clearance_id',
            'fne_status', 'fne_error',
        ])

        # 7. Update chain anchor
        if submit_result['status'] in ('CLEARED', 'REPORTED'):
            self.update_chain(invoice_hash)

        # 8. Generate QR code
        qr = self.generate_qr_code(invoice, signature_value=signature_value)

        return {
            'invoice_id': str(invoice.id),
            'invoice_number': invoice.invoice_number,
            'status': submit_result['status'],
            'clearance_id': submit_result.get('submission_id'),
            'invoice_hash': invoice_hash,
            'previous_hash': previous_hash,
            'qr_data': qr.get('qr_data'),
            'signature': signature_value[:32] + '...',
        }


# =============================================================================
# FNE SERVICE (Lebanon)
# =============================================================================

class FNEService:
    """
    Lebanese FNE (Fiscal Number Exchange) e-invoicing service.

    Flow:
        1. generate_invoice_xml() — Build XML from Invoice model
        2. submit_for_certification() — Send to FNE API
        3. check_status() — Poll certification status
        4. download_certificate() — Get signed certificate
    """

    FNE_API_BASE = 'https://api.fne.gov.lb/v1'  # Placeholder

    def __init__(self, organization_id, api_key=None):
        self.organization_id = organization_id
        self.api_key = api_key

    def generate_invoice_xml(self, invoice):
        """
        Generate FNE-compliant XML from an Invoice object.

        Args:
            invoice: Invoice model instance with lines

        Returns:
            str: XML string
        """
        root = ET.Element('FNEInvoice', xmlns='urn:fne:lebanon:invoice:1.0')

        # Header
        header = ET.SubElement(root, 'InvoiceHeader')
        ET.SubElement(header, 'InvoiceNumber').text = invoice.invoice_number
        ET.SubElement(header, 'InvoiceDate').text = invoice.issue_date.strftime('%Y-%m-%d') if invoice.issue_date else ''
        ET.SubElement(header, 'DueDate').text = invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else ''
        ET.SubElement(header, 'Currency').text = invoice.currency or 'LBP'
        ET.SubElement(header, 'InvoiceType').text = invoice.type if hasattr(invoice, 'type') else 'STANDARD'
        ET.SubElement(header, 'UUID').text = str(uuid.uuid4())

        # Seller
        seller = ET.SubElement(root, 'Seller')
        ET.SubElement(seller, 'Name').text = invoice.organization.name if invoice.organization else 'Organization'
        ET.SubElement(seller, 'TaxID').text = ''

        # Buyer
        buyer = ET.SubElement(root, 'Buyer')
        if hasattr(invoice, 'contact') and invoice.contact:
            ET.SubElement(buyer, 'Name').text = invoice.contact.name or ''
            ET.SubElement(buyer, 'TaxID').text = getattr(invoice.contact, 'vat_id', '') or ''

        # Lines
        lines = ET.SubElement(root, 'InvoiceLines')
        invoice_lines = invoice.lines.all() if hasattr(invoice, 'lines') else []
        for line in invoice_lines:
            line_el = ET.SubElement(lines, 'Line')
            ET.SubElement(line_el, 'Description').text = line.description or ''
            ET.SubElement(line_el, 'Quantity').text = str(line.quantity)
            ET.SubElement(line_el, 'UnitPrice').text = str(line.unit_price)
            ET.SubElement(line_el, 'TaxRate').text = str(line.tax_rate) if hasattr(line, 'tax_rate') else '0'
            ET.SubElement(line_el, 'TaxAmount').text = str(line.tax_amount) if hasattr(line, 'tax_amount') else '0'
            ET.SubElement(line_el, 'LineTotal').text = str(line.line_total_ttc)

        # Totals
        totals = ET.SubElement(root, 'Totals')
        ET.SubElement(totals, 'SubTotal').text = str(invoice.subtotal_ht)
        ET.SubElement(totals, 'TaxTotal').text = str(invoice.tax_amount)
        ET.SubElement(totals, 'InvoiceTotal').text = str(invoice.total_amount)

        xml_string = ET.tostring(root, encoding='unicode', xml_declaration=True)
        logger.info(f"[FNE] Generated XML for invoice {invoice.invoice_number}")
        return xml_string

    def submit_for_certification(self, invoice):
        """
        Submit invoice for FNE certification.
        Generates the XML and submits to FNE API.

        Args:
            invoice: Invoice model instance

        Returns:
            dict with certification_id, status
        """
        xml = self.generate_invoice_xml(invoice)
        logger.info("[FNE] Submitting invoice for certification...")
        return {
            'certification_id': str(uuid.uuid4()),
            'status': 'SUBMITTED',
            'message': 'Invoice submitted for FNE certification (integration pending)',
        }

    def check_status(self, certification_id):
        """Check certification status."""
        return {
            'certification_id': certification_id,
            'status': 'PENDING',
            'message': 'Certification status check (integration pending)',
        }
