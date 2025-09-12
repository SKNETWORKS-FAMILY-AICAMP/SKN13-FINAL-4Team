from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.core.cache import cache
import json
import logging

from .models import TTSLog
from .serializers import TTSLogSerializer

logger = logging.getLogger(__name__)

class TTSLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    TTS 디버그 로그를 조회하기 위한 ViewSet.
    관리자만 접근 가능하며, 목록 조회 시 캐싱을 사용합니다.
    """
    queryset = TTSLog.objects.all()
    serializer_class = TTSLogSerializer
    permission_classes = [IsAdminUser]

    # 캐시 키를 상수로 정의
    TTS_LOG_LIST_CACHE_KEY = 'tts_log_list'

    def list(self, request, *args, **kwargs):
        """
        TTS 로그 목록을 조회할 때 캐시를 우선적으로 확인하는 로직
        """
        # 1. 캐시에서 로그 목록을 먼저 확인합니다.
        try:
            cached_list_json = cache.get(self.TTS_LOG_LIST_CACHE_KEY)
            if cached_list_json:
                logger.info("Cache Hit: Fetching TTS log list from cache")
                cached_list = json.loads(cached_list_json)
                # DRF 페이지네이션 형식에 맞춰 반환
                return Response({
                    'count': len(cached_list),
                    'next': None,
                    'previous': None,
                    'results': cached_list
                })
        except Exception as e:
            logger.error(f"TTS Log Cache get failed: {e}")

        # 2. 캐시가 없으면 DB에서 조회하고, 결과를 캐시에 저장합니다.
        logger.info("Cache Miss: Fetching TTS logs from DB and populating cache")
        response = super().list(request, *args, **kwargs)
        results = response.data.get('results', [])
        
        if results:
            try:
                # 60초간 캐시 저장
                cache.set(self.TTS_LOG_LIST_CACHE_KEY, json.dumps(results), timeout=60)
            except Exception as e:
                logger.error(f"TTS Log Cache set failed: {e}")
        
        return response
