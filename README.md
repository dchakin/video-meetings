# video-meetings

Монорепозиторий на npm workspaces.

## Структура

```
apps/
  web/   — фронтенд, Nuxt 4 + Nuxt UI (TypeScript)
  api/   — бэкенд, Nest.js 11 (TypeScript)
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

## Команды (из корня)

| Команда                | Действие                                            |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Параллельный запуск web (`:3000`) и api (`:4000`)   |
| `npm run dev:web`      | Только Nuxt                                         |
| `npm run dev:api`      | Только Nest.js                                      |
| `npm run build`        | Сборка всех воркспейсов                             |
| `npm run start`        | Прод-запуск web (`nuxt preview`) и api              |
| `npm run lint`         | ESLint по всем воркспейсам                          |
| `npm run lint:fix`     | ESLint с автофиксом                                 |
| `npm run typecheck`    | Проверка типов (`tsc --noEmit`) по всем воркспейсам |
| `npm run test`         | Тесты по всем воркспейсам                           |
| `npm run format`       | Prettier (запись) по всему репозиторию              |
| `npm run format:check` | Prettier (только проверка)                          |

Для отдельного воркспейса: `npm run <script> -w @video-meetings/web`.
