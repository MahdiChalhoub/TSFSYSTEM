from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ScoreRuleViewSet, EmployeeScoreEventViewSet,
    EmployeeScoreSummaryViewSet, EmployeeBadgeViewSet,
    EmployeeScorePeriodViewSet
)

router = DefaultRouter()
router.register(r'rules', ScoreRuleViewSet)
router.register(r'events', EmployeeScoreEventViewSet)
router.register(r'summaries', EmployeeScoreSummaryViewSet)
router.register(r'badges', EmployeeBadgeViewSet)
router.register(r'periods', EmployeeScorePeriodViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
