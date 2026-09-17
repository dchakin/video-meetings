# video-meetings

Монорепозиторий на npm workspaces.

## Структура

```
apps/
  web/   — фронтенд, Nuxt 4 + Nuxt UI (TypeScript)
  api/   — бэкенд, Nest.js 11 + Prisma 6 / PostgreSQL, JWT-аутентификация по CQRS (TypeScript)
packages/
  eslint-config/ — общий базовый конфиг ESLint (+ интеграция с Prettier)
  tsconfig/      — общие базовые tsconfig (base / nestjs)
```

## Требования

- Node.js >= 22 (см. `.nvmrc`)
- npm >= 10

## Установка

```bash
npm install
```

## База данных

PostgreSQL 17 поднимается через Docker Compose (`docker-compose.yml`, сервис `db`).

```bash
cp .env.example .env   # при необходимости поменять логин/пароль/порт
npm run db:up          # docker compose up -d db
npm run db:logs        # логи контейнера
npm run db:down        # остановить и удалить контейнер (данные в volume db-data сохраняются)
```

Строка подключения по умолчанию:
`postgresql://video_meetings:video_meetings@localhost:5432/video_meetings`
(см. `apps/api/.env.example`).

Доступ к БД в api — через Prisma (`apps/api/prisma/`). После первого `npm run db:up` применить миграции:

```bash
cp apps/api/.env.example apps/api/.env
npm run prisma:migrate -w @video-meetings/api   # применит миграции и сгенерирует клиент
```

## Команды (из корня)

Полный список — в `scripts` файла `package.json`. Основные: `dev` (параллельно web `:3000` и api `:4000`,
`dev:web`/`dev:api` — по отдельности), `build`, `start` (прод), `lint`/`lint:fix`, `typecheck`, `test`,
`format`/`format:check`, `db:up`/`db:down`/`db:logs`.

Для отдельного воркспейса: `npm run <script> -w @video-meetings/web` (или `@video-meetings/api`).

## Тесты

```bash
npm run test                              # unit-тесты (Jest); сейчас только api
npm run test:e2e -w @video-meetings/api   # e2e api через supertest
```

e2e поднимают приложение и работают с реальной БД — перед запуском нужны `npm run db:up`
и применённые миграции (`npm run prisma:migrate -w @video-meetings/api`). У web тесты пока не настроены.
