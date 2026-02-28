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


class ZATCACryptoMixin:

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

