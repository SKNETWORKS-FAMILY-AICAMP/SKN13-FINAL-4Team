from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat'
    
    def ready(self):
        # ⬅️ 이 메소드와 아래 import 구문을 추가하세요.
        import chat.signals 