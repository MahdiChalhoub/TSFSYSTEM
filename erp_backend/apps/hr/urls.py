"""
HR Module URL Configuration
Routes for employee management, departments, shifts, attendance, and leave.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.hr.views import (
    EmployeeViewSet, DepartmentViewSet, ShiftViewSet,
    AttendanceViewSet, LeaveViewSet
)

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'departments', DepartmentViewSet)
router.register(r'shifts', ShiftViewSet)
router.register(r'attendance', AttendanceViewSet)
router.register(r'leaves', LeaveViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
