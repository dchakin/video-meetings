# syntax=docker/dockerfile:1
#
# Собирать из корня монорепозитория (npm workspaces требуют полного контекста):
#   docker build -f apps/api/Dockerfile -t video-meetings-api .
#
# Whisper (модель WHISPER_MODEL_NAME из src/transcription/transcription.constants.ts, сейчас
# "base") требует ffmpeg в рантайме и build-инструменты (cmake/make/g++) для сборки whisper.cpp
# на этапе `npm ci` — сборка и скачивание модели выполняются один раз здесь, в образе, чтобы
# первый реальный запрос на транскрибацию в проде не спотыкался об отсутствующие зависимости и
# не тратил время на загрузку модели из сети при старте контейнера.

FROM node:22-bookworm-slim AS build
WORKDIR /repo

# build-essential/cmake — сборка нативного биндинга whisper.cpp (`nodejs-whisper` postinstall);
# git — whisper.cpp клонируется как часть той же сборки; wget/ca-certificates — скрипт скачивания
# модели (download-ggml-model.sh) и npm-реестр.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Полный install (не --omit=dev): нужен nest build/prisma/typescript из devDependencies apps/api.
RUN npm ci

COPY apps/api ./apps/api

RUN npm run prisma:generate -w @video-meetings/api
RUN npm run build -w @video-meetings/api

# `npx nodejs-whisper download` — интерактивный визард (модель + вопрос про CUDA), который
# читает /dev/tty напрямую через readline-sync и падает в неинтерактивном `docker build`
# ("doesn't support interactive reading from TTY"). Вместо него воспроизводим то же самое,
# что делает сам визард (dist/downloadModel.js): скачиваем модель ggml-скриптом whisper.cpp и
# собираем whisper.cpp через CMake без CUDA (сервер приложения — не выделенная GPU-машина, см.
# обоснование WHISPER_MODEL_NAME в коде).
RUN WHISPER_CPP_DIR=node_modules/nodejs-whisper/cpp/whisper.cpp \
  && cd "$WHISPER_CPP_DIR/models" \
  && chmod +x ./download-ggml-model.sh \
  && ./download-ggml-model.sh base \
  && cd .. \
  && cmake -B build \
  && cmake --build build --config Release

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# ffmpeg — обязателен в рантайме: whisper-transcription.service.ts прогоняет через него
# исходный mp4/mp3 перед распознаванием (см. комментарий у transcribeFile).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules

EXPOSE 4000

# prisma migrate deploy — применяет накопленные миграции к БД прод/стейджа перед стартом,
# без интерактивных вопросов (в отличие от `prisma migrate dev`, используемого в разработке).
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
