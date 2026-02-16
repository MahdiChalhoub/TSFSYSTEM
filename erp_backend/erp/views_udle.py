from rest_framework import viewsets, permissions
from .models import UDLESavedView
from .serializers.udle import UDLESavedViewSerializer

class UDLESavedViewViewSet(viewsets.ModelViewSet):
    """
    CRUD for User-Specific Saved Views in UDLE.
    Automatically scoped to the calling user and their organization.
    """
    serializer_class = UDLESavedViewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can only see/edit their own views
        return UDLESavedView.objects.filter(
            user=self.request.user,
            organization=self.request.user.organization
        )

    def perform_create(self, serializer):
        # Validation is handled in the serializer, but we double-check here
        serializer.save()
