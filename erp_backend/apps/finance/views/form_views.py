from .base import (
    viewsets, status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
    Organization,
)
from rest_framework import serializers as drf_serializers
from apps.finance.models import FormDefinition, FormResponse


class FormDefinitionSerializer(drf_serializers.ModelSerializer):
    field_count = drf_serializers.SerializerMethodField()

    class Meta:
        model = FormDefinition
        fields = [
            'id', 'key', 'name', 'description', 'schema',
            'is_active', 'field_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_field_count(self, obj):
        return len(obj.schema.get('fields', []))


class FormResponseSerializer(drf_serializers.ModelSerializer):
    form_key = drf_serializers.ReadOnlyField(source='form_definition.key')
    form_name = drf_serializers.ReadOnlyField(source='form_definition.name')

    class Meta:
        model = FormResponse
        fields = [
            'id', 'form_definition', 'form_key', 'form_name',
            'entity_type', 'entity_id', 'data',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']


class FormDefinitionViewSet(TenantModelViewSet):
    queryset = FormDefinition.objects.all()
    serializer_class = FormDefinitionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('active_only') == 'true':
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        serializer.save(organization=organization)

    @action(detail=True, methods=['get'], url_path='responses')
    def responses(self, request, pk=None):
        """List all responses for this form definition."""
        form = self.get_object()
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')

        qs = FormResponse.objects.filter(
            form_definition=form,
            organization=form.organization,
        )
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if entity_id:
            qs = qs.filter(entity_id=entity_id)

        serializer = FormResponseSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_schema(self, request, pk=None):
        """
        Validate a data payload against this form's schema.
        Returns { valid: bool, errors: { field_key: message } }
        """
        form = self.get_object()
        data = request.data.get('data', {})
        errors = {}

        for field in form.fields:
            key = field.get('key')
            if not key:
                continue
            value = data.get(key)
            required = field.get('required', False)

            if required and (value is None or value == ''):
                errors[key] = f"{field.get('label', key)} is required."
                continue

            if value is None or value == '':
                continue

            ftype = field.get('type', 'text')
            if ftype in ('number', 'decimal'):
                try:
                    num = float(value)
                    mn = field.get('min')
                    mx = field.get('max')
                    if mn is not None and num < mn:
                        errors[key] = f"Must be at least {mn}."
                    elif mx is not None and num > mx:
                        errors[key] = f"Must be at most {mx}."
                except (TypeError, ValueError):
                    errors[key] = "Must be a number."

            elif ftype == 'select':
                options = field.get('options', [])
                if options and str(value) not in [str(o) for o in options]:
                    errors[key] = f"Must be one of: {', '.join(str(o) for o in options)}."

        return Response({'valid': len(errors) == 0, 'errors': errors})


class FormResponseViewSet(TenantModelViewSet):
    queryset = FormResponse.objects.all()
    serializer_class = FormResponseSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('form_definition')
        form_key = self.request.query_params.get('form_key')
        form_id = self.request.query_params.get('form_id')
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')

        if form_key:
            qs = qs.filter(form_definition__key=form_key)
        if form_id:
            qs = qs.filter(form_definition_id=form_id)
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if entity_id:
            qs = qs.filter(entity_id=entity_id)

        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        serializer.save(organization=organization, created_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='upsert')
    def upsert(self, request):
        """
        Create or update a response for a specific (form, entity_type, entity_id) triple.
        Body: { form_key, entity_type, entity_id, data }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'No organization context'}, status=400)
        organization = Organization.objects.get(id=org_id)

        form_key = request.data.get('form_key')
        entity_type = request.data.get('entity_type', '')
        entity_id = request.data.get('entity_id')
        data = request.data.get('data', {})

        if not form_key:
            return Response({'error': 'form_key is required'}, status=400)

        try:
            form_def = FormDefinition.objects.get(organization=organization, key=form_key)
        except FormDefinition.DoesNotExist:
            return Response({'error': f"Form '{form_key}' not found"}, status=404)

        lookup = dict(
            form_definition=form_def,
            organization=organization,
            entity_type=entity_type or '',
        )
        if entity_id is not None:
            lookup['entity_id'] = entity_id

        response_obj, created = FormResponse.objects.update_or_create(
            **lookup,
            defaults={'data': data, 'created_by': request.user},
        )

        serializer = FormResponseSerializer(response_obj)
        return Response(serializer.data, status=201 if created else 200)
