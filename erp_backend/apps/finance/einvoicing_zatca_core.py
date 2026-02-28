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


class ZATCACoreMixin:

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

