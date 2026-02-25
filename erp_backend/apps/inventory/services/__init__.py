from .base import InventoryBaseService
from .stock_service import StockService
from .valuation_service import InventoryValuationService
from .serial_service import SerialService
from .order_service import OrderService
from .analysis_service import AnalysisService

class InventoryService:
    # Stock Operations
    calculate_effective_cost = staticmethod(InventoryBaseService.calculate_effective_cost)
    receive_stock = staticmethod(StockService.receive_stock)
    adjust_stock = staticmethod(StockService.adjust_stock)
    reduce_stock = staticmethod(StockService.reduce_stock)
    transfer_stock = staticmethod(StockService.transfer_stock)
    
    # Valuation Operations
    get_inventory_valuation = staticmethod(InventoryValuationService.get_inventory_valuation)
    get_inventory_financial_status = staticmethod(InventoryValuationService.get_inventory_financial_status)
    reconcile_with_finance = staticmethod(InventoryValuationService.reconcile_with_finance)
    sync_inventory_to_ledger = staticmethod(InventoryValuationService.sync_inventory_to_ledger)
    record_stock_in = staticmethod(InventoryValuationService.record_stock_in)
    record_stock_out = staticmethod(InventoryValuationService.record_stock_out)
    check_expiry_alerts = staticmethod(InventoryValuationService.check_expiry_alerts)
    get_stock_valuation_summary = staticmethod(InventoryValuationService.get_stock_valuation_summary)
    
    # Serial Operations
    register_serial_entry = staticmethod(SerialService.register_serial_entry)
    register_serial_exit = staticmethod(SerialService.register_serial_exit)
    
    # Order Processing
    process_adjustment_order = staticmethod(OrderService.process_adjustment_order)
    process_transfer_order = staticmethod(OrderService.process_transfer_order)
    
    # Analytics
    get_purchase_suggestions = staticmethod(AnalysisService.get_purchase_suggestions)

__all__ = ['InventoryService']
