"""
Workspace Module — URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# Task Management
router.register(r'task-categories', views.TaskCategoryViewSet, basename='task-category')
router.register(r'templates', views.TaskTemplateViewSet, basename='task-template')
router.register(r'auto-rules', views.AutoTaskRuleViewSet, basename='auto-task-rule')
# Alias — some frontend callers hit /auto-task-rules/ instead of /auto-rules/.
router.register(r'auto-task-rules', views.AutoTaskRuleViewSet, basename='auto-task-rule-alias')
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'comments', views.TaskCommentViewSet, basename='task-comment')
router.register(r'requests', views.EmployeeRequestViewSet, basename='employee-request')
router.register(r'user-groups', views.UserGroupViewSet, basename='user-group')
router.register(r'user-hierarchy', views.UserHierarchyViewSet, basename='user-hierarchy')

# Checklists
router.register(r'checklist-templates', views.ChecklistTemplateViewSet, basename='checklist-template')
router.register(r'checklist-items', views.ChecklistTemplateItemViewSet, basename='checklist-item')
router.register(r'checklists', views.ChecklistInstanceViewSet, basename='checklist-instance')

# Questionnaires
router.register(r'questionnaires', views.QuestionnaireViewSet, basename='questionnaire')
router.register(r'questions', views.QuestionnaireQuestionViewSet, basename='questionnaire-question')
router.register(r'evaluations', views.QuestionnaireResponseViewSet, basename='questionnaire-response')

# Dashboard & Config
router.register(r'config', views.WorkspaceConfigViewSet, basename='workspace-config')
router.register(r'performance', views.EmployeePerformanceViewSet, basename='employee-performance')

urlpatterns = [
    path('', include(router.urls)),
]
