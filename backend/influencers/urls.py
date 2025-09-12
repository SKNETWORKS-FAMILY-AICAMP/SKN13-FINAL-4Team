from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from .views import InfluencerViewSet
from . import views

router = DefaultRouter()
router.register('', InfluencerViewSet, basename='influencer')

influencer_router = routers.NestedSimpleRouter(router, r'', lookup='influencer')
influencer_router.register(r'stories', views.StoryViewSet, basename='influencer-stories')

urlpatterns = [
    path('<int:pk>/rankings/', views.get_donation_rankings, name='influencer-rankings'),
    path('<int:pk>/like/', views.toggle_like, name='influencer-toggle-like'),
    path('<int:pk>/tts-settings/', views.manage_tts_settings, name='influencer-tts-settings'),

    path('', include(router.urls)),
    path('', include(influencer_router.urls)),
]
