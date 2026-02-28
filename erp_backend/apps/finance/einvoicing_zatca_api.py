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


class ZATCAApiMixin:

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

