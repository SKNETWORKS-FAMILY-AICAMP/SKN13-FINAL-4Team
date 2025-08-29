from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InfluencerViewSet

router = DefaultRouter()
router.register('', InfluencerViewSet, basename='influencer')

urlpatterns = [
    path('', include(router.urls)),
]
