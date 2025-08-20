"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application

# 1. Django 설정을 먼저 로드하고 초기화합니다.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()

# 2. Django가 초기화된 후에 Channels 관련 모듈과 라우팅을 가져옵니다.
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import chat.routing

# 3. 프로토콜별로 애플리케이션을 정의합니다.
application = ProtocolTypeRouter({
    "http": django_asgi_app, # 초기화된 Django 앱을 사용합니다.
    "websocket": AuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns
        )
    ),
})
