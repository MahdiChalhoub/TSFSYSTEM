"""
Inventory Intelligence API Views
=================================

REST API endpoints for AI-powered inventory intelligence services.

Endpoints:
- Demand forecasting
- Reorder optimization
- Transfer analysis
- Order allocation
- ATP calculation
- ABC classification
- Stockout prediction

Architecture:
- Uses intelligence services
- Permission-based access
- Event-driven
- Audit logging
"""

import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import datetime, date

from kernel.rbac.decorators import require_permission
from kernel.tenancy.middleware import get_current_tenant
from apps.inventory.services.intelligence_service import InventoryIntelligenceService
from apps.inventory.services.transfer_intelligence_service import TransferIntelligenceService
from apps.inventory.services.fulfillment_intelligence_service import FulfillmentIntelligenceService

logger = logging.getLogger(__name__)


class IntelligenceViewSet(viewsets.ViewSet):
    """
    Inventory Intelligence API Endpoints

    Provides AI-powered analytics and decision support
    """
    permission_classes = [IsAuthenticated]

    def get_organization(self, request):
        """Get current organization from request"""
        return get_current_tenant() or request.user.organization

    @action(detail=False, methods=['post'], url_path='forecast-demand')
    def forecast_demand(self, request):
        """
        POST /api/inventory/intelligence/forecast-demand/

        Forecast product demand using ML

        Body:
        {
            "product_id": 123,
            "days_ahead": 30,
            "warehouse_id": 1 (optional)
        }

        Returns:
        {
            "success": true,
            "forecast_quantity": 250,
            "confidence": 0.85,
            "daily_average": 8.3,
            "recommendations": [...]
        }
        """
        organization = self.get_organization(request)

        product_id = request.data.get('product_id')
        days_ahead = request.data.get('days_ahead', 30)
        warehouse_id = request.data.get('warehouse_id')

        if not product_id:
            return Response(
                {'error': 'product_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = InventoryIntelligenceService(organization)
            result = service.forecast_demand(
                product_id=product_id,
                days_ahead=days_ahead,
                warehouse_id=warehouse_id
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Demand forecast error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='optimize-reorder')
    def optimize_reorder(self, request):
        """
        POST /api/inventory/intelligence/optimize-reorder/

        Calculate optimal reorder point

        Body:
        {
            "product_id": 123,
            "warehouse_id": 1 (optional)
        }

        Returns:
        {
            "success": true,
            "optimal_reorder_point": 85,
            "safety_stock": 35,
            "current_reorder_point": 50,
            "recommended_change": 70
        }
        """
        organization = self.get_organization(request)

        product_id = request.data.get('product_id')
        warehouse_id = request.data.get('warehouse_id')

        if not product_id:
            return Response(
                {'error': 'product_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = InventoryIntelligenceService(organization)
            result = service.optimize_reorder_point(
                product_id=product_id,
                warehouse_id=warehouse_id
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Reorder optimization error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='classify-abc')
    def classify_abc(self, request):
        """
        GET /api/inventory/intelligence/classify-abc/

        Classify all products using ABC analysis

        Query params:
        - warehouse_id (optional)

        Returns:
        {
            "success": true,
            "classifications": {
                "A": {"count": 50, "products": [...]},
                "B": {"count": 150, "products": [...]},
                "C": {"count": 300, "products": [...]}
            }
        }
        """
        organization = self.get_organization(request)
        warehouse_id = request.query_params.get('warehouse_id')

        try:
            service = InventoryIntelligenceService(organization)
            result = service.classify_products_abc(warehouse_id=warehouse_id)

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"ABC classification error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='stockout-risk')
    def stockout_risk(self, request):
        """
        POST /api/inventory/intelligence/stockout-risk/

        Predict stockout risk

        Body:
        {
            "product_id": 123,
            "warehouse_id": 1 (optional),
            "days_ahead": 7
        }

        Returns:
        {
            "success": true,
            "risk_level": "HIGH",
            "stockout_probability": 0.8,
            "days_until_stockout": 3.5,
            "recommendations": [...]
        }
        """
        organization = self.get_organization(request)

        product_id = request.data.get('product_id')
        warehouse_id = request.data.get('warehouse_id')
        days_ahead = request.data.get('days_ahead', 7)

        if not product_id:
            return Response(
                {'error': 'product_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = InventoryIntelligenceService(organization)
            result = service.predict_stockout_risk(
                product_id=product_id,
                warehouse_id=warehouse_id,
                days_ahead=days_ahead
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Stockout risk prediction error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='analyze-transfer')
    def analyze_transfer(self, request):
        """
        POST /api/inventory/intelligence/analyze-transfer/

        DECISION-GRADE transfer analysis with complete cost breakdown

        Body:
        {
            "product_id": 123,
            "from_warehouse_id": 1,
            "to_warehouse_id": 2,
            "quantity": 100,
            "reason": "Stock rebalancing" (optional)
        }

        Returns:
        {
            "success": true,
            "cost_analysis": {
                "breakdown": {...},
                "total_cost": 99.50
            },
            "opportunity_cost_analysis": {
                "total_opportunity_cost": 80.00
            },
            "stock_impact": {...},
            "route_analysis": {...},
            "approval_recommendation": {
                "decision": "AUTO_APPROVE",
                "confidence": 0.92
            },
            "transfer_score": 85,
            "executive_summary": "..."
        }
        """
        organization = self.get_organization(request)

        product_id = request.data.get('product_id')
        from_warehouse_id = request.data.get('from_warehouse_id')
        to_warehouse_id = request.data.get('to_warehouse_id')
        quantity = request.data.get('quantity')
        reason = request.data.get('reason')

        # Validation
        if not all([product_id, from_warehouse_id, to_warehouse_id, quantity]):
            return Response(
                {'error': 'product_id, from_warehouse_id, to_warehouse_id, and quantity are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = TransferIntelligenceService(organization)
            result = service.analyze_transfer_request(
                product_id=product_id,
                from_warehouse_id=from_warehouse_id,
                to_warehouse_id=to_warehouse_id,
                quantity=float(quantity),
                reason=reason
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Transfer analysis error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='calculate-atp')
    def calculate_atp(self, request):
        """
        POST /api/inventory/intelligence/calculate-atp/

        Calculate Available-to-Promise

        Body:
        {
            "product_id": 123,
            "quantity": 100,
            "required_date": "2026-03-20" (optional),
            "warehouse_id": 1 (optional)
        }

        Returns:
        {
            "success": true,
            "atp": {
                "available_quantity": 75,
                "can_fulfill": false,
                "available_date": "2026-03-18",
                "confidence": 0.85
            },
            "breakdown": {...},
            "recommendations": [...]
        }
        """
        organization = self.get_organization(request)

        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity')
        required_date = request.data.get('required_date')
        warehouse_id = request.data.get('warehouse_id')

        if not all([product_id, quantity]):
            return Response(
                {'error': 'product_id and quantity are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse date
        if required_date:
            try:
                required_date = datetime.strptime(required_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'required_date must be in format YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            service = FulfillmentIntelligenceService(organization)
            result = service.calculate_atp(
                product_id=product_id,
                quantity=float(quantity),
                required_date=required_date,
                warehouse_id=warehouse_id
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"ATP calculation error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='optimize-allocation')
    def optimize_allocation(self, request):
        """
        POST /api/inventory/intelligence/optimize-allocation/

        Smart order allocation across warehouses

        Body:
        {
            "order_items": [
                {"product_id": 100, "quantity": 50},
                {"product_id": 200, "quantity": 30}
            ],
            "customer_location": {
                "lat": 40.7128,
                "lng": -74.0060
            } (optional),
            "priority": "STANDARD|URGENT|CRITICAL",
            "constraints": {
                "preferred_warehouse_id": 1
            } (optional)
        }

        Returns:
        {
            "success": true,
            "allocation_plan": [...],
            "metrics": {
                "total_cost": 245.50,
                "fulfillment_score": 92
            }
        }
        """
        organization = self.get_organization(request)

        order_items = request.data.get('order_items', [])
        customer_location = request.data.get('customer_location')
        priority = request.data.get('priority', 'STANDARD')
        constraints = request.data.get('constraints')

        if not order_items:
            return Response(
                {'error': 'order_items is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = FulfillmentIntelligenceService(organization)
            result = service.optimize_allocation(
                order_items=order_items,
                customer_location=customer_location,
                priority=priority,
                constraints=constraints
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Allocation optimization error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='optimize-backorders')
    def optimize_backorders(self, request):
        """
        GET /api/inventory/intelligence/optimize-backorders/

        Analyze and optimize backorders

        Query params:
        - warehouse_id (optional)

        Returns:
        {
            "success": true,
            "backorders_count": 10,
            "recommendations": [...]
        }
        """
        organization = self.get_organization(request)
        warehouse_id = request.query_params.get('warehouse_id')

        try:
            service = FulfillmentIntelligenceService(organization)
            result = service.optimize_backorders(warehouse_id=warehouse_id)

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Backorder optimization error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
