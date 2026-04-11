from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

# Connector Governance Layer — all cross-module access goes through here
from erp.connector_registry import connector

class InventoryBaseService:
    @staticmethod
    def calculate_effective_cost(cost_price_ht, tva_rate, is_tax_recoverable):
        ht = Decimal(str(cost_price_ht))
        rate = Decimal(str(tva_rate))
        if is_tax_recoverable: return ht
        return ht * (Decimal('1') + rate)
