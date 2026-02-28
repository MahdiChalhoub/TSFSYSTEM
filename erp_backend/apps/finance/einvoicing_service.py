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


from .einvoicing_zatca_xml import ZATCAXMLMixin
from .einvoicing_zatca_crypto import ZATCACryptoMixin
from .einvoicing_zatca_api import ZATCAApiMixin
from .einvoicing_zatca_core import ZATCACoreMixin
from .einvoicing_fne import FNEService

class ZATCAService(ZATCAXMLMixin, ZATCACryptoMixin, ZATCAApiMixin, ZATCACoreMixin):

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
