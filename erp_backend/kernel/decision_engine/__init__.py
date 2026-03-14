"""
Decision Engine - TSFSYSTEM Kernel Component
============================================

Provides AI-powered decision support for all modules.

Features:
- Rule-based decision engine
- ML model registry and execution
- Recommendation engine
- Cost-benefit analysis
- Multi-criteria optimization

Architecture:
- 100% config-driven (no hardcoded rules)
- Event-driven (emits decision events)
- Tenant-isolated (per-organization decisions)
- Audit logging (all decisions tracked)

Author: TSFSYSTEM Team
Version: 1.0.0
"""

from .core import DecisionEngine
from .rule_engine import RuleEngine
from .ml_registry import MLModelRegistry
from .recommender import RecommendationEngine
from .models import DecisionRule, DecisionLog, MLModel

__all__ = [
    'DecisionEngine',
    'RuleEngine',
    'MLModelRegistry',
    'RecommendationEngine',
    'DecisionRule',
    'DecisionLog',
    'MLModel',
]

__version__ = '1.0.0'
