from rest_framework import serializers
from apps.inventory.models import Unit, Category, Brand, Parfum, ProductGroup, Product, Warehouse, Inventory, InventoryMovement, ProductSerial, SerialLog, StockAdjustmentLine, StockAdjustmentOrder, StockTransferLine, StockTransferOrder, OperationalRequest, OperationalRequestLine, ComboComponent
from erp.models import Country, Site
