"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""
import os
from django.core.asgi import get_asgi_application

# 1. Django 설정 모듈을 먼저 지정합니다.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# 2. Django의 ASGI 애플리케이션을 로드하여 설정을 초기화합니다.
django_asgi_app = get_asgi_application()

# 3. Django 설정이 완료된 후에 Channels 관련 모듈을 import 합니다.
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import chat.routing

# 4. 최종 애플리케이션을 정의합니다.
application = ProtocolTypeRouter({
    # 일반적인 HTTP 요청은 Django의 기본 ASGI 앱이 처리합니다.
    "http": django_asgi_app,
    
    # WebSocket 요청은 우리가 만든 라우팅 설정을 따르도록 지정합니다.
    "websocket": AuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns
        )
    ),
})
