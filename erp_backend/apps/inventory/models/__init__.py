from .product_models import (
    Unit, UnitPackage, PackagingSuggestionRule,
    Category, Brand, Parfum, ProductGroup, Product,
    ProductAttribute, ProductAttributeValue, ProductVariant, ComboComponent,
    ProductPackaging
)
from .warehouse_models import Warehouse, Inventory, InventoryMovement
from .order_models import (
    StockAdjustmentOrder, StockAdjustmentLine,
    StockTransferOrder, StockTransferLine
)
from .request_models import OperationalRequest, OperationalRequestLine
from .advanced_models import (
    ProductBatch, ProductSerial, SerialLog, ExpiryAlert, StockValuationEntry
)
from .counting_models import InventorySession, InventorySessionLine, CycleCountPolicy
from .alert_models import StockAlert, StockAlertService
from .location_models import (
    WarehouseZone, WarehouseAisle, WarehouseRack, WarehouseShelf, WarehouseBin, ProductLocation
)
from .stock_ledger_model import StockLedger
from .stock_move_model import StockMove, StockMoveLine

# ── ERP Hardening Models ────────────────────────────────────────────────────
from .cost_layer_models import StockCostLayer, CostLayerConsumption
from .snapshot_models import InventoryBalance, InventoryBalanceHistory, InventoryFreezePeriod
from .reason_models import AdjustmentReason
from .unit_conversion_models import UnitConversion
from .replenishment_models import ReplenishmentRule, PurchaseSuggestion
from .fulfillment_models import PickList, PickListLine, PackingOrder, Shipment
from .goods_receipt_models import GoodsReceipt, GoodsReceiptLine
from .governance_models import PriceChangeRequest, ProductAuditTrail, PriceApprovalPolicy
from .task_models import ProductTask
from .barcode_models import BarcodePolicy, ProductBarcode
from .barcode_change_request import BarcodeChangeRequest
from .category_rule_models import CategoryCreationRule
from .label_models import LabelPolicy, LabelRecord, LabelTemplate, PrinterConfig, PrintSession, PrintSessionItem
from .readiness_models import ProductReadiness
from .fresh_models import WeightedProductPolicy, ProductFreshProfile
from .grouping_models import GroupingRule, InventoryGroup, InventoryGroupMember
# ── Cross-cutting business events (moved from tax engine) ───────
from .gift_sample_models import GiftSampleEvent
from .internal_consumption_models import InternalConsumptionEvent
from .scope_ai_models import AIScopeSuggesterConfig, AIScopeReview, AICategoryRuleReview

__all__ = [
    # Product Catalog
    'Unit', 'UnitPackage', 'PackagingSuggestionRule',
    'Category', 'Brand', 'Parfum', 'ProductGroup', 'Product',
    'ProductAttribute', 'ProductAttributeValue', 'ProductVariant', 'ComboComponent',
    'ProductPackaging',
    # Warehouse & Stock
    'Warehouse', 'Inventory', 'InventoryMovement',
    'StockAdjustmentOrder', 'StockAdjustmentLine',
    'StockTransferOrder', 'StockTransferLine',
    'OperationalRequest', 'OperationalRequestLine',
    # Traceability
    'ProductBatch', 'ProductSerial', 'SerialLog', 'ExpiryAlert', 'StockValuationEntry',
    # Counting
    'InventorySession', 'InventorySessionLine', 'CycleCountPolicy',
    # Alerts
    'StockAlert', 'StockAlertService',
    # Location System
    'WarehouseZone', 'WarehouseAisle', 'WarehouseRack', 'WarehouseShelf', 'WarehouseBin', 'ProductLocation',
    # Ledger & Moves
    'StockLedger',
    'StockMove', 'StockMoveLine',
    # ERP Hardening
    'StockCostLayer', 'CostLayerConsumption',
    'InventoryBalance', 'InventoryBalanceHistory', 'InventoryFreezePeriod',
    'AdjustmentReason',
    'UnitConversion',
    'ReplenishmentRule', 'PurchaseSuggestion',
    'PickList', 'PickListLine', 'PackingOrder', 'Shipment',
    # Goods Receipt
    'GoodsReceipt', 'GoodsReceiptLine',
    # Product Governance
    'PriceChangeRequest', 'ProductAuditTrail', 'PriceApprovalPolicy',
    # Task Engine
    'ProductTask',
    # Barcode Governance
    'BarcodePolicy', 'ProductBarcode', 'BarcodeChangeRequest',
    # Category Rules
    'CategoryCreationRule',
    # Label Governance
    'LabelPolicy', 'LabelRecord',
    # Printing Center
    'LabelTemplate', 'PrinterConfig', 'PrintSession', 'PrintSessionItem',
    # Operational Readiness
    'ProductReadiness',
    # Fresh / Weighted Products
    'WeightedProductPolicy', 'ProductFreshProfile',
    # Product Grouping (InventoryGroup)
    'GroupingRule', 'InventoryGroup', 'InventoryGroupMember',
    # Business Events (moved from tax engine)
    'GiftSampleEvent', 'InternalConsumptionEvent',
    # AI scope-suggester (Phase 6) + category-rule suggester (Phase 7)
    'AIScopeSuggesterConfig', 'AIScopeReview', 'AICategoryRuleReview',
]
