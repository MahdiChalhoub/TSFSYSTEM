"""
Decision Engine Core
===================

Main decision engine that orchestrates rule evaluation, ML predictions,
and recommendation generation.

Architecture:
- 100% config-driven (no hardcoded logic)
- Event-driven (emits decision events)
- Performance optimized (caching, async execution)
"""

import logging
import time
from decimal import Decimal
from typing import Dict, List, Any, Optional
from django.db import transaction
from django.core.cache import cache
from django.utils import timezone

from kernel.config import get_config
from kernel.events import emit_event
from .models import DecisionRule, DecisionLog

logger = logging.getLogger(__name__)


class DecisionEngine:
    """
    Main decision engine for TSFSYSTEM

    Evaluates business rules, ML models, and generates recommendations
    for inventory operations, transfers, allocations, etc.
    """

    def __init__(self, organization):
        """
        Initialize decision engine for a specific organization

        Args:
            organization: Organization/Tenant instance
        """
        self.organization = organization
        self.cache_enabled = get_config(
            'decision_engine.cache_enabled',
            default=True
        )
        self.cache_ttl = get_config(
            'decision_engine.cache_ttl_seconds',
            default=300
        )

    def evaluate(
        self,
        context: str,
        subject: str,
        input_data: Dict[str, Any],
        subject_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate decision rules for a given context

        Args:
            context: Decision context (e.g., 'inventory.transfer')
            subject: What is being decided (e.g., 'Transfer Request #123')
            input_data: Input parameters for decision
            subject_id: Optional ID for tracking

        Returns:
            Dict with decision result, recommendations, confidence
        """
        start_time = time.time()

        try:
            # Check cache
            if self.cache_enabled:
                cache_key = self._get_cache_key(context, input_data)
                cached_result = cache.get(cache_key)
                if cached_result:
                    logger.info(f"[DecisionEngine] Cache hit for {context}")
                    return cached_result

            # Get active rules for this context
            rules = DecisionRule.objects.filter(
                tenant=self.organization,
                context=context,
                is_active=True
            ).order_by('priority')

            if not rules.exists():
                logger.warning(
                    f"[DecisionEngine] No rules found for context: {context}"
                )
                return {
                    'decision': 'NO_RULES',
                    'message': f'No decision rules configured for {context}',
                    'recommendations': [],
                    'confidence': 0.0
                }

            # Apply rules
            from .rule_engine import RuleEngine
            rule_engine = RuleEngine(self.organization)

            results = []
            rules_applied = []

            for rule in rules:
                try:
                    result = rule_engine.apply_rule(rule, input_data)
                    results.append(result)
                    rules_applied.append(rule.id)

                    # Update rule performance
                    rule.execution_count += 1
                    if result.get('success', False):
                        rule.success_count += 1
                    rule.save(update_fields=['execution_count', 'success_count'])

                except Exception as e:
                    logger.error(
                        f"[DecisionEngine] Error applying rule {rule.name}: {e}"
                    )
                    continue

            # Aggregate results
            final_decision = self._aggregate_results(results, input_data)

            # Log decision
            execution_time = (time.time() - start_time) * 1000
            self._log_decision(
                context=context,
                subject=subject,
                subject_id=subject_id,
                input_data=input_data,
                output_data=final_decision,
                rules_applied=rules_applied,
                execution_time_ms=execution_time
            )

            # Cache result
            if self.cache_enabled:
                cache.set(cache_key, final_decision, self.cache_ttl)

            # Emit event
            emit_event('decision.made', {
                'context': context,
                'subject': subject,
                'decision': final_decision.get('decision'),
                'confidence': final_decision.get('confidence', 0.0),
                'organization_id': self.organization.id
            })

            return final_decision

        except Exception as e:
            logger.error(f"[DecisionEngine] Error in evaluate: {e}", exc_info=True)
            return {
                'decision': 'ERROR',
                'message': str(e),
                'recommendations': [],
                'confidence': 0.0
            }

    def recommend(
        self,
        context: str,
        options: List[Dict[str, Any]],
        criteria: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Generate recommendations by scoring multiple options

        Args:
            context: Decision context
            options: List of possible options to evaluate
            criteria: Scoring criteria with weights (e.g., {'cost': 0.4, 'speed': 0.3})

        Returns:
            Dict with ranked recommendations
        """
        from .recommender import RecommendationEngine

        recommender = RecommendationEngine(self.organization)
        return recommender.rank_options(context, options, criteria)

    def predict(
        self,
        model_name: str,
        input_features: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Make ML prediction using registered model

        Args:
            model_name: Name of ML model to use
            input_features: Input features for prediction

        Returns:
            Dict with prediction, confidence, metadata
        """
        from .ml_registry import MLModelRegistry

        registry = MLModelRegistry(self.organization)
        return registry.predict(model_name, input_features)

    def _aggregate_results(
        self,
        results: List[Dict[str, Any]],
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Aggregate results from multiple rules into final decision

        Uses weighted voting based on rule priority and confidence
        """
        if not results:
            return {
                'decision': 'NO_RESULTS',
                'message': 'No rules produced results',
                'recommendations': [],
                'confidence': 0.0
            }

        # Get aggregation strategy from config
        strategy = get_config(
            'decision_engine.aggregation_strategy',
            default='weighted_vote'
        )

        if strategy == 'weighted_vote':
            return self._weighted_vote(results)
        elif strategy == 'unanimous':
            return self._unanimous(results)
        elif strategy == 'first_match':
            return results[0] if results else {}
        else:
            return self._weighted_vote(results)

    def _weighted_vote(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate using weighted voting"""
        votes = {}
        total_weight = 0
        all_recommendations = []

        for result in results:
            decision = result.get('decision', 'UNKNOWN')
            weight = result.get('weight', 1.0)
            confidence = result.get('confidence', 0.5)

            weighted_score = weight * confidence
            votes[decision] = votes.get(decision, 0) + weighted_score
            total_weight += weight

            if 'recommendations' in result:
                all_recommendations.extend(result['recommendations'])

        # Get winning decision
        winning_decision = max(votes.items(), key=lambda x: x[1])[0] if votes else 'UNKNOWN'
        winning_score = votes.get(winning_decision, 0)

        final_confidence = (winning_score / total_weight) if total_weight > 0 else 0.0

        return {
            'decision': winning_decision,
            'confidence': float(final_confidence),
            'votes': votes,
            'recommendations': all_recommendations[:10],  # Top 10
            'aggregation_method': 'weighted_vote'
        }

    def _unanimous(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """All rules must agree"""
        if not results:
            return {'decision': 'NO_RESULTS', 'confidence': 0.0}

        first_decision = results[0].get('decision')
        all_agree = all(r.get('decision') == first_decision for r in results)

        if all_agree:
            avg_confidence = sum(r.get('confidence', 0) for r in results) / len(results)
            return {
                'decision': first_decision,
                'confidence': float(avg_confidence),
                'aggregation_method': 'unanimous',
                'unanimous': True
            }
        else:
            return {
                'decision': 'NO_CONSENSUS',
                'confidence': 0.0,
                'aggregation_method': 'unanimous',
                'unanimous': False,
                'message': 'Rules did not reach consensus'
            }

    def _log_decision(
        self,
        context: str,
        subject: str,
        subject_id: Optional[str],
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        rules_applied: List[int],
        execution_time_ms: float
    ):
        """Log decision to database"""
        try:
            DecisionLog.objects.create(
                tenant=self.organization,
                context=context,
                decision_type=self._map_decision_type(output_data.get('decision')),
                subject=subject,
                subject_id=subject_id or '',
                input_data=input_data,
                output_data=output_data,
                rules_applied=rules_applied,
                execution_time_ms=Decimal(str(execution_time_ms))
            )
        except Exception as e:
            logger.error(f"[DecisionEngine] Error logging decision: {e}")

    def _map_decision_type(self, decision: str) -> str:
        """Map decision string to decision type"""
        decision_map = {
            'APPROVE': 'APPROVE',
            'APPROVED': 'APPROVE',
            'REJECT': 'REJECT',
            'REJECTED': 'REJECT',
            'RECOMMEND': 'RECOMMEND',
        }

        if decision in decision_map:
            return decision_map[decision]

        if 'RECOMMEND' in decision:
            return 'RECOMMEND'

        return 'CALCULATE'

    def _get_cache_key(self, context: str, input_data: Dict[str, Any]) -> str:
        """Generate cache key for decision"""
        import hashlib
        import json

        data_str = json.dumps(input_data, sort_keys=True)
        data_hash = hashlib.md5(data_str.encode()).hexdigest()

        return f"decision:{self.organization.id}:{context}:{data_hash}"
