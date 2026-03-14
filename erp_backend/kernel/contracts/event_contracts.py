"""
Event Contracts Registry
========================
Centralized registry of all cross-module event contracts in TSFSYSTEM.

Each contract defines:
- Event name
- Payload schema (JSON Schema format)
- Producer module
- Consumer modules
- Version
- Description

Usage:
    from kernel.contracts.event_contracts import register_all_contracts
    register_all_contracts()
"""

from typing import Dict, List, Any
from .registry import ContractRegistry


# =============================================================================
# PROVISIONING EVENTS
# =============================================================================

def register_provisioning_contracts():
    """Register contracts for organization provisioning events"""

    ContractRegistry.register(
        name='org:provisioned',
        schema={
            'type': 'object',
            'required': ['org_id', 'org_name', 'site_id'],
            'properties': {
                'org_id': {
                    'type': 'integer',
                    'description': 'Organization (organization) ID'
                },
                'org_name': {
                    'type': 'string',
                    'description': 'Organization name'
                },
                'site_id': {
                    'type': 'integer',
                    'description': 'Default site ID for this organization'
                },
                'admin_user_id': {
                    'type': 'integer',
                    'description': 'Admin user ID (optional)'
                }
            }
        },
        category='EVENT',
        owner_module='core',
        version='1.0.0',
        description='Emitted when a new organization (organization) is provisioned',
        producer='core',
        consumers=['finance', 'inventory', 'crm', 'hr']
    )


# =============================================================================
# FINANCE EVENTS
# =============================================================================

def register_finance_contracts():
    """Register contracts for finance module events"""

    ContractRegistry.register(
        name='invoice.created',
        schema={
            'type': 'object',
            'required': ['invoice_id', 'customer_id', 'total_amount', 'currency', 'organization_id'],
            'properties': {
                'invoice_id': {
                    'type': 'integer',
                    'description': 'Invoice ID'
                },
                'customer_id': {
                    'type': 'integer',
                    'description': 'Customer contact ID'
                },
                'total_amount': {
                    'type': 'number',
                    'description': 'Total invoice amount including tax'
                },
                'net_amount': {
                    'type': 'number',
                    'description': 'Net amount before tax'
                },
                'tax_amount': {
                    'type': 'number',
                    'description': 'Tax amount'
                },
                'currency': {
                    'type': 'string',
                    'pattern': '^[A-Z]{3}$',
                    'description': 'ISO 4217 currency code'
                },
                'invoice_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'Invoice date (YYYY-MM-DD)'
                },
                'due_date': {
                    'type': 'string',
                    'format': 'date',
                    'description': 'Payment due date'
                },
                'reference': {
                    'type': 'string',
                    'description': 'Invoice reference number'
                },
                'organization_id': {
                    'type': 'integer',
                    'description': 'Tenant organization ID'
                }
            }
        },
        category='EVENT',
        owner_module='finance',
        version='1.0.0',
        description='Emitted when an invoice is created',
        producer='finance',
        consumers=['notifications', 'reporting', 'accounting']
    )

    ContractRegistry.register(
        name='invoice.paid',
        schema={
            'type': 'object',
            'required': ['invoice_id', 'amount_paid', 'payment_date', 'organization_id'],
            'properties': {
                'invoice_id': {'type': 'integer'},
                'amount_paid': {'type': 'number'},
                'payment_method': {
                    'type': 'string',
                    'enum': ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER']
                },
                'payment_date': {'type': 'string', 'format': 'date-time'},
                'reference': {'type': 'string'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='finance',
        version='1.0.0',
        description='Emitted when an invoice is paid',
        producer='finance',
        consumers=['notifications', 'reporting']
    )

    ContractRegistry.register(
        name='invoice.voided',
        schema={
            'type': 'object',
            'required': ['invoice_id', 'void_reason', 'organization_id'],
            'properties': {
                'invoice_id': {'type': 'integer'},
                'void_reason': {'type': 'string'},
                'voided_by': {'type': 'integer', 'description': 'User ID'},
                'voided_at': {'type': 'string', 'format': 'date-time'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='finance',
        version='1.0.0',
        description='Emitted when an invoice is voided/cancelled',
        producer='finance',
        consumers=['inventory', 'reporting']
    )

    ContractRegistry.register(
        name='payment.received',
        schema={
            'type': 'object',
            'required': ['payment_id', 'amount', 'customer_id', 'organization_id'],
            'properties': {
                'payment_id': {'type': 'integer'},
                'amount': {'type': 'number'},
                'customer_id': {'type': 'integer'},
                'invoice_id': {'type': 'integer', 'description': 'Optional linked invoice'},
                'payment_method': {
                    'type': 'string',
                    'enum': ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER']
                },
                'reference': {'type': 'string'},
                'received_at': {'type': 'string', 'format': 'date-time'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='finance',
        version='1.0.0',
        description='Emitted when a payment is received',
        producer='finance',
        consumers=['pos', 'notifications']
    )


# =============================================================================
# INVENTORY EVENTS
# =============================================================================

def register_inventory_contracts():
    """Register contracts for inventory module events"""

    ContractRegistry.register(
        name='inventory.stock_changed',
        schema={
            'type': 'object',
            'required': ['product_id', 'warehouse_id', 'old_quantity', 'new_quantity', 'organization_id'],
            'properties': {
                'product_id': {'type': 'integer'},
                'warehouse_id': {'type': 'integer'},
                'old_quantity': {'type': 'number'},
                'new_quantity': {'type': 'number'},
                'change_quantity': {'type': 'number', 'description': 'Difference (new - old)'},
                'reason': {
                    'type': 'string',
                    'enum': ['SALE', 'PURCHASE', 'ADJUSTMENT', 'TRANSFER', 'RETURN']
                },
                'reference': {'type': 'string'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='inventory',
        version='1.0.0',
        description='Emitted when inventory stock level changes',
        producer='inventory',
        consumers=['finance', 'notifications', 'reporting']
    )

    ContractRegistry.register(
        name='inventory.low_stock',
        schema={
            'type': 'object',
            'required': ['product_id', 'current_quantity', 'threshold', 'organization_id'],
            'properties': {
                'product_id': {'type': 'integer'},
                'product_name': {'type': 'string'},
                'current_quantity': {'type': 'number'},
                'threshold': {'type': 'number', 'description': 'Minimum stock level'},
                'warehouse_id': {'type': 'integer'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='inventory',
        version='1.0.0',
        description='Emitted when product stock falls below threshold',
        producer='inventory',
        consumers=['pos', 'notifications', 'purchasing']
    )

    ContractRegistry.register(
        name='inventory.adjusted',
        schema={
            'type': 'object',
            'required': ['order_id', 'total_amount', 'organization_id'],
            'properties': {
                'order_id': {'type': 'integer'},
                'total_amount': {'type': 'number'},
                'reference': {'type': 'string'},
                'date': {'type': 'string', 'format': 'date'},
                'scope': {
                    'type': 'string',
                    'enum': ['OFFICIAL', 'INTERNAL'],
                    'default': 'OFFICIAL'
                },
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='inventory',
        version='1.0.0',
        description='Emitted when inventory is adjusted (stocktake, corrections)',
        producer='inventory',
        consumers=['finance']
    )


# =============================================================================
# POS / SALES EVENTS
# =============================================================================

def register_sales_contracts():
    """Register contracts for sales/POS events"""

    ContractRegistry.register(
        name='order.completed',
        schema={
            'type': 'object',
            'required': ['order_id', 'type', 'total_amount', 'lines', 'organization_id'],
            'properties': {
                'order_id': {'type': 'integer'},
                'type': {
                    'type': 'string',
                    'enum': ['SALE', 'PURCHASE'],
                    'description': 'Order type'
                },
                'total_amount': {'type': 'number'},
                'tax_amount': {'type': 'number'},
                'reference': {'type': 'string'},
                'date': {'type': 'string', 'format': 'date-time'},
                'contact_id': {
                    'type': 'integer',
                    'description': 'Customer or supplier contact ID'
                },
                'warehouse_id': {'type': 'integer'},
                'scope': {
                    'type': 'string',
                    'enum': ['OFFICIAL', 'INTERNAL'],
                    'default': 'OFFICIAL'
                },
                'lines': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'required': ['product_id', 'quantity'],
                        'properties': {
                            'product_id': {'type': 'integer'},
                            'quantity': {'type': 'number'},
                            'unit_price': {'type': 'number'},
                            'cost_price': {'type': 'number'},
                            'tax_rate': {'type': 'number'},
                            'line_total': {'type': 'number'}
                        }
                    }
                },
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='pos',
        version='1.0.0',
        description='Emitted when a POS order (sale or purchase) is completed',
        producer='pos',
        consumers=['finance', 'inventory', 'reporting']
    )

    ContractRegistry.register(
        name='order.voided',
        schema={
            'type': 'object',
            'required': ['order_id', 'type', 'lines', 'organization_id'],
            'properties': {
                'order_id': {'type': 'integer'},
                'type': {'type': 'string', 'enum': ['SALE', 'PURCHASE']},
                'void_reason': {'type': 'string'},
                'voided_by': {'type': 'integer'},
                'warehouse_id': {'type': 'integer'},
                'lines': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'product_id': {'type': 'integer'},
                            'quantity': {'type': 'number'}
                        }
                    }
                },
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='pos',
        version='1.0.0',
        description='Emitted when an order is voided/cancelled',
        producer='pos',
        consumers=['inventory', 'finance']
    )


# =============================================================================
# PURCHASING EVENTS
# =============================================================================

def register_purchasing_contracts():
    """Register contracts for purchasing events"""

    ContractRegistry.register(
        name='purchase_order.created',
        schema={
            'type': 'object',
            'required': ['po_id', 'supplier_id', 'total_amount', 'organization_id'],
            'properties': {
                'po_id': {'type': 'integer'},
                'po_number': {'type': 'string'},
                'supplier_id': {'type': 'integer'},
                'total_amount': {'type': 'number'},
                'expected_delivery_date': {'type': 'string', 'format': 'date'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='purchasing',
        version='1.0.0',
        description='Emitted when a purchase order is created',
        producer='purchasing',
        consumers=['finance', 'notifications']
    )

    ContractRegistry.register(
        name='purchase_order.received',
        schema={
            'type': 'object',
            'required': ['po_id', 'po_number', 'lines', 'organization_id'],
            'properties': {
                'po_id': {'type': 'integer'},
                'po_number': {'type': 'string'},
                'supplier_id': {'type': 'integer'},
                'warehouse_id': {'type': 'integer'},
                'received_date': {'type': 'string', 'format': 'date'},
                'scope': {'type': 'string', 'enum': ['OFFICIAL', 'INTERNAL']},
                'lines': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'required': ['product_id', 'qty_received', 'unit_price'],
                        'properties': {
                            'line_id': {'type': 'integer'},
                            'product_id': {'type': 'integer'},
                            'qty_ordered': {'type': 'number'},
                            'qty_received': {'type': 'number'},
                            'unit_price': {'type': 'number'}
                        }
                    }
                },
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='purchasing',
        version='1.0.0',
        description='Emitted when goods from a purchase order are received',
        producer='purchasing',
        consumers=['inventory', 'finance']
    )


# =============================================================================
# CRM EVENTS
# =============================================================================

def register_crm_contracts():
    """Register contracts for CRM events"""

    ContractRegistry.register(
        name='contact.created',
        schema={
            'type': 'object',
            'required': ['contact_id', 'contact_name', 'organization_id'],
            'properties': {
                'contact_id': {'type': 'integer'},
                'contact_name': {'type': 'string'},
                'contact_type': {
                    'type': 'string',
                    'enum': ['CUSTOMER', 'SUPPLIER', 'BOTH', 'OTHER']
                },
                'email': {'type': 'string', 'format': 'email'},
                'phone': {'type': 'string'},
                'saas_org_id': {
                    'type': 'integer',
                    'description': 'For SaaS billing contacts'
                },
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='crm',
        version='1.0.0',
        description='Emitted when a new contact is created',
        producer='crm',
        consumers=['finance', 'notifications']
    )

    ContractRegistry.register(
        name='contact.updated',
        schema={
            'type': 'object',
            'required': ['contact_id', 'organization_id'],
            'properties': {
                'contact_id': {'type': 'integer'},
                'updated_fields': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='crm',
        version='1.0.0',
        description='Emitted when a contact is updated',
        producer='crm',
        consumers=['finance']
    )

    ContractRegistry.register(
        name='contact.interaction_recorded',
        schema={
            'type': 'object',
            'required': ['contact_id', 'user_id', 'outcome', 'channel', 'organization_id'],
            'properties': {
                'contact_id': {'type': 'integer'},
                'user_id': {'type': 'integer'},
                'outcome': {'type': 'string'},
                'channel': {'type': 'string'},
                'contact_name': {'type': 'string'},
                'outcome_label': {'type': 'string'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='crm',
        version='1.0.0',
        description='Emitted when an interaction (call, visit, etc.) is recorded',
        producer='crm',
        consumers=['hr', 'notifications', 'reporting']
    )

    ContractRegistry.register(
        name='contact.type_converted',
        schema={
            'type': 'object',
            'required': ['contact_id', 'old_type', 'new_type', 'organization_id'],
            'properties': {
                'contact_id': {'type': 'integer'},
                'old_type': {'type': 'string'},
                'new_type': {'type': 'string'},
                'user_id': {'type': 'integer'},
                'contact_name': {'type': 'string'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='crm',
        version='1.0.0',
        description='Emitted when a contact type is converted (e.g. Lead -> Customer)',
        producer='crm',
        consumers=['finance', 'hr', 'reporting']
    )


# =============================================================================
# SUBSCRIPTION / SAAS EVENTS
# =============================================================================

def register_subscription_contracts():
    """Register contracts for subscription/SaaS events"""

    ContractRegistry.register(
        name='subscription.renewed',
        schema={
            'type': 'object',
            'required': ['subscription_id', 'organization_id', 'renewal_date'],
            'properties': {
                'subscription_id': {'type': 'integer'},
                'organization_id': {'type': 'integer'},
                'plan_name': {'type': 'string'},
                'amount': {'type': 'number'},
                'renewal_date': {'type': 'string', 'format': 'date'},
                'next_renewal_date': {'type': 'string', 'format': 'date'}
            }
        },
        category='EVENT',
        owner_module='subscriptions',
        version='1.0.0',
        description='Emitted when a subscription is renewed',
        producer='subscriptions',
        consumers=['finance', 'notifications']
    )

    ContractRegistry.register(
        name='subscription.updated',
        schema={
            'type': 'object',
            'required': ['type', 'amount', 'description', 'target_org_id', 'organization_id'],
            'properties': {
                'type': {
                    'type': 'string',
                    'enum': ['PURCHASE', 'CREDIT_NOTE'],
                    'description': 'Transaction type'
                },
                'amount': {'type': 'number'},
                'description': {'type': 'string'},
                'target_org_id': {
                    'type': 'integer',
                    'description': 'Tenant that purchased/credited'
                },
                'organization_id': {
                    'type': 'integer',
                    'description': 'SaaS provider org ID'
                }
            }
        },
        category='EVENT',
        owner_module='subscriptions',
        version='1.0.0',
        description='Emitted when subscription is purchased or credited',
        producer='subscriptions',
        consumers=['finance']
    )


# =============================================================================
# REGISTRY INITIALIZATION
# =============================================================================

def register_all_contracts():
    """
    Register all event contracts in the system.

    Call this during application startup (e.g., in AppConfig.ready())
    """
    ContractRegistry.register(
        name='inventory.low_stock',
        schema={
            'type': 'object',
            'required': ['product_id', 'organization_id'],
            'properties': {
                'product_id': {'type': 'integer'},
                'product_name': {'type': 'string'},
                'amount': {'type': 'number'},
                'threshold': {'type': 'number'},
                'reorder_qty': {'type': 'number'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='inventory',
        version='1.0.0',
        description='Emitted when stock level falls below threshold',
        producer='inventory',
        consumers=['procurement', 'notifications', 'reporting']
    )

    ContractRegistry.register(
        name='inventory.negative_stock',
        schema={
            'type': 'object',
            'required': ['product_id', 'organization_id'],
            'properties': {
                'product_id': {'type': 'integer'},
                'product_name': {'type': 'string'},
                'amount': {'type': 'number'},
                'organization_id': {'type': 'integer'}
            }
        },
        category='EVENT',
        owner_module='inventory',
        version='1.0.0',
        description='Emitted when stock level becomes zero or negative',
        producer='inventory',
        consumers=['procurement', 'notifications', 'reporting']
    )
    register_provisioning_contracts()
    register_finance_contracts()
    register_inventory_contracts()
    register_sales_contracts()
    register_purchasing_contracts()
    register_crm_contracts()
    register_subscription_contracts()


def get_all_contracts() -> Dict[str, Dict[str, Any]]:
    """Get all registered contracts"""
    return ContractRegistry.get_all()


def get_contracts_by_module(module_name: str) -> List[Dict[str, Any]]:
    """Get all contracts owned by a specific module"""
    all_contracts = get_all_contracts()
    return [
        {'name': name, **contract}
        for name, contract in all_contracts.items()
        if contract.get('owner_module') == module_name
    ]


def get_producer_contracts(module_name: str) -> List[str]:
    """Get list of event names that a module produces"""
    all_contracts = get_all_contracts()
    return [
        name
        for name, contract in all_contracts.items()
        if contract.get('producer') == module_name
    ]


def get_consumer_contracts(module_name: str) -> List[str]:
    """Get list of event names that a module consumes"""
    all_contracts = get_all_contracts()
    return [
        name
        for name, contract in all_contracts.items()
        if module_name in contract.get('consumers', [])
    ]
