"""
Rule Engine
===========

Evaluates business rules defined in database.

Rule Types:
- THRESHOLD: Simple threshold checks (e.g., cost > $1000)
- FORMULA: Formula-based calculations
- ML: Machine learning model execution
- COMPOSITE: Combination of multiple rules
"""

import logging
import operator
from decimal import Decimal
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class RuleEngine:
    """
    Evaluates decision rules

    100% config-driven - all rule logic comes from database/config
    """

    def __init__(self, organization):
        self.organization = organization

        # Operator mapping for threshold rules
        self.operators = {
            '>': operator.gt,
            '>=': operator.ge,
            '<': operator.lt,
            '<=': operator.le,
            '==': operator.eq,
            '!=': operator.ne,
        }

    def apply_rule(self, rule, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply a decision rule to input data

        Args:
            rule: DecisionRule instance
            input_data: Input parameters

        Returns:
            Dict with decision result
        """
        try:
            if rule.rule_type == 'THRESHOLD':
                return self._apply_threshold_rule(rule, input_data)
            elif rule.rule_type == 'FORMULA':
                return self._apply_formula_rule(rule, input_data)
            elif rule.rule_type == 'ML':
                return self._apply_ml_rule(rule, input_data)
            elif rule.rule_type == 'COMPOSITE':
                return self._apply_composite_rule(rule, input_data)
            else:
                logger.warning(f"Unknown rule type: {rule.rule_type}")
                return {'success': False, 'decision': 'UNKNOWN', 'confidence': 0.0}

        except Exception as e:
            logger.error(f"Error applying rule {rule.name}: {e}", exc_info=True)
            return {
                'success': False,
                'decision': 'ERROR',
                'confidence': 0.0,
                'error': str(e)
            }

    def _apply_threshold_rule(self, rule, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply threshold-based rule

        Example config:
        {
            "field": "total_cost",
            "operator": ">",
            "threshold": 1000,
            "decision_if_true": "REQUIRE_APPROVAL",
            "decision_if_false": "AUTO_APPROVE"
        }
        """
        config = rule.config

        field = config.get('field')
        op = config.get('operator', '>')
        threshold = Decimal(str(config.get('threshold', 0)))

        # Get value from input data
        value = self._get_nested_value(input_data, field)

        if value is None:
            return {
                'success': False,
                'decision': 'MISSING_DATA',
                'confidence': 0.0,
                'message': f'Field {field} not found in input data'
            }

        # Convert to Decimal for comparison
        try:
            value = Decimal(str(value))
        except (ValueError, TypeError):
            return {
                'success': False,
                'decision': 'INVALID_DATA',
                'confidence': 0.0,
                'message': f'Field {field} is not numeric'
            }

        # Apply operator
        operator_func = self.operators.get(op)
        if not operator_func:
            return {
                'success': False,
                'decision': 'INVALID_OPERATOR',
                'confidence': 0.0
            }

        result = operator_func(value, threshold)

        decision = config.get('decision_if_true') if result else config.get('decision_if_false')
        confidence = config.get('confidence', 1.0)

        return {
            'success': True,
            'decision': decision,
            'confidence': float(confidence),
            'weight': rule.priority,
            'rule_name': rule.name,
            'details': {
                'field': field,
                'value': float(value),
                'operator': op,
                'threshold': float(threshold),
                'result': result
            }
        }

    def _apply_formula_rule(self, rule, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply formula-based rule

        Example config:
        {
            "formula": "total_cost / quantity",
            "result_field": "unit_cost",
            "thresholds": {
                "CHEAP": {"operator": "<", "value": 10},
                "EXPENSIVE": {"operator": ">=", "value": 10}
            }
        }
        """
        config = rule.config
        formula = config.get('formula')

        if not formula:
            return {'success': False, 'decision': 'NO_FORMULA', 'confidence': 0.0}

        # Safely evaluate formula
        result = self._evaluate_formula(formula, input_data)

        if result is None:
            return {
                'success': False,
                'decision': 'FORMULA_ERROR',
                'confidence': 0.0
            }

        # Check against thresholds
        thresholds = config.get('thresholds', {})
        for decision, threshold_config in thresholds.items():
            op = threshold_config.get('operator', '>')
            value = Decimal(str(threshold_config.get('value', 0)))
            operator_func = self.operators.get(op)

            if operator_func and operator_func(result, value):
                return {
                    'success': True,
                    'decision': decision,
                    'confidence': config.get('confidence', 0.8),
                    'weight': rule.priority,
                    'rule_name': rule.name,
                    'calculated_value': float(result)
                }

        return {
            'success': True,
            'decision': 'NO_MATCH',
            'confidence': 0.0,
            'calculated_value': float(result)
        }

    def _apply_ml_rule(self, rule, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply ML model-based rule

        Example config:
        {
            "model_name": "demand_forecast",
            "input_mapping": {
                "product_id": "product_id",
                "days": "forecast_days"
            },
            "decision_mapping": {
                "high": "INCREASE_REORDER",
                "medium": "MAINTAIN",
                "low": "REDUCE_REORDER"
            }
        }
        """
        config = rule.config
        model_name = config.get('model_name')

        if not model_name:
            return {'success': False, 'decision': 'NO_MODEL', 'confidence': 0.0}

        # Map input data to model features
        input_mapping = config.get('input_mapping', {})
        model_input = {}

        for model_field, input_field in input_mapping.items():
            value = self._get_nested_value(input_data, input_field)
            if value is not None:
                model_input[model_field] = value

        # Get ML prediction
        from .ml_registry import MLModelRegistry
        registry = MLModelRegistry(self.organization)

        try:
            prediction = registry.predict(model_name, model_input)

            if not prediction.get('success', False):
                return {
                    'success': False,
                    'decision': 'PREDICTION_FAILED',
                    'confidence': 0.0
                }

            # Map prediction to decision
            predicted_value = prediction.get('prediction')
            decision_mapping = config.get('decision_mapping', {})

            decision = decision_mapping.get(predicted_value, 'UNKNOWN')

            return {
                'success': True,
                'decision': decision,
                'confidence': prediction.get('confidence', 0.7),
                'weight': rule.priority,
                'rule_name': rule.name,
                'ml_prediction': predicted_value
            }

        except Exception as e:
            logger.error(f"ML prediction error: {e}")
            return {
                'success': False,
                'decision': 'ML_ERROR',
                'confidence': 0.0,
                'error': str(e)
            }

    def _apply_composite_rule(self, rule, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply composite rule (combination of multiple rules)

        Example config:
        {
            "sub_rules": [
                {"type": "threshold", "field": "cost", "operator": ">", "threshold": 1000},
                {"type": "threshold", "field": "urgency", "operator": "==", "threshold": "high"}
            ],
            "logic": "AND",  # or "OR"
            "decision_if_true": "APPROVE",
            "decision_if_false": "REJECT"
        }
        """
        config = rule.config
        sub_rules = config.get('sub_rules', [])
        logic = config.get('logic', 'AND')

        results = []
        for sub_rule_config in sub_rules:
            # Create temporary rule object
            from .models import DecisionRule
            temp_rule = DecisionRule(
                tenant=self.organization,
                name=f"Composite sub-rule",
                rule_type=sub_rule_config.get('type', 'THRESHOLD').upper(),
                config=sub_rule_config,
                priority=rule.priority
            )

            result = self.apply_rule(temp_rule, input_data)
            results.append(result.get('success', False))

        # Apply logic
        if logic == 'AND':
            final_result = all(results)
        elif logic == 'OR':
            final_result = any(results)
        else:
            final_result = False

        decision = config.get('decision_if_true') if final_result else config.get('decision_if_false')

        return {
            'success': True,
            'decision': decision,
            'confidence': config.get('confidence', 0.9),
            'weight': rule.priority,
            'rule_name': rule.name,
            'composite_logic': logic,
            'sub_results': results
        }

    def _evaluate_formula(self, formula: str, input_data: Dict[str, Any]) -> Optional[Decimal]:
        """
        Safely evaluate a formula with input data

        Only allows basic math operations, no arbitrary code execution
        """
        try:
            # Build safe evaluation context
            safe_dict = {
                'Decimal': Decimal,
                'abs': abs,
                'min': min,
                'max': max,
                'round': round,
            }

            # Add input data values
            for key, value in input_data.items():
                if isinstance(value, (int, float, Decimal)):
                    safe_dict[key] = Decimal(str(value))

            # Evaluate formula safely
            result = eval(formula, {"__builtins__": {}}, safe_dict)

            return Decimal(str(result))

        except Exception as e:
            logger.error(f"Formula evaluation error: {e}")
            return None

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """
        Get value from nested dict using dot notation

        Example: "warehouse.cost" -> data['warehouse']['cost']
        """
        keys = path.split('.')
        value = data

        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None

            if value is None:
                return None

        return value
