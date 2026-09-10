# CLAUDE.md

Указания для Claude Code при работе в этом репозитории.

## Обзор

`video-meetings` — монорепозиторий на **npm workspaces** (Node.js >= 22).

```
apps/
  web/   — фронтенд: Nuxt 4 + Nuxt UI (TypeScript, ESM)
  api/   — бэкенд: Nest.js 11 + Prisma 6 (PostgreSQL), JWT-аутентификация (CQRS, @nestjs/cqrs) (TypeScript, CommonJS)
packages/
  eslint-config/ — общий flat-конфиг ESLint (@video-meetings/eslint-config, экспорт ./base)
  tsconfig/      — общие tsconfig (@video-meetings/tsconfig: base.json / nestjs.json)
```

У каждого приложения есть собственный `CLAUDE.md` в `apps/web/` и `apps/api/` — читай его при работе внутри воркспейса.

## Команды (из корня)

| Команда                                 | Действие                                             |
| --------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                           | Параллельно web (`:3000`) и api (`:4000`)            |
| `npm run dev:web` / `dev:api`           | Только один воркспейс                                |
| `npm run build`                         | Сборка всех воркспейсов (`--if-present`)             |
| `npm run lint` / `lint:fix`             | ESLint по всем воркспейсам                           |
| `npm run typecheck`                     | Проверка типов по всем воркспейсам                   |
| `npm run test`                          | Тесты по всем воркспейсам (сейчас только api — unit) |
| `npm run format` / `format:check`       | Prettier по всему репозиторию                        |
| `npm run db:up` / `db:down` / `db:logs` | PostgreSQL в Docker Compose (сервис `db`)            |

Для одного воркспейса: `npm run <script> -w @video-meetings/web` (или `@video-meetings/api`).

### Тесты

- `npm run test` из корня — unit-тесты api (Jest). У web тесты пока не настроены.
- e2e api — `npm run test:e2e -w @video-meetings/api`; поднимают приложение и ходят в реальную БД,
  поэтому нужны `npm run db:up` и применённые миграции (`npm run prisma:migrate -w @video-meetings/api`).
- Подробности (наборы, запуск одного файла/кейса, требования) — `apps/api/CLAUDE.md`, раздел «Тесты».

## Установка зависимостей

```bash
npm install
```

## База данных

PostgreSQL 17 в контейнере — `docker-compose.yml`, сервис `db`, порт `5432`, том `db-data`.
Параметры (`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT`) — в корневом `.env` (пример — `.env.example`).
Строка подключения для api — `DATABASE_URL` в `apps/api/.env` (пример — `apps/api/.env.example`).

Доступ к БД в api — через **Prisma 6**. Схема и миграции — `apps/api/prisma/`. После `npm run db:up` применить миграции: `npm run prisma:migrate -w @video-meetings/api` (в CI/проде — `prisma:deploy`). Клиент генерируется командой `npm run prisma:generate -w @video-meetings/api`.

## Соглашения

- **Не редактировать вручную** сгенерированные файлы: `apps/web/.nuxt/**`, `apps/web/.output/**`, `apps/api/dist/**`.
- Общие правила ESLint и tsconfig менять в `packages/*`, framework-специфику — в самих приложениях.
- Форматирование — Prettier (`.prettierrc.json`), не конфликтует с ESLint (`eslint-config-prettier`). После каждого `Write`/`Edit` Claude Code автоматически прогоняет Prettier по изменённому файлу (хук `PostToolUse` → `.claude/hooks/format-changed-file.mjs`).
- `.npmrc`: `engine-strict=true`, `save-exact=false`.
- Перед коммитом прогонять `npm run lint` и `npm run typecheck`.

## Поддержка документации

При изменении архитектуры проекта в том же изменении актуализируй документацию:

- новый/переименованный/удалённый воркспейс в `apps/*` или `packages/*` — правь этот файл, `README.md` и создавай/удаляй соответствующий `apps/*/CLAUDE.md`;
- смена стека, фреймворка или его мажорной версии — правь корневой `CLAUDE.md` и `CLAUDE.md` затронутого воркспейса;
- изменение команд, скриптов, портов или переменных окружения — синхронизируй таблицы команд и разделы конфигурации во всех затронутых `CLAUDE.md` и в `README.md`;
- изменение соглашений (структура модулей, расположение тестов, правила линта/tsconfig) — фиксируй в разделе «Соглашения» соответствующего `CLAUDE.md`.

Документация не должна отставать от кода: расхождение — это баг.
