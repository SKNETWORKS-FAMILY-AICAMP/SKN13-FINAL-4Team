# nginx/Dockerfile

# 1단계: React 앱 빌드 (이름을 'build'로 지정)
FROM node:18-alpine AS build
WORKDIR /app
# frontend 폴더의 package 파일을 복사
COPY ./frontend/package*.json ./
RUN npm install
# frontend 폴더 전체를 복사
COPY ./frontend .
RUN npm run build

# 2단계: Nginx 이미지 생성 및 빌드 결과물 복사
FROM nginx:alpine
# 1단계('build' 스테이지)에서 생성된 빌드 결과물을 Nginx 웹 루트로 복사
COPY --from=build /app/build /usr/share/nginx/html
# Nginx 설정 파일 복사
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf