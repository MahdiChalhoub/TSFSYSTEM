"""
Database Query Optimizer
=========================
Automatic query optimization, N+1 detection, and index recommendations.

Features:
- Automatic select_related/prefetch_related
- N+1 query detection
- Slow query logging
- Index recommendations
- Query plan analysis

Usage:
    from kernel.performance import optimize_queryset

    @optimize_queryset
    def get_queryset(self):
        return Invoice.objects.all()
"""

import logging
import time
from functools import wraps
from django.db import connection, reset_queries
from django.db.models import Prefetch, QuerySet
from django.core.cache import cache

logger = logging.getLogger(__name__)


class QueryOptimizer:
    """
    Automatic query optimizer that analyzes and optimizes Django querysets.
    """

    # Common relationship patterns
    COMMON_RELATIONS = {
        'Invoice': ['customer', 'lines', 'lines__product', 'organization', 'created_by'],
        'Order': ['customer', 'lines', 'lines__product', 'warehouse', 'organization'],
        'Product': ['category', 'brand', 'supplier', 'warehouse_stocks', 'organization'],
        'Contact': ['organization', 'assigned_to', 'pricing_group', 'interactions'],
    }

    @classmethod
    def optimize(cls, queryset, depth=2):
        """
        Automatically optimize a queryset by adding select_related/prefetch_related.

        Args:
            queryset: Django QuerySet to optimize
            depth: How deep to follow relationships (1-3)

        Returns:
            Optimized QuerySet
        """
        if not isinstance(queryset, QuerySet):
            return queryset

        model_name = queryset.model.__name__

        # Get common relations for this model
        relations = cls.COMMON_RELATIONS.get(model_name, [])

        if not relations:
            # Auto-detect relations
            relations = cls._auto_detect_relations(queryset.model, depth)

        # Separate select_related (ForeignKey) from prefetch_related (ManyToMany/Reverse FK)
        select_fields = []
        prefetch_fields = []

        for relation in relations:
            field_type = cls._get_field_type(queryset.model, relation)

            if field_type == 'fk':
                select_fields.append(relation)
            elif field_type in ('m2m', 'reverse_fk'):
                prefetch_fields.append(relation)

        # Apply optimizations
        if select_fields:
            queryset = queryset.select_related(*select_fields)

        if prefetch_fields:
            queryset = queryset.prefetch_related(*prefetch_fields)

        return queryset

    @classmethod
    def _auto_detect_relations(cls, model, depth=2):
        """Auto-detect relationships to optimize"""
        relations = []

        for field in model._meta.get_fields():
            if depth <= 0:
                break

            # ForeignKey
            if field.many_to_one and field.concrete:
                relations.append(field.name)

            # ManyToMany
            elif field.many_to_many:
                relations.append(field.name)

            # Reverse ForeignKey (useful for prefetch)
            elif field.one_to_many:
                # Only include if commonly accessed
                if field.name in ['lines', 'items', 'entries', 'payments']:
                    relations.append(field.name)

        return relations

    @classmethod
    def _get_field_type(cls, model, relation_path):
        """Determine if relation is FK, M2M, or reverse FK"""
        try:
            parts = relation_path.split('__')
            current_model = model

            for part in parts:
                field = current_model._meta.get_field(part)

                if field.many_to_one:
                    return 'fk'
                elif field.many_to_many:
                    return 'm2m'
                elif field.one_to_many:
                    return 'reverse_fk'

                # Move to related model for next iteration
                if hasattr(field, 'related_model'):
                    current_model = field.related_model

        except Exception:
            pass

        return 'unknown'


class SlowQueryDetector:
    """
    Detects slow queries and logs them for optimization.
    """

    SLOW_QUERY_THRESHOLD = 0.1  # 100ms

    @classmethod
    def detect(cls, view_func):
        """Decorator to detect slow queries in a view"""
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            reset_queries()
            start_time = time.time()

            result = view_func(*args, **kwargs)

            elapsed = time.time() - start_time
            queries = connection.queries

            # Analyze queries
            slow_queries = [
                q for q in queries
                if float(q.get('time', 0)) > cls.SLOW_QUERY_THRESHOLD
            ]

            if slow_queries:
                logger.warning(
                    f"Slow queries detected in {view_func.__name__}: "
                    f"{len(slow_queries)}/{len(queries)} queries were slow"
                )

                for q in slow_queries[:5]:  # Log first 5
                    logger.warning(
                        f"Slow query ({q['time']}s): {q['sql'][:200]}"
                    )

            # Detect N+1 queries
            if len(queries) > 10:
                cls._detect_n_plus_1(queries, view_func.__name__)

            return result

        return wrapper

    @classmethod
    def _detect_n_plus_1(cls, queries, view_name):
        """Detect N+1 query patterns"""
        # Group similar queries
        query_patterns = {}

        for q in queries:
            sql = q['sql']
            # Normalize SQL (remove specific IDs)
            normalized = sql.split('WHERE')[0] if 'WHERE' in sql else sql

            if normalized not in query_patterns:
                query_patterns[normalized] = []
            query_patterns[normalized].append(q)

        # Find patterns with many repetitions (N+1)
        for pattern, query_list in query_patterns.items():
            if len(query_list) > 5:  # Same query repeated 5+ times = N+1
                logger.error(
                    f"N+1 query detected in {view_name}: "
                    f"Query repeated {len(query_list)} times"
                )
                logger.error(f"Pattern: {pattern[:200]}")
                logger.error(
                    "Fix: Use select_related() or prefetch_related()"
                )


# Decorator for automatic optimization
def optimize_queryset(func):
    """
    Decorator to automatically optimize querysets returned by a function.

    Usage:
        @optimize_queryset
        def get_queryset(self):
            return Invoice.objects.all()
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)

        if isinstance(result, QuerySet):
            result = QueryOptimizer.optimize(result)

        return result

    return wrapper


# Decorator for slow query detection
def detect_slow_queries(func):
    """
    Decorator to detect and log slow queries.

    Usage:
        @detect_slow_queries
        def my_view(request):
            ...
    """
    return SlowQueryDetector.detect(func)


class QueryPlanAnalyzer:
    """
    Analyzes PostgreSQL query plans to recommend indexes.
    """

    @classmethod
    def analyze(cls, queryset):
        """
        Analyze query plan and recommend optimizations.

        Returns:
            Dict with analysis results and recommendations
        """
        if not isinstance(queryset, QuerySet):
            return {'error': 'Not a QuerySet'}

        # Get SQL
        sql = str(queryset.query)

        # Get EXPLAIN output
        with connection.cursor() as cursor:
            cursor.execute(f"EXPLAIN ANALYZE {sql}")
            plan = cursor.fetchall()

        # Parse plan
        analysis = {
            'sql': sql,
            'plan': [row[0] for row in plan],
            'recommendations': []
        }

        # Analyze for common issues
        plan_text = '\n'.join(analysis['plan'])

        # Sequential scans (recommend index)
        if 'Seq Scan' in plan_text:
            analysis['recommendations'].append({
                'type': 'missing_index',
                'message': 'Sequential scan detected. Consider adding an index.',
                'severity': 'medium'
            })

        # Nested loops (might indicate N+1)
        if 'Nested Loop' in plan_text:
            analysis['recommendations'].append({
                'type': 'join_optimization',
                'message': 'Nested loop join detected. Consider using select_related().',
                'severity': 'high'
            })

        # High cost
        if 'cost=' in plan_text:
            costs = [
                float(line.split('cost=')[1].split('..')[1].split(' ')[0])
                for line in plan_text.split('\n')
                if 'cost=' in line
            ]
            max_cost = max(costs) if costs else 0

            if max_cost > 1000:
                analysis['recommendations'].append({
                    'type': 'expensive_query',
                    'message': f'Query cost is high ({max_cost:.0f}). Consider optimization.',
                    'severity': 'high'
                })

        return analysis


# Management command to find missing indexes
class IndexRecommender:
    """
    Recommends indexes based on query patterns.
    """

    @classmethod
    def recommend(cls):
        """
        Analyze slow query log and recommend indexes.

        Returns:
            List of recommended indexes
        """
        recommendations = []

        # Get slow queries from cache
        slow_queries = cache.get('slow_queries', [])

        # Analyze patterns
        for query in slow_queries:
            sql = query.get('sql', '')

            # Look for WHERE clauses without indexes
            if 'WHERE' in sql:
                # Extract table and field
                # This is simplified - production should use SQL parser
                table = cls._extract_table(sql)
                fields = cls._extract_where_fields(sql)

                for field in fields:
                    recommendations.append({
                        'table': table,
                        'field': field,
                        'sql': f'CREATE INDEX idx_{table}_{field} ON {table}({field});',
                        'reason': 'Frequent WHERE clause usage'
                    })

        return recommendations

    @classmethod
    def _extract_table(cls, sql):
        """Extract table name from SQL"""
        if 'FROM' in sql:
            parts = sql.split('FROM')[1].split('WHERE')[0].strip()
            return parts.split()[0].strip('"')
        return None

    @classmethod
    def _extract_where_fields(cls, sql):
        """Extract fields from WHERE clause"""
        fields = []
        if 'WHERE' in sql:
            where_clause = sql.split('WHERE')[1].split('ORDER BY')[0] if 'ORDER BY' in sql else sql.split('WHERE')[1]

            # Simple extraction (production should use proper SQL parser)
            import re
            field_pattern = r'"(\w+)"\s*='
            fields = re.findall(field_pattern, where_clause)

        return fields
