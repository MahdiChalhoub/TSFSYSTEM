"""
User Tour Completion Views
==========================
GET   /api/user-tours/           → list the current user's tour completions
POST  /api/user-tours/           → upsert a completion (body: tour_id, version)
DELETE /api/user-tours/<tour_id>/ → reset one tour so it auto-shows again
DELETE /api/user-tours/          → reset all tours for the user

All endpoints are authenticated — unauthenticated users fall back to
localStorage on the frontend.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models_tours import UserTourCompletion


def _serialize(completion: UserTourCompletion) -> dict:
    return {
        'tour_id': completion.tour_id,
        'completed_version': completion.completed_version,
        'completed_at': completion.completed_at.isoformat() if completion.completed_at else None,
    }


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_tours_collection(request):
    """List all of the user's tour completions, or upsert a completion.
    DELETE (with no tour_id) resets every tour for the user."""
    user = request.user

    if request.method == 'GET':
        qs = UserTourCompletion.objects.filter(user=user).order_by('tour_id')
        return Response({'completions': [_serialize(c) for c in qs]})

    if request.method == 'POST':
        tour_id = (request.data or {}).get('tour_id')
        version = (request.data or {}).get('version', 1)
        if not tour_id:
            return Response({'error': 'tour_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            version = int(version)
        except (TypeError, ValueError):
            version = 1

        completion, _ = UserTourCompletion.objects.update_or_create(
            user=user,
            tour_id=tour_id,
            defaults={'completed_version': version},
        )
        return Response(_serialize(completion), status=status.HTTP_200_OK)

    # DELETE — reset all tours for this user
    deleted, _ = UserTourCompletion.objects.filter(user=user).delete()
    return Response({'deleted': deleted})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def user_tours_detail(request, tour_id: str):
    """Reset a single tour so it auto-starts again on next visit."""
    UserTourCompletion.objects.filter(user=request.user, tour_id=tour_id).delete()
    return Response({'reset': tour_id})
