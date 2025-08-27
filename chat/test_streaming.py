"""
스트리밍 동기화 시스템 단위 테스트
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from chat.models import ChatRoom, StreamerTTSSettings
from chat.tts_elevenlabs_service import ElevenLabsService
from django.conf import settings

User = get_user_model()


class StreamingSystemTests(TestCase):
    """스트리밍 시스템 단위 테스트"""
    
    def setUp(self):
        """테스트 데이터 설정"""
        self.user = User.objects.create_user(
            username='teststreamer',
            email='test@example.com',
            password='testpass123'
        )
        
        self.chat_room = ChatRoom.objects.create(
            name='테스트 방',
            host=self.user,
            influencer=self.user,
            description='테스트용 채팅방'
        )
    
    def test_chat_room_creation(self):
        """채팅방 생성 테스트"""
        self.assertEqual(self.chat_room.name, '테스트 방')
        self.assertEqual(self.chat_room.host, self.user)
        self.assertEqual(self.chat_room.influencer, self.user)
        self.assertIsNotNone(self.chat_room.created_at)
    
    def test_tts_settings_creation(self):
        """TTS 설정 생성 테스트"""
        tts_settings = StreamerTTSSettings.objects.create(
            streamer_id='teststreamer',
            tts_engine='elevenlabs',
            elevenlabs_voice='aneunjin',
            elevenlabs_model='eleven_multilingual_v2',
            elevenlabs_stability=0.5,
            elevenlabs_similarity=0.5,
            auto_play=True
        )
        
        self.assertEqual(tts_settings.streamer_id, 'teststreamer')
        self.assertEqual(tts_settings.tts_engine, 'elevenlabs')
        self.assertEqual(tts_settings.elevenlabs_voice, 'aneunjin')
        self.assertTrue(tts_settings.auto_play)
    
    def test_elevenlabs_service_initialization(self):
        """ElevenLabs 서비스 초기화 테스트"""
        if hasattr(settings, 'ELEVENLABS_API_KEY') and settings.ELEVENLABS_API_KEY:
            service = ElevenLabsService()
            self.assertIsNotNone(service)
        else:
            self.skipTest("ELEVENLABS_API_KEY not configured")
    
    def test_user_streaming_permissions(self):
        """사용자 스트리밍 권한 테스트"""
        self.assertTrue(self.user.is_authenticated)
        
        # 사용자가 자신의 채팅방을 소유하는지 확인
        user_rooms = ChatRoom.objects.filter(host=self.user)
        self.assertIn(self.chat_room, user_rooms)


class StreamingAPITests(TestCase):
    """스트리밍 API 단위 테스트"""
    
    def setUp(self):
        """테스트 데이터 설정"""
        self.user = User.objects.create_user(
            username='apitest',
            email='api@example.com', 
            password='testpass123'
        )
        
        self.chat_room = ChatRoom.objects.create(
            name='API 테스트 방',
            host=self.user,
            influencer=self.user
        )
    
    def test_chat_room_api_structure(self):
        """채팅방 API 구조 테스트"""
        room_data = {
            'id': self.chat_room.id,
            'name': self.chat_room.name,
            'host': self.chat_room.host.username,
            'influencer': self.chat_room.influencer.username,
            'created_at': self.chat_room.created_at
        }
        
        self.assertIsInstance(room_data['id'], int)
        self.assertIsInstance(room_data['name'], str)
        self.assertIsInstance(room_data['host'], str)
        self.assertIsInstance(room_data['influencer'], str)