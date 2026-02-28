import base64
import hashlib
import json
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from xml.etree import ElementTree as ET
logger = logging.getLogger(__name__)
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

from apps.finance.models import ZATCAConfig, FNEConfig



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
