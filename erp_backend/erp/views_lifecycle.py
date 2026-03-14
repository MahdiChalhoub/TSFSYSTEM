"""
Lifecycle Management API Views
================================
REST API endpoints for transaction lifecycle operations.

Endpoints:
- POST /api/lifecycle/lock/
- POST /api/lifecycle/unlock/
- POST /api/lifecycle/verify/
- POST /api/lifecycle/verify-complete/
- POST /api/lifecycle/unverify/
- GET  /api/lifecycle/history/<type>/<id>/
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError, PermissionDenied
from django.apps import apps
from .lifecycle_service import TransactionLifecycleService


def get_model_instance(model_name, instance_id, organization):
    """
    Get model instance by name and ID.

    Args:
        model_name: String like 'Invoice', 'Order', 'JournalEntry'
        instance_id: Primary key
        organization: Organization instance

    Returns:
        Model instance

    Raises:
        ValueError: If model not found
    """
    # Map common names to actual models
    model_map = {
        'invoice': 'apps.finance.Invoice',
        'order': 'apps.pos.Order',
        'journalentry': 'apps.finance.JournalEntry',
        'payment': 'apps.finance.Payment',
        'stockadjustment': 'apps.inventory.StockAdjustment',
        'refund': 'apps.finance.Refund',
    }

    model_path = model_map.get(model_name.lower())
    if not model_path:
        raise ValueError(f"Unknown model: {model_name}")

    app_label, model_class_name = model_path.split('.')
    Model = apps.get_model(app_label, model_class_name)

    try:
        return Model.objects.get(pk=instance_id, organization=organization)
    except Model.DoesNotExist:
        raise ValueError(f"{model_name} #{instance_id} not found")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lock_transaction(request):
    """
    Lock a transaction (OPEN → LOCKED).

    POST /api/lifecycle/lock/

    Payload:
    {
        "model": "Invoice",
        "instance_id": 123,
        "transaction_type": "SALES_INVOICE",
        "comment": "Optional comment"
    }

    Response:
    {
        "success": true,
        "lifecycle_status": "LOCKED",
        "required_levels": 2,
        "current_level": 0,
        "verification_progress": "L0 / L2",
        "message": "Transaction locked successfully"
    }
    """
    try:
        organization = request.organization
        if not organization:
            return Response(
                {"error": "No organization context"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract parameters
        model_name = request.data.get('model')
        instance_id = request.data.get('instance_id')
        transaction_type = request.data.get('transaction_type')
        comment = request.data.get('comment')

        if not all([model_name, instance_id, transaction_type]):
            return Response(
                {"error": "Missing required fields: model, instance_id, transaction_type"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get instance
        instance = get_model_instance(model_name, instance_id, organization)

        # Get client IP
        ip_address = request.META.get('REMOTE_ADDR')

        # Initialize service
        service = TransactionLifecycleService(organization, request.user, ip_address)

        # Lock transaction
        instance = service.lock(instance, transaction_type, comment)

        return Response({
            "success": True,
            "lifecycle_status": instance.lifecycle_status,
            "required_levels": instance.required_levels_frozen,
            "current_level": instance.current_verification_level,
            "verification_progress": instance.verification_progress,
            "is_controlled": instance.is_controlled,
            "locked_at": instance.locked_at.isoformat() if instance.locked_at else None,
            "locked_by": instance.locked_by.username if instance.locked_by else None,
            "message": "Transaction locked successfully"
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Unexpected error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unlock_transaction(request):
    """
    Unlock a transaction (LOCKED → OPEN).

    POST /api/lifecycle/unlock/

    Payload:
    {
        "model": "Invoice",
        "instance_id": 123,
        "transaction_type": "SALES_INVOICE",
        "comment": "Reason for unlocking (MANDATORY)"
    }
    """
    try:
        organization = request.organization
        model_name = request.data.get('model')
        instance_id = request.data.get('instance_id')
        transaction_type = request.data.get('transaction_type')
        comment = request.data.get('comment')

        if not comment or not comment.strip():
            return Response(
                {"error": "Comment is mandatory for unlock operation"},
                status=status.HTTP_400_BAD_REQUEST
            )

        instance = get_model_instance(model_name, instance_id, organization)
        ip_address = request.META.get('REMOTE_ADDR')
        service = TransactionLifecycleService(organization, request.user, ip_address)

        instance = service.unlock(instance, transaction_type, comment)

        return Response({
            "success": True,
            "lifecycle_status": instance.lifecycle_status,
            "message": "Transaction unlocked successfully"
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_transaction(request):
    """
    Verify transaction (increment level by 1).

    POST /api/lifecycle/verify/

    Payload:
    {
        "model": "Invoice",
        "instance_id": 123,
        "transaction_type": "SALES_INVOICE",
        "comment": "Optional comment"
    }
    """
    try:
        organization = request.organization
        model_name = request.data.get('model')
        instance_id = request.data.get('instance_id')
        transaction_type = request.data.get('transaction_type')
        comment = request.data.get('comment')

        instance = get_model_instance(model_name, instance_id, organization)
        ip_address = request.META.get('REMOTE_ADDR')
        service = TransactionLifecycleService(organization, request.user, ip_address)

        instance = service.verify(instance, transaction_type, comment)

        return Response({
            "success": True,
            "lifecycle_status": instance.lifecycle_status,
            "current_level": instance.current_verification_level,
            "required_levels": instance.required_levels_frozen,
            "verification_progress": instance.verification_progress,
            "is_fully_verified": instance.is_fully_verified,
            "message": f"Verified at level {instance.current_verification_level}"
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except PermissionDenied as e:
        return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_and_complete(request):
    """
    Manager override: Verify and complete in one step.

    POST /api/lifecycle/verify-complete/

    Payload:
    {
        "model": "Invoice",
        "instance_id": 123,
        "transaction_type": "SALES_INVOICE",
        "comment": "Reason for override (MANDATORY)"
    }
    """
    try:
        organization = request.organization
        model_name = request.data.get('model')
        instance_id = request.data.get('instance_id')
        transaction_type = request.data.get('transaction_type')
        comment = request.data.get('comment')

        if not comment or not comment.strip():
            return Response(
                {"error": "Comment is mandatory for override operation"},
                status=status.HTTP_400_BAD_REQUEST
            )

        instance = get_model_instance(model_name, instance_id, organization)
        ip_address = request.META.get('REMOTE_ADDR')
        service = TransactionLifecycleService(organization, request.user, ip_address)

        instance = service.verify_and_complete(instance, transaction_type, comment)

        return Response({
            "success": True,
            "lifecycle_status": instance.lifecycle_status,
            "current_level": instance.current_verification_level,
            "required_levels": instance.required_levels_frozen,
            "verification_progress": instance.verification_progress,
            "message": "Transaction verified and completed (override)"
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except PermissionDenied as e:
        return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unverify_transaction(request):
    """
    Unverify transaction (decrement level by 1).

    POST /api/lifecycle/unverify/

    Payload:
    {
        "model": "Invoice",
        "instance_id": 123,
        "transaction_type": "SALES_INVOICE",
        "comment": "Reason for unverify (MANDATORY)"
    }
    """
    try:
        organization = request.organization
        model_name = request.data.get('model')
        instance_id = request.data.get('instance_id')
        transaction_type = request.data.get('transaction_type')
        comment = request.data.get('comment')

        if not comment or not comment.strip():
            return Response(
                {"error": "Comment is mandatory for unverify operation"},
                status=status.HTTP_400_BAD_REQUEST
            )

        instance = get_model_instance(model_name, instance_id, organization)
        ip_address = request.META.get('REMOTE_ADDR')
        service = TransactionLifecycleService(organization, request.user, ip_address)

        instance = service.unverify(instance, transaction_type, comment)

        return Response({
            "success": True,
            "lifecycle_status": instance.lifecycle_status,
            "current_level": instance.current_verification_level,
            "verification_progress": instance.verification_progress,
            "message": "Verification level decremented"
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_transaction_history(request, model_name, instance_id):
    """
    Get lifecycle history for a transaction.

    GET /api/lifecycle/history/<model>/<id>/

    Example: GET /api/lifecycle/history/invoice/123/

    Response:
    {
        "success": true,
        "history": [
            {
                "action": "LOCK",
                "level": 0,
                "performed_by": "john@example.com",
                "performed_at": "2026-03-04T10:30:00Z",
                "comment": "Ready for review",
                "meta": {...}
            },
            ...
        ]
    }
    """
    try:
        organization = request.organization
        instance = get_model_instance(model_name, instance_id, organization)

        # Get transaction type from instance
        # This assumes the model has a transaction_type field or we can infer it
        transaction_type = getattr(instance, 'transaction_type', model_name.upper())

        # Get history
        history = TransactionLifecycleService.get_history(transaction_type, instance_id)

        # Serialize history
        history_data = [
            {
                "action": log.action,
                "level": log.level,
                "performed_by": log.performed_by.username if log.performed_by else None,
                "performed_at": log.performed_at.isoformat(),
                "comment": log.comment,
                "ip_address": log.ip_address,
                "meta": log.meta
            }
            for log in history
        ]

        return Response({
            "success": True,
            "history": history_data,
            "count": len(history_data)
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
