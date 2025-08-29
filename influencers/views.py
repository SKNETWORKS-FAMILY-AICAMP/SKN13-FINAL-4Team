from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser
from .models import Influencer
from .serializers import InfluencerSerializer, InfluencerWriteSerializer

class InfluencerViewSet(viewsets.ModelViewSet):
    queryset = Influencer.objects.all().order_by('name')
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InfluencerWriteSerializer
        return InfluencerSerializer