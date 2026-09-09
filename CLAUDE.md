# CLAUDE.md

Указания для Claude Code при работе в этом репозитории.

## Обзор

`video-meetings` — монорепозиторий на **npm workspaces** (Node.js >= 22).

```
apps/
  web/   — фронтенд: Nuxt 4 + Nuxt UI (TypeScript, ESM)
  api/   — бэкенд: Nest.js 11 (TypeScript, CommonJS)
packages/
  eslint-config/ — общий flat-конфиг ESLint (@video-meetings/eslint-config, экспорт ./base)
  tsconfig/      — общие tsconfig (@video-meetings/tsconfig: base.json / nestjs.json)
```

У каждого приложения есть собственный `CLAUDE.md` в `apps/web/` и `apps/api/` — читай его при работе внутри воркспейса.

## Команды (из корня)

| Команда                           | Действие                                      |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | Параллельно web (`:3000`) и api (`:4000`)     |
| `npm run dev:web` / `dev:api`     | Только один воркспейс                         |
| `npm run build`                   | Сборка всех воркспейсов (`--if-present`)      |
| `npm run lint` / `lint:fix`       | ESLint по всем воркспейсам                    |
| `npm run typecheck`               | Проверка типов по всем воркспейсам            |
| `npm run test`                    | Тесты по всем воркспейсам (сейчас только api) |
| `npm run format` / `format:check` | Prettier по всему репозиторию                 |

Для одного воркспейса: `npm run <script> -w @video-meetings/web` (или `@video-meetings/api`).

## Установка зависимостей

```bash
npm install
```

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
