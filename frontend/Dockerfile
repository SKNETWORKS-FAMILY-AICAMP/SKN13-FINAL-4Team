# frontend/Dockerfile

# 1단계: React 앱 빌드 (이름을 'build'로 지정)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build