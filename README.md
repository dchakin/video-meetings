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

| Команда                | Действие                                                |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Параллельный запуск web (`:3000`) и api (`:4000`)       |
| `npm run dev:web`      | Только Nuxt                                             |
| `npm run dev:api`      | Только Nest.js                                          |
| `npm run build`        | Сборка всех воркспейсов                                 |
| `npm run start`        | Прод-запуск web (`nuxt preview`) и api                  |
| `npm run lint`         | ESLint по всем воркспейсам                              |
| `npm run lint:fix`     | ESLint с автофиксом                                     |
| `npm run typecheck`    | Проверка типов (`tsc --noEmit`) по всем воркспейсам     |
| `npm run test`         | Тесты по всем воркспейсам                               |
| `npm run format`       | Prettier (запись) по всему репозиторию                  |
| `npm run format:check` | Prettier (только проверка)                              |
| `npm run db:up`        | Поднять PostgreSQL в Docker (`docker compose up -d db`) |
| `npm run db:down`      | Остановить и удалить контейнер БД                       |
| `npm run db:logs`      | Логи контейнера БД                                      |

Для отдельного воркспейса: `npm run <script> -w @video-meetings/web`.
