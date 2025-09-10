from django.db.models import Sum 
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated ,IsAuthenticatedOrReadOnly 
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .models import Influencer, Story, Like, Donation, InfluencerTTSSettings
from .serializers import InfluencerSerializer, InfluencerWriteSerializer, StorySerializer, DonationRankingSerializer, InfluencerTTSSettingsSerializer

class InfluencerViewSet(viewsets.ModelViewSet):
    """인플루언서 관리용 뷰 셋"""
    queryset = Influencer.objects.all().order_by('name')
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InfluencerWriteSerializer
        return InfluencerSerializer

class StoryViewSet(viewsets.ModelViewSet):
    """인플루언서 사연 관련 뷰 셋"""
    queryset = Story.objects.all()
    serializer_class = StorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """URL의 influencer_pk를 이용해 해당 인플루언서의 사연만 필터링 해줌"""
        return self.queryset.filter(influencer_id=self.kwargs['influencer_pk'])

    def pervform_create(self, serialiuzer):
        """사연 생성 시 작성자를 현재 로그인 한 유저로 지정"""
        serializer.save(
            author=self.request.user, 
            influencer_id=self.kwargs['influencer_pk'])

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_like(request, pk=None):
    try:
        influencer = Influencer.objects.get(pk=pk)
        user = request.user
        
        # get_or_create: 좋아요 객체가 있으면 가져오고, 없으면 생성
        like, created = Like.objects.get_or_create(influencer=influencer, user=user)

        if created:
            # 새로 생성되었다면 (좋아요를 누름)
            influencer.like_count += 1
            liked = True
        else:
            # 이미 존재했다면 (좋아요를 취소함)
            like.delete()
            influencer.like_count -= 1
            liked = False
        
        influencer.save()
        return Response({'status': 'success', 'liked': liked, 'like_count': influencer.like_count})

    except Influencer.DoesNotExist:
        return Response({'status': 'error', 'message': 'Influencer not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def get_donation_rankings(request, pk=None):
    """특정 인플루언서의 상위 후원자 목록 (열혈 순위)을 반환합니다."""
    try:
        influencer = Influencer.objects.get(pk=pk)
        rankings_query = Donation.objects.filter(
            influencer=influencer
        ).values(
            'donor__nickname' # 후원자의 닉네임으로 그룹화
        ).annotate(
            total_amount=Sum('amount')
        ).order_by('-total_amount')[:10]

        rankings_data = []
        for i, item in enumerate(rankings_query):
            rankings_data.append({
                'rank': i + 1,
                'donor_nickname': item['donor__nickname'],
                'total_amount': item['total_amount']
            })

        serializer = DonationRankingSerializer(rankings_data, many=True)
        return Response(serializer.data)

    except Influencer.DoesNotExist:
        return Response({'status': 'error', 'message': 'Influencer not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def manage_tts_settings(request, pk=None):
    """특정 인플루언서의 TTS 설정 관리"""
    try:
        influencer = Influencer.objects.get(pk=pk)
    except Influencer.DoesNotExist:
        return Response({'status': 'error', 'message': 'Influencer not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        # TTS 설정 조회 (없으면 기본값으로 생성)
        tts_settings, created = InfluencerTTSSettings.get_or_create_for_influencer(influencer)
        serializer = InfluencerTTSSettingsSerializer(tts_settings, context={'request': request})
        return Response({
            'status': 'success', 
            'data': serializer.data,
            'created': created
        })
    
    elif request.method == 'POST':
        # TTS 설정 생성
        try:
            # 기존 설정이 있는지 확인
            existing_settings = InfluencerTTSSettings.objects.get(influencer=influencer)
            return Response({
                'status': 'error', 
                'message': 'TTS settings already exist for this influencer. Use PATCH to update.'
            }, status=status.HTTP_400_BAD_REQUEST)
        except InfluencerTTSSettings.DoesNotExist:
            # 새 설정 생성
            data = request.data.copy()
            data['influencer'] = influencer.id
            
            serializer = InfluencerTTSSettingsSerializer(data=data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response({
                    'status': 'success', 
                    'data': serializer.data,
                    'message': 'TTS settings created successfully'
                }, status=status.HTTP_201_CREATED)
            return Response({
                'status': 'error', 
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'PATCH':
        # TTS 설정 수정
        try:
            tts_settings = InfluencerTTSSettings.objects.get(influencer=influencer)
        except InfluencerTTSSettings.DoesNotExist:
            # 설정이 없으면 기본값으로 생성 후 수정
            tts_settings, _ = InfluencerTTSSettings.get_or_create_for_influencer(influencer)
        
        serializer = InfluencerTTSSettingsSerializer(
            tts_settings, 
            data=request.data, 
            partial=True, 
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                'status': 'success', 
                'data': serializer.data,
                'message': 'TTS settings updated successfully'
            })
        return Response({
            'status': 'error', 
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        # TTS 설정 삭제
        try:
            tts_settings = InfluencerTTSSettings.objects.get(influencer=influencer)
            tts_settings.delete()
            return Response({
                'status': 'success', 
                'message': 'TTS settings deleted successfully'
            })
        except InfluencerTTSSettings.DoesNotExist:
            return Response({
                'status': 'error', 
                'message': 'TTS settings not found'
            }, status=status.HTTP_404_NOT_FOUND)
