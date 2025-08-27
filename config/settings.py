# backend/config/settings.py

from pathlib import Path
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# --- 기본 경로 설정 ---
BASE_DIR = Path(__file__).resolve().parent.parent

# --- 환경 변수 설정 (가장 먼저 정의) ---
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development')
DEBUG = ENVIRONMENT != 'production'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

# 샤드 수 (실전: 4~16로 시작, 트래픽 따라 조정)
SHARD_COUNT = int(os.getenv("CHANNEL_SHARDS", "8"))


# --- 호스트 설정 ---
if DEBUG:
    ALLOWED_HOSTS = ['*']
else:
    allowed_hosts_str = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
    ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_str.split(',') if h.strip()]


def make_redis_url(host):
    return f"redis://{host}:6379/0"

    
# --- 핵심 애플리케이션 ---
INSTALLED_APPS = [
    'daphne',
    'channels',
    'users',
    'chat',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --- 데이터베이스 설정 ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get("DB_NAME"),
        'USER': os.environ.get("DB_USER"),
        'PASSWORD': os.environ.get("DB_PASSWORD"),
        'HOST': os.environ.get("DB_HOST"),
        'PORT': os.environ.get("DB_PORT"),
    }
}

# # --- Redis / Channels / Cache 설정 ---
# if ENVIRONMENT == 'production':
#     # 실서버 환경: AWS ElastiCache 사용
#     ELASTICACHE_ENDPOINT = os.environ.get('ELASTICACHE_ENDPOINT')
#     ELASTICACHE_USER = os.environ.get('ELASTICACHE_USER')
#     ELASTICACHE_PASSWORD = os.environ.get('ELASTICACHE_PASSWORD')
#     REDIS_LOCATION = f"rediss://{ELASTICACHE_USER}:{ELASTICACHE_PASSWORD}@{ELASTICACHE_ENDPOINT}"
# else:
#     # 개발 환경: 로컬 Docker Redis 사용
#     REDIS_LOCATION = "redis://redis:6379"

# CACHES = {
#     "default": {
#         "BACKEND": "django_redis.cache.RedisCache",
#         "LOCATION": f"{REDIS_LOCATION}/1", # DB 1번
#         "OPTIONS": {
#             "CLIENT_CLASS": "django_redis.client.DefaultClient",
#             "SSL_CERT_REQS": None,
#         },
#     }
# }

# CHANNEL_LAYERS = {
#     "default": {
#         "BACKEND": "channels_redis.core.RedisChannelLayer",
#         "CONFIG": {
#             "hosts": [
#                 {
#                     "address": (
#                         os.getenv("ELASTICACHE_HOST", "localhost"),
#                         int(os.getenv("ELASTICACHE_PORT", 6379))
#                     ),
#                     "password": os.getenv("ELASTICACHE_PASSWORD", None),
#                 }
#             ],
#         },
#     },
# }

# --- Redis / Channels / Cache 설정 ---
if ENVIRONMENT == 'production':
    # 실서버 환경: 단일 AWS ElastiCache를 샤드처럼 사용
    ELASTICACHE_ENDPOINT = os.environ.get('ELASTICACHE_ENDPOINT')
    REDIS_LOCATION = f"rediss://{ELASTICACHE_ENDPOINT}" # 인증 없음, TLS 사용
    SHARD_COUNT = int(os.environ.get("CHANNEL_SHARDS", "4"))

    # [수정] Dictionary unpacking을 사용하여 default와 샤드 설정을 올바르게 병합
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": { "hosts": [REDIS_LOCATION] },
        },
        **{
            f"shard-{i}": {
                "BACKEND": "channels_redis.core.RedisChannelLayer",
                "CONFIG": {
                    "hosts": [REDIS_LOCATION],
                },
            }
            for i in range(SHARD_COUNT)
        }
    }

else:
    # 개발 환경: 단일 로컬 Docker Redis 사용
    REDIS_LOCATION = "redis://redis:6379"
    SHARD_COUNT = int(os.environ.get("CHANNEL_SHARDS", "4"))

    # [수정] Dictionary unpacking을 사용하여 default와 샤드 설정을 올바르게 병합
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": { "hosts": [f"{REDIS_LOCATION}/0"] },
        },
         **{
            f"shard-{i}": {
                "BACKEND": "channels_redis.core.RedisChannelLayer",
                "CONFIG": {
                    "hosts": [f"{REDIS_LOCATION}/0"],
                },
            }
            for i in range(SHARD_COUNT)
        }
    }

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_LOCATION,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SSL_CERT_REQS": None if ENVIRONMENT == 'production' else 'ignore',
        },
    }
}


# --- 인증 및 권한 ---
AUTH_USER_MODEL = 'users.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- 국제화 ---
LANGUAGE_CODE = 'ko'
TIME_ZONE = 'Asia/Seoul'
USE_I18N = True
USE_TZ = True

# --- 정적 & 미디어 파일 ---
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'static'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS ---
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    cors_origins_str = os.environ.get('CORS_ALLOWED_ORIGINS', '')
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type', 'dnt',
    'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
    'ngrok-skip-browser-warning',
]

# --- DRF & JWT ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 30,
}

# --- Third-party API Keys ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")

# --- AI Chatbot Settings ---
AI_CHATBOT_SETTINGS = {
    'MODEL': 'gpt-3.5-turbo',
    'MAX_TOKENS': 1000,
    'TEMPERATURE': 0.7,
    'SYSTEM_PROMPT': '당신은 도움이 되는 AI 어시스턴트입니다. 모든 사용자의 메시지에 친근하고 유용한 답변을 제공하세요.',
}