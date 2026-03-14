"""
Recommendation Engine
====================

Generates recommendations by scoring and ranking options.

Use cases:
- Warehouse selection for order fulfillment
- Transfer route optimization
- Supplier selection
- Product recommendations
"""

import logging
from decimal import Decimal
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class RecommendationEngine:
    """
    Multi-criteria recommendation engine

    Scores options based on weighted criteria and returns ranked list
    """

    def __init__(self, organization):
        self.organization = organization

    def rank_options(
        self,
        context: str,
        options: List[Dict[str, Any]],
        criteria: Dict[str, float],
        normalize: bool = True
    ) -> Dict[str, Any]:
        """
        Rank options using multi-criteria scoring

        Args:
            context: Context for recommendations (e.g., 'warehouse_selection')
            options: List of options to evaluate
            criteria: Scoring criteria with weights (must sum to 1.0)
                     Example: {'cost': 0.4, 'distance': 0.3, 'stock_level': 0.3}
            normalize: Whether to normalize scores to 0-1 range

        Returns:
            Dict with ranked recommendations
        """
        if not options:
            return {
                'success': False,
                'message': 'No options provided',
                'recommendations': []
            }

        if not criteria:
            return {
                'success': False,
                'message': 'No criteria provided',
                'recommendations': []
            }

        # Validate criteria weights sum to 1.0
        total_weight = sum(criteria.values())
        if abs(total_weight - 1.0) > 0.01:
            logger.warning(
                f"Criteria weights sum to {total_weight}, normalizing to 1.0"
            )
            criteria = {k: v / total_weight for k, v in criteria.items()}

        # Score each option
        scored_options = []

        for idx, option in enumerate(options):
            try:
                score_details = self._score_option(option, criteria, normalize)
                scored_options.append({
                    'option_index': idx,
                    'option': option,
                    'total_score': score_details['total_score'],
                    'score_breakdown': score_details['breakdown'],
                    'confidence': score_details.get('confidence', 0.8)
                })
            except Exception as e:
                logger.error(f"Error scoring option {idx}: {e}")
                continue

        # Sort by score (descending)
        scored_options.sort(key=lambda x: x['total_score'], reverse=True)

        # Add rank
        for rank, option in enumerate(scored_options, 1):
            option['rank'] = rank

        return {
            'success': True,
            'context': context,
            'criteria': criteria,
            'recommendations': scored_options,
            'best_option': scored_options[0] if scored_options else None
        }

    def _score_option(
        self,
        option: Dict[str, Any],
        criteria: Dict[str, float],
        normalize: bool
    ) -> Dict[str, Any]:
        """
        Calculate total score for an option

        Returns score and breakdown by criterion
        """
        breakdown = {}
        total_score = 0.0

        # Collect all criterion values for normalization
        all_values = {}
        if normalize:
            # First pass: collect values
            for criterion in criteria.keys():
                value = option.get(criterion, 0)
                if criterion not in all_values:
                    all_values[criterion] = []
                all_values[criterion].append(value)

        # Calculate weighted scores
        for criterion, weight in criteria.items():
            raw_value = option.get(criterion, 0)

            # Handle None values
            if raw_value is None:
                raw_value = 0

            # Convert to float
            try:
                raw_value = float(raw_value)
            except (ValueError, TypeError):
                raw_value = 0.0

            # Normalize to 0-1 range if requested
            if normalize and criterion in all_values:
                values = all_values[criterion]
                min_val = min(values) if values else 0
                max_val = max(values) if values else 1

                if max_val > min_val:
                    # For cost/distance: lower is better (invert)
                    if criterion in ['cost', 'distance', 'lead_time', 'risk']:
                        normalized_value = 1.0 - ((raw_value - min_val) / (max_val - min_val))
                    else:
                        # For stock_level, quality, etc.: higher is better
                        normalized_value = (raw_value - min_val) / (max_val - min_val)
                else:
                    normalized_value = 0.5  # All values same
            else:
                normalized_value = raw_value

            # Apply weight
            weighted_score = normalized_value * weight

            breakdown[criterion] = {
                'raw_value': raw_value,
                'normalized_value': normalized_value,
                'weight': weight,
                'weighted_score': weighted_score
            }

            total_score += weighted_score

        return {
            'total_score': total_score,
            'breakdown': breakdown,
            'confidence': 0.8  # Can be adjusted based on data quality
        }

    def recommend_warehouse_for_order(
        self,
        order_details: Dict[str, Any],
        available_warehouses: List[Dict[str, Any]],
        custom_criteria: Dict[str, float] = None
    ) -> Dict[str, Any]:
        """
        Recommend best warehouse to fulfill an order

        Args:
            order_details: Order information (customer location, items, urgency)
            available_warehouses: List of warehouses with stock, location, costs
            custom_criteria: Custom scoring criteria (optional)

        Returns:
            Ranked warehouse recommendations
        """
        # Default criteria for warehouse selection
        default_criteria = {
            'distance': 0.3,      # Closer is better
            'cost': 0.3,          # Cheaper is better
            'stock_level': 0.2,   # More stock is better
            'fulfillment_rate': 0.2  # Higher rate is better
        }

        criteria = custom_criteria or default_criteria

        return self.rank_options(
            context='warehouse_selection',
            options=available_warehouses,
            criteria=criteria,
            normalize=True
        )

    def recommend_transfer_route(
        self,
        from_warehouse: Dict[str, Any],
        to_warehouse: Dict[str, Any],
        intermediate_warehouses: List[Dict[str, Any]],
        product: Dict[str, Any],
        quantity: float
    ) -> Dict[str, Any]:
        """
        Recommend optimal transfer route (direct or multi-hop)

        Args:
            from_warehouse: Source warehouse
            to_warehouse: Destination warehouse
            intermediate_warehouses: Possible intermediate warehouses
            product: Product being transferred
            quantity: Quantity to transfer

        Returns:
            Ranked route recommendations
        """
        routes = []

        # Option 1: Direct transfer
        direct_route = {
            'route_type': 'direct',
            'path': [from_warehouse['id'], to_warehouse['id']],
            'hops': 1,
            'total_distance': self._calculate_distance(
                from_warehouse['location'],
                to_warehouse['location']
            ),
            'estimated_cost': self._calculate_transfer_cost(
                from_warehouse,
                to_warehouse,
                product,
                quantity,
                direct=True
            ),
            'estimated_time': self._calculate_transfer_time(
                from_warehouse,
                to_warehouse,
                hops=1
            )
        }
        routes.append(direct_route)

        # Option 2+: Routes through intermediate warehouses
        for intermediate in intermediate_warehouses:
            # Check if this creates a viable route
            distance_1 = self._calculate_distance(
                from_warehouse['location'],
                intermediate['location']
            )
            distance_2 = self._calculate_distance(
                intermediate['location'],
                to_warehouse['location']
            )

            total_distance = distance_1 + distance_2

            # Only consider if not too much longer than direct
            if total_distance < direct_route['total_distance'] * 1.5:
                multi_hop_route = {
                    'route_type': 'multi_hop',
                    'path': [
                        from_warehouse['id'],
                        intermediate['id'],
                        to_warehouse['id']
                    ],
                    'hops': 2,
                    'total_distance': total_distance,
                    'estimated_cost': self._calculate_multi_hop_cost(
                        from_warehouse,
                        intermediate,
                        to_warehouse,
                        product,
                        quantity
                    ),
                    'estimated_time': self._calculate_transfer_time(
                        from_warehouse,
                        to_warehouse,
                        hops=2
                    )
                }
                routes.append(multi_hop_route)

        # Rank routes
        criteria = {
            'estimated_cost': 0.5,
            'estimated_time': 0.3,
            'total_distance': 0.2
        }

        return self.rank_options(
            context='transfer_route',
            options=routes,
            criteria=criteria,
            normalize=True
        )

    def _calculate_distance(self, loc1: Dict, loc2: Dict) -> float:
        """
        Calculate distance between two locations

        Uses Haversine formula for lat/lng, or Euclidean for x/y
        """
        if 'lat' in loc1 and 'lng' in loc1:
            # Haversine formula
            from math import radians, sin, cos, sqrt, atan2

            lat1, lng1 = radians(loc1['lat']), radians(loc1['lng'])
            lat2, lng2 = radians(loc2['lat']), radians(loc2['lng'])

            dlat = lat2 - lat1
            dlng = lng2 - lng1

            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))

            # Earth radius in km
            R = 6371

            return R * c

        elif 'x' in loc1 and 'y' in loc1:
            # Euclidean distance
            dx = loc2['x'] - loc1['x']
            dy = loc2['y'] - loc1['y']
            return sqrt(dx**2 + dy**2)

        else:
            # Default fallback
            return 100.0

    def _calculate_transfer_cost(
        self,
        from_wh: Dict,
        to_wh: Dict,
        product: Dict,
        quantity: float,
        direct: bool = True
    ) -> float:
        """Calculate estimated transfer cost"""
        # Get cost parameters from config
        from kernel.config import get_config

        shipping_rate_per_km = get_config(
            'inventory.transfer_cost.shipping_rate_per_km',
            default=0.50
        )
        handling_rate_per_unit = get_config(
            'inventory.transfer_cost.handling_rate_per_unit',
            default=0.10
        )

        distance = self._calculate_distance(
            from_wh.get('location', {}),
            to_wh.get('location', {})
        )

        shipping_cost = distance * shipping_rate_per_km
        handling_cost = quantity * handling_rate_per_unit

        return shipping_cost + handling_cost

    def _calculate_multi_hop_cost(
        self,
        from_wh: Dict,
        intermediate_wh: Dict,
        to_wh: Dict,
        product: Dict,
        quantity: float
    ) -> float:
        """Calculate cost for multi-hop transfer"""
        cost_1 = self._calculate_transfer_cost(from_wh, intermediate_wh, product, quantity)
        cost_2 = self._calculate_transfer_cost(intermediate_wh, to_wh, product, quantity)

        # Add extra handling cost for intermediate stop
        from kernel.config import get_config
        handling_rate = get_config(
            'inventory.transfer_cost.handling_rate_per_unit',
            default=0.10
        )

        intermediate_handling = quantity * handling_rate

        return cost_1 + cost_2 + intermediate_handling

    def _calculate_transfer_time(
        self,
        from_wh: Dict,
        to_wh: Dict,
        hops: int = 1
    ) -> float:
        """Calculate estimated transfer time in days"""
        from kernel.config import get_config

        # Base transit time per hop
        base_time_per_hop = get_config(
            'inventory.transfer_time.base_days_per_hop',
            default=2
        )

        # Processing time at each warehouse
        processing_time = get_config(
            'inventory.transfer_time.processing_days_per_warehouse',
            default=1
        )

        total_time = (hops * base_time_per_hop) + (hops * processing_time)

        return float(total_time)
