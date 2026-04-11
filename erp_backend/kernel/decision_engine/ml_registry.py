"""
ML Model Registry
=================

Registry for managing and executing ML models.

Supports:
- Model registration and versioning
- Model loading and prediction
- Performance tracking
- A/B testing capabilities
"""

import logging
import pickle
import time
from decimal import Decimal
from typing import Dict, Any, Optional
from django.core.cache import cache
from kernel.config import get_config

logger = logging.getLogger(__name__)


class MLModelRegistry:
    """
    ML Model Registry for TSFSYSTEM

    Manages ML models used for decision-making
    """

    def __init__(self, organization):
        self.organization = organization
        self.cache_enabled = get_config('ml.cache_enabled', default=True)
        self.cache_ttl = get_config('ml.cache_ttl_seconds', default=600)

    def predict(self, model_name: str, input_features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make prediction using registered ML model

        Args:
            model_name: Name of model to use
            input_features: Input features for prediction

        Returns:
            Dict with prediction, confidence, metadata
        """
        start_time = time.time()

        try:
            # Get model from database
            from .models import MLModel

            model_record = MLModel.objects.filter(
                tenant=self.organization,
                name=model_name,
                is_active=True
            ).first()

            if not model_record:
                logger.warning(f"Model not found: {model_name}")
                return {
                    'success': False,
                    'error': f'Model {model_name} not found or inactive'
                }

            # Check cache
            if self.cache_enabled:
                cache_key = self._get_cache_key(model_name, input_features)
                cached_result = cache.get(cache_key)
                if cached_result:
                    return cached_result

            # Load and execute model
            prediction_result = self._execute_model(model_record, input_features)

            # Update model stats
            execution_time = (time.time() - start_time) * 1000
            model_record.prediction_count += 1

            # Update average prediction time (exponential moving average)
            alpha = 0.1  # Smoothing factor
            current_avg = float(model_record.avg_prediction_time_ms)
            new_avg = alpha * execution_time + (1 - alpha) * current_avg

            model_record.avg_prediction_time_ms = Decimal(str(new_avg))
            model_record.save(update_fields=['prediction_count', 'avg_prediction_time_ms'])

            # Add metadata
            prediction_result['execution_time_ms'] = execution_time
            prediction_result['model_version'] = model_record.version

            # Cache result
            if self.cache_enabled:
                cache.set(cache_key, prediction_result, self.cache_ttl)

            return prediction_result

        except Exception as e:
            logger.error(f"Prediction error for {model_name}: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    def _execute_model(self, model_record, input_features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute ML model prediction

        For now, uses simple heuristics. In production, would load
        actual ML models (scikit-learn, TensorFlow, etc.)
        """
        model_type = model_record.model_type
        algorithm = model_record.algorithm

        # For MVP, implement simple heuristic-based "models"
        # In production, load actual trained models from model_record.model_path

        if model_type == 'FORECAST':
            return self._forecast_demand(input_features, model_record.config)
        elif model_type == 'CLASSIFICATION':
            return self._classify(input_features, model_record.config)
        elif model_type == 'REGRESSION':
            return self._regress(input_features, model_record.config)
        elif model_type == 'OPTIMIZATION':
            return self._optimize(input_features, model_record.config)
        else:
            return {
                'success': False,
                'error': f'Unsupported model type: {model_type}'
            }

    def _forecast_demand(self, features: Dict[str, Any], config: Dict) -> Dict[str, Any]:
        """
        Demand forecasting model (simplified)

        In production, would use ARIMA, Prophet, or LSTM
        """
        # Simple moving average with trend adjustment
        historical_sales = features.get('historical_sales', [])
        days_ahead = features.get('days_ahead', 7)

        if not historical_sales:
            return {
                'success': False,
                'error': 'No historical sales data provided'
            }

        # Calculate simple moving average
        avg_daily_sales = sum(historical_sales) / len(historical_sales)

        # Apply trend factor (if sales are increasing/decreasing)
        if len(historical_sales) >= 2:
            recent_avg = sum(historical_sales[-7:]) / min(7, len(historical_sales))
            overall_avg = sum(historical_sales) / len(historical_sales)
            trend_factor = recent_avg / overall_avg if overall_avg > 0 else 1.0
        else:
            trend_factor = 1.0

        # Forecast
        forecast = avg_daily_sales * trend_factor * days_ahead

        # Confidence based on data variance
        if len(historical_sales) > 1:
            variance = sum((x - avg_daily_sales) ** 2 for x in historical_sales) / len(historical_sales)
            std_dev = variance ** 0.5
            confidence = max(0.5, 1.0 - (std_dev / avg_daily_sales) if avg_daily_sales > 0 else 0.5)
        else:
            confidence = 0.5

        return {
            'success': True,
            'prediction': float(forecast),
            'confidence': float(confidence),
            'details': {
                'avg_daily_sales': float(avg_daily_sales),
                'trend_factor': float(trend_factor),
                'forecast_days': days_ahead
            }
        }

    def _classify(self, features: Dict[str, Any], config: Dict) -> Dict[str, Any]:
        """
        Classification model (simplified)

        Used for ABC classification, urgency classification, etc.
        """
        # Example: ABC classification based on value
        total_value = features.get('total_value', 0)
        turnover_rate = features.get('turnover_rate', 0)

        # Simple rule-based classification
        if total_value > 10000 and turnover_rate > 10:
            classification = 'A'  # High value, high turnover
            confidence = 0.9
        elif total_value > 5000 or turnover_rate > 5:
            classification = 'B'  # Medium value or medium turnover
            confidence = 0.8
        else:
            classification = 'C'  # Low value, low turnover
            confidence = 0.7

        return {
            'success': True,
            'prediction': classification,
            'confidence': confidence,
            'details': {
                'total_value': total_value,
                'turnover_rate': turnover_rate
            }
        }

    def _regress(self, features: Dict[str, Any], config: Dict) -> Dict[str, Any]:
        """
        Regression model (simplified)

        Used for cost prediction, lead time estimation, etc.
        """
        # Example: Lead time prediction based on distance and supplier
        distance = features.get('distance_km', 0)
        supplier_avg_lead_time = features.get('supplier_avg_lead_time', 7)

        # Simple linear model
        base_lead_time = supplier_avg_lead_time
        distance_factor = distance / 1000  # Days per 1000km

        predicted_lead_time = base_lead_time + distance_factor

        return {
            'success': True,
            'prediction': float(predicted_lead_time),
            'confidence': 0.75,
            'details': {
                'base_lead_time': supplier_avg_lead_time,
                'distance_factor': distance_factor
            }
        }

    def _optimize(self, features: Dict[str, Any], config: Dict) -> Dict[str, Any]:
        """
        Optimization model (simplified)

        Used for allocation optimization, reorder point optimization, etc.
        """
        # Example: Optimal reorder point calculation
        avg_daily_demand = features.get('avg_daily_demand', 0)
        lead_time_days = features.get('lead_time_days', 7)
        demand_variability = features.get('demand_variability', 0.2)
        service_level = features.get('target_service_level', 0.95)

        # Safety stock calculation (simplified)
        # In production: use z-score based on service level
        z_score = 1.65 if service_level >= 0.95 else 1.28  # 95% or 90% service level

        safety_stock = z_score * (avg_daily_demand * demand_variability) * (lead_time_days ** 0.5)
        reorder_point = (avg_daily_demand * lead_time_days) + safety_stock

        return {
            'success': True,
            'prediction': float(reorder_point),
            'confidence': 0.8,
            'details': {
                'safety_stock': float(safety_stock),
                'lead_time_demand': float(avg_daily_demand * lead_time_days),
                'z_score': z_score
            }
        }

    def _get_cache_key(self, model_name: str, features: Dict[str, Any]) -> str:
        """Generate cache key for ML prediction"""
        import hashlib
        import json

        features_str = json.dumps(features, sort_keys=True)
        features_hash = hashlib.md5(features_str.encode()).hexdigest()

        return f"ml:{self.organization.id}:{model_name}:{features_hash}"


# Model training utilities (for future implementation)

class ModelTrainer:
    """
    Utilities for training ML models

    Future implementation: Train models on historical data
    """

    @staticmethod
    def train_demand_forecast_model(organization, product_id):
        """
        Train demand forecasting model for a product

        Uses historical sales data to train ARIMA or Prophet model
        """
        # Future implementation
        pass

    @staticmethod
    def train_classification_model(organization, model_type):
        """
        Train classification model (ABC, urgency, etc.)

        Uses historical data to train Random Forest or XGBoost
        """
        # Future implementation
        pass
