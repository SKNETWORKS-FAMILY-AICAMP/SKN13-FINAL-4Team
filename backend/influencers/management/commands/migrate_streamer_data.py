"""
Streamer 및 StreamerTTSSettings 데이터를 Influencer 모델로 마이그레이션하는 관리 명령어
"""
from django.core.management.base import BaseCommand
from django.db import transaction
import json
import os
from influencers.models import Influencer
from users.models import Streamer
from chat.models import StreamerTTSSettings


class Command(BaseCommand):
    help = 'Migrate Streamer and StreamerTTSSettings data to Influencer model'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually doing it',
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN MODE - 실제로 데이터를 변경하지 않습니다'))
        
        self.stdout.write('🚀 Streamer → Influencer 데이터 마이그레이션 시작')
        
        # video_assets.json 로드
        video_assets_data = self.load_video_assets()
        
        try:
            with transaction.atomic():
                self.migrate_streamers(video_assets_data, dry_run)
                self.migrate_tts_settings(dry_run)
                
                if dry_run:
                    # 트랜잭션 롤백
                    raise Exception("DRY RUN - 변경사항 롤백")
                    
        except Exception as e:
            if not dry_run:
                self.stdout.write(self.style.ERROR(f'❌ 마이그레이션 실패: {e}'))
                raise
            else:
                self.stdout.write(self.style.SUCCESS('✅ DRY RUN 완료 - 실제 변경 없음'))
        
        if not dry_run:
            self.stdout.write(self.style.SUCCESS('✅ 데이터 마이그레이션 완료'))
    
    def load_video_assets(self):
        """video_assets.json 파일 로드"""
        try:
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'config',
                'video_assets.json'
            )
            
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ video_assets.json 로드 실패: {e}'))
            return {'characters': {}}
    
    def migrate_streamers(self, video_assets_data, dry_run):
        """Streamer 데이터를 Influencer로 마이그레이션"""
        try:
            streamers = Streamer.objects.all()
            self.stdout.write(f'📋 {streamers.count()}개의 Streamer 레코드 발견')
            
            for streamer in streamers:
                # 기존 Influencer가 있는지 확인
                try:
                    existing = Influencer.objects.get(character_id=streamer.character_id)
                    self.stdout.write(f'⚠️ 이미 존재하는 Influencer: {streamer.character_id}')
                    
                    # 기존 데이터 업데이트
                    if not dry_run:
                        self.update_existing_influencer(existing, streamer, video_assets_data)
                    
                    continue
                except Influencer.DoesNotExist:
                    pass
                
                # video_assets.json에서 해당 캐릭터 데이터 가져오기
                character_data = video_assets_data.get('characters', {}).get(streamer.character_id, {})
                
                influencer_data = {
                    'name': streamer.display_name,
                    'character_id': streamer.character_id,
                    'video_directory': streamer.video_directory,
                    'character_type': streamer.character_type or '',
                    'is_active': streamer.is_active,
                    'order': streamer.order,
                    'age': 25,  # 기본값
                    'gender': '여',  # 기본값
                    'job': 'AI 인플루언서',  # 기본값
                    'video_categories': character_data.get('videoCategories', {}),
                    'emotion_mapping': character_data.get('emotionMapping', {}),
                    'fallback_video': character_data.get('fallbackVideo', ''),
                }
                
                if dry_run:
                    self.stdout.write(f'[DRY RUN] 생성할 Influencer: {streamer.character_id}')
                    self.stdout.write(f'  - 이름: {influencer_data["name"]}')
                    self.stdout.write(f'  - 비디오 카테고리: {len(influencer_data["video_categories"])}개')
                else:
                    influencer = Influencer.objects.create(**influencer_data)
                    self.stdout.write(f'✅ Influencer 생성: {influencer.character_id}')
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Streamer 마이그레이션 오류: {e}'))
            raise
    
    def update_existing_influencer(self, influencer, streamer, video_assets_data):
        """기존 Influencer 업데이트"""
        character_data = video_assets_data.get('characters', {}).get(streamer.character_id, {})
        
        # 스트리밍 관련 필드만 업데이트
        influencer.character_id = streamer.character_id
        influencer.video_directory = streamer.video_directory
        influencer.character_type = streamer.character_type or ''
        influencer.is_active = streamer.is_active
        influencer.order = streamer.order
        
        # 비디오 에셋 데이터 업데이트 (기존 데이터가 없는 경우에만)
        if not influencer.video_categories:
            influencer.video_categories = character_data.get('videoCategories', {})
        if not influencer.emotion_mapping:
            influencer.emotion_mapping = character_data.get('emotionMapping', {})
        if not influencer.fallback_video:
            influencer.fallback_video = character_data.get('fallbackVideo', '')
        
        influencer.save()
        self.stdout.write(f'📝 Influencer 업데이트: {influencer.character_id}')
    
    def migrate_tts_settings(self, dry_run):
        """StreamerTTSSettings 데이터를 Influencer로 마이그레이션"""
        try:
            tts_settings = StreamerTTSSettings.objects.all()
            self.stdout.write(f'🎤 {tts_settings.count()}개의 TTS 설정 레코드 발견')
            
            for setting in tts_settings:
                try:
                    if dry_run:
                        influencer = Influencer.objects.get(character_id=setting.streamer_id)
                    else:
                        influencer = Influencer.objects.get(character_id=setting.streamer_id)
                    
                    # TTS 설정 데이터 매핑
                    tts_data = {
                        'tts_engine': setting.tts_engine,
                        'elevenlabs_voice': setting.elevenlabs_voice,
                        'elevenlabs_model': setting.elevenlabs_model,
                        'tts_stability': setting.elevenlabs_stability,
                        'tts_similarity_boost': setting.elevenlabs_similarity,
                        'tts_style': setting.elevenlabs_style,
                        'tts_use_speaker_boost': setting.elevenlabs_use_speaker_boost,
                        'sync_mode': setting.sync_mode,
                        'streaming_delay': setting.streaming_delay,
                        'tts_delay': setting.tts_delay,
                        'chunk_size': setting.chunk_size,
                        'auto_play': setting.auto_play,
                    }
                    
                    if dry_run:
                        self.stdout.write(f'[DRY RUN] TTS 설정 이전: {setting.streamer_id}')
                        self.stdout.write(f'  - 엔진: {tts_data["tts_engine"]}')
                        self.stdout.write(f'  - 음성: {tts_data["elevenlabs_voice"]}')
                    else:
                        # Influencer에 TTS 설정 적용
                        for key, value in tts_data.items():
                            setattr(influencer, key, value)
                        
                        influencer.save()
                        self.stdout.write(f'🎤 TTS 설정 이전 완료: {setting.streamer_id}')
                        
                except Influencer.DoesNotExist:
                    self.stdout.write(f'⚠️ TTS 설정에 해당하는 Influencer 없음: {setting.streamer_id}')
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ TTS 설정 마이그레이션 오류: {e}'))
            raise