"""Collections / Dunning REST endpoints."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from erp.middleware import get_current_tenant_id
from erp.models import Organization


class CollectionsViewSet(viewsets.ViewSet):
    """Collections workflow — read overdue customers, post dunning reminders."""

    @action(detail=False, methods=['get'], url_path='overdue-customers')
    def overdue_customers(self, request):
        """Return all customers with at least one overdue invoice,
        bucketed by oldest-days + last-reminder-level + suggested-next-level.
        """
        from apps.finance.services.collections_service import CollectionsService

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'Tenant context missing'}, status=400)
        organization = Organization.objects.get(id=organization_id)
        rows = CollectionsService.list_overdue_customers(organization)
        # Summary buckets
        buckets = {'current': 0, '30_days': 0, '60_days': 0, '90_plus': 0}
        total_overdue = 0.0
        for r in rows:
            buckets[r['bucket']] = buckets.get(r['bucket'], 0) + 1
            try:
                total_overdue += float(r['total_overdue'])
            except Exception:
                pass
        return Response({
            'rows': rows,
            'summary': {
                'customers': len(rows),
                'total_overdue': f'{total_overdue:.2f}',
                'buckets': buckets,
            },
        })

    @action(detail=False, methods=['post'], url_path='send-reminder')
    def send_reminder(self, request):
        """Post a dunning reminder.

        Body:
          contact_id (int, required)
          level (int, 1-4, default 1)
          method (str, default 'EMAIL')
          notes (str, optional)
          auto_body (bool, default True)
        """
        from apps.finance.services.collections_service import CollectionsService

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'Tenant context missing'}, status=400)
        organization = Organization.objects.get(id=organization_id)

        contact_id = request.data.get('contact_id')
        if not contact_id:
            return Response({'error': 'contact_id required'}, status=400)
        level = int(request.data.get('level') or 1)
        method = request.data.get('method') or 'EMAIL'
        notes = request.data.get('notes') or ''
        auto_body = bool(request.data.get('auto_body', True))

        try:
            rem = CollectionsService.send_reminder(
                organization=organization,
                contact_id=int(contact_id),
                level=level, method=method,
                user=request.user if request.user.is_authenticated else None,
                notes=notes, auto_body=auto_body,
            )
            return Response({
                'id': rem.id, 'level': rem.level, 'method': rem.method,
                'status': rem.status, 'sent_at': rem.sent_at.isoformat() if rem.sent_at else None,
                'amount_overdue': str(rem.amount_overdue),
                'invoices_referenced': len(rem.invoices_referenced),
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        """List dunning reminders (most recent first).
        Query params:
          contact_id: filter to a single contact
          limit: default 50
        """
        from apps.finance.models import DunningReminder
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        qs = DunningReminder.objects.filter(organization_id=organization_id)
        contact_id = request.query_params.get('contact_id')
        if contact_id:
            qs = qs.filter(contact_id=int(contact_id))
        try:
            limit = max(1, min(500, int(request.query_params.get('limit') or 50)))
        except ValueError:
            limit = 50

        rows = [
            {
                'id': r.id, 'contact_id': r.contact_id,
                'contact_name': r.contact_name,
                'level': r.level, 'method': r.method, 'status': r.status,
                'amount_overdue': str(r.amount_overdue),
                'oldest_invoice_days': r.oldest_invoice_days,
                'invoices_referenced_count': len(r.invoices_referenced or []),
                'subject': r.subject,
                'sent_at': r.sent_at.isoformat() if r.sent_at else None,
                'sent_by': r.sent_by.username if r.sent_by_id else None,
            }
            for r in qs.order_by('-sent_at', '-id')[:limit]
        ]
        return Response(rows)

    @action(detail=False, methods=['get'], url_path='integrity')
    def integrity(self, request):
        """Stuck-reminder tripwire (for canary)."""
        from apps.finance.services.collections_service import CollectionsService
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        return Response(CollectionsService.check_collections_integrity(organization))
