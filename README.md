# frontend


# docker-compose.yml

version: '3.8'

services:
  db:
    image: postgres:15
    restart: always
    env_file: .env
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: "redis:7-alpine"
    restart: always
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    # 2. command를 daphne로 변경 (Channels를 위해 필수)
    command: bash -c "python manage.py migrate && daphne -b 0.0.0.0 -p 8000 config.asgi:application"
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    env_file: .env
    # 3. depends_on에 redis 추가
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
    ports:
      - "3000:3000"
    stdin_open: true
    tty: true

volumes:
  pgdata:
