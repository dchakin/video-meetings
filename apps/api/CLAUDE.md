# CLAUDE.md — apps/api

Бэкенд `@video-meetings/api`. Указания для Claude Code внутри этого воркспейса.

## Стек

- **Nest.js 11** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`).
- TypeScript, CommonJS, декораторы (`emitDecoratorMetadata`, `experimentalDecorators`).
- `tsconfig.json` расширяет `@video-meetings/tsconfig/nestjs.json`.
- **Prisma 6** (`@prisma/client`, dev-зависимость `prisma`) — ORM поверх PostgreSQL. Схема — `prisma/schema.prisma`, миграции — `prisma/migrations/`.
- **Auth**: `@nestjs/cqrs` (CQRS — команды/обработчики), `@nestjs/jwt` (JWT), `@nestjs/config` (env), `bcryptjs` (хеш паролей), `class-validator` / `class-transformer` (валидация DTO).
- Держать мажоры на CJS-совместимых версиях: `@nestjs/config@4`, `@nestjs/jwt@11`, `@nestjs/cqrs@11`, `@prisma/client@6` (более новые ломают ts-jest CJS / требуют `prisma.config.ts`).
- Тесты — Jest + ts-jest (конфиг в `package.json`, `rootDir: src`, `*.spec.ts`); e2e — `test/jest-e2e.json`. E2e поднимают реальное приложение и ходят в БД из `docker-compose.yml` — перед прогоном нужен `npm run db:up` и применённые миграции.

## Структура

```
src/
  main.ts            — bootstrap, слушает PORT (по умолчанию 4000)
  app.module.ts      — корневой модуль: ConfigModule (global), PrismaModule, AuthModule, глобальный ValidationPipe через APP_PIPE
  app.controller.ts  — GET / → AppService.getHello()
  app.service.ts
  prisma/
    prisma.module.ts   — @Global-модуль, экспортирует PrismaService
    prisma.service.ts  — PrismaClient + connect/disconnect по хукам жизненного цикла
  auth/                — CQRS: контроллер только диспатчит команды через CommandBus
    auth.module.ts     — CqrsModule + JwtModule (secret/expiresIn из env), регистрирует command-обработчики и TokenService
    auth.controller.ts — POST /auth/register → RegisterCommand, POST /auth/login → LoginCommand
    auth.types.ts      — AuthResult, JwtPayload
    commands/
      register.command.ts / register.handler.ts — создаёт User (409 при дубле), выдаёт JWT
      login.command.ts / login.handler.ts       — ищет User, сверяет bcrypt-хеш (401), выдаёт JWT
      index.ts         — AUTH_COMMAND_HANDLERS + реэкспорт команд
    tokens/token.service.ts — общий выпуск JWT (jwt.signAsync)
    dto/auth-credentials.dto.ts — { email, password }, правила class-validator
  *.spec.ts          — unit-тесты рядом с кодом
prisma/
  schema.prisma      — datasource (env DATABASE_URL) + модель User
  migrations/        — SQL-миграции Prisma
test/
  app.e2e-spec.ts, auth.e2e-spec.ts, jest-e2e.json
nest-cli.json        — sourceRoot: src, deleteOutDir: true
```

Сборка — в `dist/` (`nest build`).

## Команды

| Команда                                    | Действие                                         |
| ------------------------------------------ | ------------------------------------------------ |
| `npm run dev`                              | `nest start --watch`                             |
| `npm run start`                            | `nest start`                                     |
| `npm run start:prod`                       | `node dist/main.js`                              |
| `npm run build`                            | `nest build` → `dist/`                           |
| `npm run lint` / `lint:fix`                | ESLint по `{src,test}/**/*.ts`                   |
| `npm run typecheck`                        | `tsc --noEmit -p tsconfig.json`                  |
| `npm run test` / `test:watch` / `test:cov` | Jest unit                                        |
| `npm run test:e2e`                         | Jest e2e                                         |
| `npm run prisma:generate`                  | `prisma generate` (клиент)                       |
| `npm run prisma:migrate`                   | `prisma migrate dev` (dev-миграция + применение) |
| `npm run prisma:deploy`                    | `prisma migrate deploy` (прод/CI)                |

## Конфигурация

- Порт — `PORT` (по умолчанию 4000). Пример env — `.env.example`.
- Подключение к БД — `DATABASE_URL` (PostgreSQL из корневого `docker-compose.yml`, сервис `db`). По умолчанию `postgresql://video_meetings:video_meetings@localhost:5432/video_meetings`. Поднять БД — `npm run db:up` из корня. Prisma CLI читает `DATABASE_URL` из `apps/api/.env` (у Prisma Client в рантайме `.env` подхватывает `@nestjs/config`).
- JWT — `JWT_SECRET` (по умолчанию `dev-secret-change-me`) и `JWT_EXPIRES_IN` (по умолчанию `1d`).

## Соглашения

- Не редактировать `dist/**` — генерируется, чистится при каждой сборке.
- Новые фичи — модулями Nest: `<feature>.module.ts` / `.controller.ts` / `.service.ts`, регистрировать в `imports` родительского модуля.
- Бизнес-операции модуля `auth` — по CQRS (`@nestjs/cqrs`): контроллер не содержит логики, а диспатчит команду через `CommandBus`; логика — в `commands/<name>.handler.ts` (`@CommandHandler`). Команды наследуют `Command<AuthResult>` для типизации результата. Новые обработчики добавлять в `AUTH_COMMAND_HANDLERS` (`commands/index.ts`). Чистые чтения при появлении оформлять как `Query`/`@QueryHandler`.
- Unit-тесты класть рядом с кодом как `*.spec.ts`.
- Общие правила ESLint — в `packages/eslint-config`; общий tsconfig — в `packages/tsconfig/nestjs.json`.
- При изменении архитектуры воркспейса (структура `src/`, набор модулей, стек, команды, env) обновляй этот файл и, если нужно, корневой `CLAUDE.md` / `README.md` в том же изменении. См. раздел «Поддержка документации» в корневом `CLAUDE.md`.
