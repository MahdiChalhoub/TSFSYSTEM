from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'stores', views.EcommerceIntegrationViewSet, basename='ecommerce-stores')
router.register(r'product-mappings', views.ExternalProductMappingViewSet, basename='product-mappings')
router.register(r'order-mappings', views.ExternalOrderMappingViewSet, basename='order-mappings')

urlpatterns = [
    path('', include(router.urls)),
]
