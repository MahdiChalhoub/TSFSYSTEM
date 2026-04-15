from .base import (
    Response, action, timezone, TenantModelViewSet
)
from django.db.models import Avg, F
from apps.pos.models import DeliveryZone, DeliveryOrder, Driver
from apps.pos.serializers import DeliveryZoneSerializer, DeliveryOrderSerializer, DriverSerializer
from apps.pos.models.delivery_models import generate_confirmation_code
from apps.pos.services import sms_service
from apps.pos.services.delivery_fleet_service import DeliveryFleetService
from decimal import Decimal


class DriverViewSet(TenantModelViewSet):
    """CRUD for drivers."""
    queryset = Driver.objects.select_related('user').all()
    serializer_class = DriverSerializer
    filterset_fields = ['status', 'is_active']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'phone_number']

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """Toggle driver status (ONLINE, BUSY, OFFLINE)."""
        driver = self.get_object()
        status = request.data.get('status')
        if status not in ('ONLINE', 'BUSY', 'OFFLINE'):
            return Response({'error': 'Invalid status'}, status=400)
        driver.status = status
        driver.save(update_fields=['status'])
        return Response(DriverSerializer(driver).data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Returns all ONLINE and active drivers."""
        drivers = self.get_queryset().filter(status='ONLINE', is_active=True)
        return Response(DriverSerializer(drivers, many=True).data)

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get performance statistics for a specific driver."""
        driver = self.get_object()
        today = timezone.now().date()
        
        deliveries = DeliveryOrder.objects.filter(driver=driver.user)
        today_deliveries = deliveries.filter(created_at__date=today)
        
        # Calculate Average Delivery Time (in minutes)
        avg_time = deliveries.filter(
            dispatched_at__isnull=False, 
            delivered_at__isnull=False
        ).annotate(
            duration=F('delivered_at') - F('dispatched_at')
        ).aggregate(avg_duration=Avg('duration'))['avg_duration']
        
        avg_minutes = (avg_time.total_seconds() / 60) if avg_time else 0

        return Response({
            'total_deliveries': driver.total_deliveries,
            'today_deliveries': today_deliveries.count(),
            'avg_delivery_time': round(avg_minutes, 1),
            'rating': float(driver.rating),
            'status': driver.status,
        })

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Get financial statement (ledger entries) for a specific driver."""
        driver = self.get_object()
        try:
            from erp.connector_engine import connector_engine
            # Query Finance for journal lines linked to this driver (employee)
            result = connector_engine.route_read(
                target_module='finance',
                endpoint='get_employee_ledger_history',
                params={
                    'organization_id': driver.organization_id,
                    'user_id': driver.user_id,
                },
                organization_id=driver.organization_id,
                source_module='pos',
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e), 'entries': [], 'balance': '0.00'}, status=500)

    @action(detail=True, methods=['post'])
    def log_expense(self, request, pk=None):
        """Manually log an operational expense (fuel, maintenance) for a driver."""
        driver = self.get_object()
        amount = request.data.get('amount')
        expense_type = request.data.get('expense_type', 'maintenance')
        reference = request.data.get('reference')
        description = request.data.get('description')

        if not amount:
            return Response({'error': 'Amount is required'}, status=400)

        try:
            from erp.connector_engine import connector_engine
            result = connector_engine.route_write(
                target_module='finance',
                endpoint='log_operational_expense',
                data={
                    'user_id': driver.user_id,
                    'amount': amount,
                    'expense_type': expense_type,
                    'reference': reference,
                    'description': description,
                },
                organization_id=driver.organization_id,
                source_module='pos',
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class DeliveryZoneViewSet(TenantModelViewSet):
    """CRUD for delivery zones."""
    queryset = DeliveryZone.objects.all()
    serializer_class = DeliveryZoneSerializer
    ordering_fields = ['name']
    ordering = ['name']  # DeliveryZone has no created_at


class DeliveryOrderViewSet(TenantModelViewSet):
    """CRUD for delivery orders + status transitions."""
    queryset = DeliveryOrder.objects.select_related('order', 'zone', 'driver', 'session').all()
    serializer_class = DeliveryOrderSerializer

    def perform_create(self, serializer):
        """Auto-generate tracking_code, pos_return_code, and client_delivery_code on creation."""
        import secrets
        instance = serializer.save()
        # Always generate a secure tracking code for the driver URL
        if not instance.tracking_code:
            instance.tracking_code = secrets.token_urlsafe(12)
        # Check org POS settings for each code requirement
        org = getattr(instance, 'organization', None)
        require_pos = False
        require_client = False
        if org:
            try:
                ps = getattr(org, 'pos_settings', None)
                require_pos    = bool(getattr(ps, 'require_driver_pos_code', False))
                require_client = bool(getattr(ps, 'require_client_delivery_code', False))
            except Exception:
                pass
        update_fields = ['tracking_code', 'require_pos_return_code', 'pos_return_code',
                         'require_client_delivery_code', 'client_delivery_code']
        instance.require_pos_return_code = require_pos
        instance.pos_return_code = generate_confirmation_code() if require_pos else None
        instance.require_client_delivery_code = require_client
        instance.client_delivery_code = generate_confirmation_code() if require_client else None
        instance.save(update_fields=update_fields)

        # ─ Auto-send client_delivery_code via SMS ─
        if require_client and instance.client_delivery_code:
            sms_enabled = False
            if org:
                try:
                    ps = getattr(org, 'pos_settings', None)
                    sms_enabled = bool(getattr(ps, 'sms_delivery_code_enabled', False))
                    if sms_enabled:
                        recipient_phone = getattr(instance, 'phone', '') or ''
                        recipient_name  = getattr(instance, 'recipient_name', '') or ''
                        sms_service.send_delivery_code_sms(
                            phone=recipient_phone,
                            recipient_name=recipient_name,
                            code=instance.client_delivery_code,
                            pos_settings=ps,
                        )
                except Exception:
                    pass  # never block delivery creation

    def perform_update(self, serializer):
        """Handle driver status changes on assignment."""
        old_driver = self.get_object().driver
        instance = serializer.save()
        new_driver = instance.driver

        if new_driver and new_driver != old_driver:
            # New driver assigned — update their profile to BUSY
            try:
                driver_profile = Driver.objects.get(user=new_driver)
                if driver_profile.status == 'ONLINE':
                    driver_profile.status = 'BUSY'
                    driver_profile.save(update_fields=['status'])
            except Driver.DoesNotExist:
                pass

    def get_queryset(self):
        qs = super().get_queryset()
        session_id = self.request.query_params.get('session', '').strip().strip('/')
        if session_id:
            qs = qs.filter(session_id=session_id)
        status = self.request.query_params.get('status', '').strip().strip('/')
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=True, methods=['post'])
    def dispatch_delivery(self, request, pk=None):
        """Mark delivery as dispatched / in transit."""
        delivery = self.get_object()
        if delivery.status not in ('PENDING', 'PREPARING'):
            return Response({'error': f'Cannot dispatch from {delivery.status}'}, status=400)
        delivery.status = 'IN_TRANSIT'
        delivery.dispatched_at = timezone.now()
        delivery.save(update_fields=['status', 'dispatched_at'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        """Mark delivery as completed."""
        delivery = self.get_object()
        if delivery.status != 'IN_TRANSIT':
            return Response({'error': 'Only IN_TRANSIT deliveries can be delivered'}, status=400)
        delivery.status = 'DELIVERED'
        delivery.delivered_at = timezone.now()
        delivery.save(update_fields=['status', 'delivered_at'])

        # Trigger fleet logic (commission, driver status)
        DeliveryFleetService.on_delivery_completed(delivery, request.user)

        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def fail(self, request, pk=None):
        """Mark delivery as failed."""
        delivery = self.get_object()
        if delivery.status in ('DELIVERED', 'CANCELLED'):
            return Response({'error': 'Cannot fail this delivery'}, status=400)
        delivery.status = 'FAILED'
        delivery.notes = request.data.get('reason', delivery.notes)
        delivery.save(update_fields=['status', 'notes'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a delivery."""
        delivery = self.get_object()
        if delivery.status == 'DELIVERED':
            return Response({'error': 'Cannot cancel delivered orders'}, status=400)
        delivery.status = 'CANCELLED'
        delivery.payment_status = 'CANCELLED'
        delivery.save(update_fields=['status', 'payment_status'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def driver_paid(self, request, pk=None):
        """
        Delivery man returns and reports money collected.
        Body: { amount_collected: float }
        """
        delivery = self.get_object()
        amount = Decimal(str(request.data.get('amount_collected', delivery.amount_due)))
        delivery.amount_collected = amount
        delivery.confirmed_by_driver = True

        # Auto-resolve if full amount collected
        if amount >= delivery.amount_due:
            delivery.payment_status = 'PAID'

        delivery.save(update_fields=['amount_collected', 'confirmed_by_driver', 'payment_status'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def pos_confirm(self, request, pk=None):
        """
        POS cashier confirms they received the money from the delivery man.
        This is the final step — clears the hold on the session.
        """
        delivery = self.get_object()

        if not delivery.confirmed_by_driver:
            return Response({'error': 'Driver must confirm payment first'}, status=400)

        # Validate pos_return_code if required (driver showed code to cashier)
        if delivery.require_pos_return_code and delivery.pos_return_code:
            submitted_code = str(request.data.get('code', '')).strip()
            if not submitted_code:
                return Response({'error': 'This delivery requires a return code from the driver.'}, status=400)
            if submitted_code != delivery.pos_return_code:
                return Response({'error': 'Invalid return code. Ask the driver to check their delivery page.'}, status=400)

        delivery.confirmed_by_pos = True
        delivery.payment_status = 'PAID'
        delivery.save(update_fields=['confirmed_by_pos', 'payment_status'])

        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=False, methods=['get'])
    def pending_holds(self, request):
        """
        Returns pending HOLD deliveries for the current session.
        Used by POS toolbar badge.
        """
        session_id = request.query_params.get('session', '').strip().strip('/')
        if not session_id:
            return Response([])
        qs = self.get_queryset().filter(
            session_id=session_id,
            payment_mode='HOLD',
            payment_status='PENDING'
        )
        return Response(DeliveryOrderSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], permission_classes=[])
    def submit_code(self, request, pk=None):
        """
        Driver enters the 6-digit code given by the CLIENT to confirm delivery.
        Code 2: Driver ↔ Client
        """
        delivery = self.get_object()

        if not delivery.require_client_delivery_code:
            # Code not required — just mark delivered
            delivery.status = 'DELIVERED'
            delivery.delivered_at = timezone.now()
            delivery.save(update_fields=['status', 'delivered_at'])
            
            # Trigger fleet logic
            DeliveryFleetService.on_delivery_completed(delivery, request.user)
            
            return Response(DeliveryOrderSerializer(delivery).data)

        submitted = str(request.data.get('code', '')).strip()
        if not submitted:
            return Response({'error': 'Code is required. Ask the client for their code.'}, status=400)

        if submitted != delivery.client_delivery_code:
            return Response({'error': 'Invalid code. Ask the client again.'}, status=400)

        delivery.status = 'DELIVERED'
        delivery.delivered_at = timezone.now()
        delivery.save(update_fields=['status', 'delivered_at'])
        
        # Trigger fleet logic
        DeliveryFleetService.on_delivery_completed(delivery, request.user)
        
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'], permission_classes=[])
    def update_location(self, request, pk=None):
        """
        Driver updates GPS location from their phone.
        Body: { lat: float, lng: float }
        """
        delivery = self.get_object()
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        if lat is None or lng is None:
            return Response({'error': 'lat and lng required'}, status=400)
        delivery.driver_latitude = lat
        delivery.driver_longitude = lng
        delivery.last_gps_at = timezone.now()
        delivery.save(update_fields=['driver_latitude', 'driver_longitude', 'last_gps_at'])
        return Response({'ok': True, 'lat': str(lat), 'lng': str(lng)})

    @action(detail=True, methods=['get'], permission_classes=[])
    def driver_view(self, request, pk=None):
        """
        Public endpoint for the driver's mobile page.
        Secured by the tracking_code in the URL query param.
        """
        delivery = self.get_object()
        token = request.query_params.get('token', '')
        if not delivery.tracking_code or delivery.tracking_code != token:
            return Response({'error': 'Invalid token'}, status=403)
        return Response(DeliveryOrderSerializer(delivery).data)
