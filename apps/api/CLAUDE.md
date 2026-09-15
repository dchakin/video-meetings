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
  main.ts            — bootstrap, CORS (env WEB_ORIGIN), слушает PORT (по умолчанию 4000)
  app.module.ts      — корневой модуль: ConfigModule (global), PrismaModule, AuthModule, MeetingModule, глобальный ValidationPipe через APP_PIPE
  app.controller.ts  — GET / → AppService.getHello()
  app.service.ts
  prisma/
    prisma.module.ts   — @Global-модуль, экспортирует PrismaService
    prisma.service.ts  — PrismaClient + connect/disconnect по хукам жизненного цикла
  auth/                — CQRS: авторизация (хеш/сверка пароля, выпуск и проверка JWT). Пользователей не трогает — делегирует модулю `users` через CQRS
    auth.module.ts     — CqrsModule + UsersModule + JwtModule (secret/expiresIn из env), регистрирует command-обработчики и TokenService
    auth.controller.ts — POST /auth/register → RegisterCommand, POST /auth/login → LoginCommand
    auth.types.ts      — AuthResult, JwtPayload
    commands/
      register.command.ts / register.handler.ts — bcrypt-хеш пароля → CreateUserCommand (CommandBus) → выдаёт JWT
      login.command.ts / login.handler.ts       — FindUserByEmailQuery (QueryBus) → сверяет bcrypt-хеш (401) → выдаёт JWT
      index.ts         — AUTH_COMMAND_HANDLERS + реэкспорт команд
    tokens/token.service.ts — общий выпуск JWT (jwt.signAsync)
    dto/auth-credentials.dto.ts — { email, password }, правила class-validator
    guards/jwt-auth.guard.ts — проверяет `Authorization: Bearer <JWT>`, кладёт payload в `request.user` (401 иначе); экспортируется вместе с JwtModule
    current-user.decorator.ts — `@CurrentUser()`: достаёт JwtPayload из запроса
  users/               — CQRS: единственный владелец таблицы User (создание, поиск, профиль, смена имени и пароля). Провайдеров наружу не экспортирует — только команды/запросы
    users.module.ts    — CqrsModule, регистрирует command- и query-обработчики
    users.types.ts     — UserProfile (публичная форма без passwordHash), AvatarFileInput (файл аватара независимо от транспорта) и toUserProfile(user) (имя по умолчанию — локальная часть email)
    avatar-storage.config.ts — getAvatarStorageDir() / getAvatarMaxSizeBytes() (env AVATAR_STORAGE_DIR / AVATAR_MAX_SIZE_BYTES, дефолт 5 МБ), ALLOWED_AVATAR_MIME_TYPES (JPEG/PNG/WebP), AVATAR_MIME_TYPE_EXTENSIONS (mimetype → расширение файла на диске), AVATAR_URL_PREFIX (`/avatars/`)
    commands/
      create-user.command.ts / create-user.handler.ts — создаёт User по { email, passwordHash } (409 при дубле)
      update-user-name.command.ts / update-user-name.handler.ts — обновляет name по userId, возвращает UserProfile (404, если пользователя нет)
      change-password.command.ts / change-password.handler.ts — сверяет старый пароль (bcrypt, 401 при несовпадении), валидирует новый (8–72 символов, 400 иначе), хеширует и обновляет passwordHash (404, если пользователя нет)
      update-avatar.command.ts / update-avatar.handler.ts — валидирует формат (JPEG/PNG/WebP) и размер (до 5 МБ, 400 иначе) присланного файла, сохраняет его в `AVATAR_STORAGE_DIR` под случайным именем (`randomUUID` + расширение по проверенному mimetype, не по имени файла от клиента — иначе можно сохранить произвольные байты под расширением вроде `.html`), обновляет `avatarUrl` (404, если пользователя нет; при ошибке записи в БД сохранённый файл удаляется, чтобы не оставлять сироту), затем удаляет предыдущий файл аватара при замене (по старому `avatarUrl`, ошибка отсутствия файла игнорируется)
      index.ts         — USERS_COMMAND_HANDLERS + реэкспорт команд
    queries/
      find-user-by-email.query.ts / find-user-by-email.handler.ts — ищет User по email, возвращает User | null
      get-user-profile.query.ts / get-user-profile.handler.ts — возвращает UserProfile по userId (404, если пользователя нет)
      index.ts         — USERS_QUERY_HANDLERS + реэкспорт запросов
  meeting/             — обычный модуль Nest (controller + service), защищён `JwtAuthGuard`
    meeting.module.ts     — импортирует AuthModule (ради JwtAuthGuard/JwtModule)
    meeting.controller.ts — POST /meetings, GET /meetings, GET /meetings/:id; все под `@UseGuards(JwtAuthGuard)`
    meeting.service.ts    — CRUD через Prisma; список и создание скоупятся по `ownerId`, получение одной встречи (`findOneForMember`) доступно владельцу и участникам (сверка по email из JwtPayload, как в meeting-file) — 404 на недоступную/отсутствующую
    dto/create-meeting.dto.ts — { title, date (ISO), participants: string[] }, правила class-validator
  meeting-file/        — обычный модуль Nest (controller + service), защищён `JwtAuthGuard`
    meeting-file.module.ts     — импортирует AuthModule
    meeting-file.controller.ts — POST /meetings/:meetingId/files (multipart, поле `file`, `FileInterceptor` с лимитом `FILE_MAX_SIZE_BYTES`), GET /meetings/:meetingId/files, GET /meetings/:meetingId/files/:fileId/download (побайтовая отдача через `StreamableFile`), DELETE /meetings/:meetingId/files/:fileId (204 No Content); под `@UseGuards(JwtAuthGuard)`
    meeting-file.service.ts    — только владелец встречи может загружать и удалять; список файлов и скачивание доступны владельцу и участникам (сверка по email из JwtPayload); недоступная/чужая встреча, чужой файл или недостающие права на удаление → 404 (как в `meeting`, скрывает существование). Файл читается в память (multer memory storage — лимит размера отклоняет запрос до записи на диск), затем пишется в `FILE_STORAGE_DIR` под случайным именем (`randomUUID` + исходное расширение) и фиксируется в таблице `MeetingFile`; удаление стирает запись в БД и файл с диска (`fs.unlink`, ошибка отсутствия файла игнорируется)
    file-storage.config.ts     — `getFileStorageDir()` / `getFileMaxSizeBytes()`, читают `FILE_STORAGE_DIR` / `FILE_MAX_SIZE_BYTES` из `process.env`
    meeting-file.types.ts      — `MeetingFileResponse` — публичная форма файла без внутреннего `storagePath`
  *.spec.ts          — unit-тесты рядом с кодом
prisma/
  schema.prisma      — datasource (env DATABASE_URL) + модели User, Meeting (owner → User), MeetingFile (meeting → Meeting, uploadedBy → User)
  migrations/        — SQL-миграции Prisma
test/
  app.e2e-spec.ts, auth.e2e-spec.ts, meeting.e2e-spec.ts, meeting-file.e2e-spec.ts, jest-e2e.json
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
- CORS — `WEB_ORIGIN` (по умолчанию `http://localhost:3000`): список разрешённых origin фронтенда через запятую, включается в `main.ts` через `app.enableCors()`.
- Файлы встреч — `FILE_STORAGE_DIR` (по умолчанию `storage/meeting-files`, путь относительно `process.cwd()` — вне `dist`, не коммитится, см. `.gitignore`) и `FILE_MAX_SIZE_BYTES` (по умолчанию `10485760`, 10 MB).
- Аватары пользователей — `AVATAR_STORAGE_DIR` (по умолчанию `storage/avatars`, та же логика, что и у файлов встреч) и `AVATAR_MAX_SIZE_BYTES` (по умолчанию `5242880`, 5 MB).

## Тесты

Jest + ts-jest. Два набора:

| Набор    | Где                     | Конфиг                                        | Что проверяет                                                                  |
| -------- | ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| **unit** | `src/**/*.spec.ts`      | блок `jest` в `package.json` (`rootDir: src`) | классы в изоляции, без сети и БД                                               |
| **e2e**  | `test/**/*.e2e-spec.ts` | `test/jest-e2e.json`                          | поднимают всё приложение (`AppModule`) через `supertest` и ходят в реальную БД |

Запуск (из `apps/api/`, либо из корня — `npm run <script> -w @video-meetings/api`):

```bash
npm test                 # unit, разово
npm run test:watch       # unit в watch-режиме
npm run test:cov         # unit + покрытие (в ./coverage)
npm run test:e2e         # e2e
```

**e2e требуют БД.** Перед первым прогоном (из корня репозитория):

```bash
npm run db:up                                  # PostgreSQL в Docker
npm run prisma:migrate -w @video-meetings/api  # применить миграции
```

Тесты создают пользователей/встречи с уникальными email на каждый прогон и за собой не убирают —
это ожидаемо, данные живут в dev-БД. `JWT_SECRET` / `JWT_EXPIRES_IN` берутся из `apps/api/.env`
(при отсутствии — дефолты из кода).

Один файл или один кейс: `npm test -- auth` (по подстроке пути), `npm run test:e2e -- -t "returns a JWT"` (по имени `it`/`describe`).

Перед коммитом изменений в api прогонять оба набора и убеждаться, что они зелёные.

## CQRS (модули `auth` и `users`)

`auth` и `users` реализованы по паттерну **CQRS** через `@nestjs/cqrs` (`CqrsModule` в `imports` каждого).
Остальные модули (напр. `meeting`) CQRS не используют — там обычные `controller` + `service`. Применять CQRS
в новых модулях только при явной необходимости (сложная доменная логика, разделение чтения и записи, доменные события).

### Разделение ответственности

- **`auth`** — авторизация: хеширование и сверка пароля (`bcryptjs`), выпуск и проверка JWT. Таблицу `User`
  напрямую не читает и не пишет.
- **`users`** — единственный владелец таблицы `User`: создание, поиск, профиль, смена имени и пароля.
  Наружу не экспортирует ни одного провайдера, общается только через команды/запросы.
- Взаимодействие — **только через шину CQRS** (`CommandBus` / `QueryBus`), без прямых импортов сервисов между
  модулями. `AuthModule` импортирует `UsersModule` лишь чтобы обработчики `users` попали в граф модулей.

### Поток

```
HTTP → AuthController → CommandBus.execute(new RegisterCommand(...)) → RegisterHandler
        → bcrypt.hash → CommandBus.execute(new CreateUserCommand(email, hash)) → CreateUserHandler (Prisma)
        → TokenService.issue → AuthResult

HTTP → AuthController → CommandBus.execute(new LoginCommand(...)) → LoginHandler
        → QueryBus.execute(new FindUserByEmailQuery(email)) → FindUserByEmailHandler (Prisma)
        → bcrypt.compare → TokenService.issue → AuthResult
```

Контроллер **не содержит логики** — только валидирует DTO и диспатчит команду. Обработчик `auth` не ходит
в БД сам — он дёргает команду/запрос `users`.

### Файлы

| Файл                | Назначение                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<name>.command.ts` | Класс команды: `extends Command<TResult>`, поля — `public readonly` в конструкторе, `super()` в теле. DTO уровня приложения, без логики.                                                                                                                                    |
| `<name>.query.ts`   | Класс запроса: `extends Query<TResult>`. Только для чистых чтений.                                                                                                                                                                                                          |
| `<name>.handler.ts` | `@CommandHandler`/`@QueryHandler` + `implements ICommandHandler`/`IQueryHandler`. Зависимости (`PrismaService`, `TokenService`, `CommandBus`, `QueryBus`) — через конструктор. Ошибки — обычные Nest-исключения (`ConflictException` → 409, `UnauthorizedException` → 401). |
| `index.ts`          | `AUTH_COMMAND_HANDLERS` / `USERS_COMMAND_HANDLERS` / `USERS_QUERY_HANDLERS` (массивы обработчиков для `providers` модуля) + реэкспорт классов команд/запросов.                                                                                                              |

Общий для обработчиков `auth` выпуск JWT вынесен в `tokens/token.service.ts` (`TokenService.issue(payload)`).
Типизация результата: `Command<TResult>` / `Query<TResult>` заставляют `CommandBus.execute()` / `QueryBus.execute()`
вернуть `Promise<TResult>`.

### Добавить новую команду/запрос

1. `commands/<name>.command.ts` (`extends Command<TResult>`) или `queries/<name>.query.ts` (`extends Query<TResult>`).
2. `<name>.handler.ts` — `@CommandHandler` + `ICommandHandler` (или `@QueryHandler` + `IQueryHandler`).
3. Зарегистрировать обработчик в соответствующем массиве `*_HANDLERS` (`index.ts`) и реэкспортнуть класс оттуда.
4. Диспатчить через `this.commandBus.execute(new <Name>Command(...))` / `this.queryBus.execute(new <Name>Query(...))`.

## Соглашения

- Не редактировать `dist/**` — генерируется, чистится при каждой сборке.
- Новые фичи — модулями Nest: `<feature>.module.ts` / `.controller.ts` / `.service.ts`, регистрировать в `imports` родительского модуля. CQRS применяют `auth` и `users`; остальные модули (напр. `meeting`, `meeting-file`) — обычный controller + service. Детали паттерна — раздел «CQRS (модули `auth` и `users`)».
- Межмодульное взаимодействие с `users` — только через `CommandBus` / `QueryBus` (`CreateUserCommand`, `FindUserByEmailQuery`); `users` не экспортирует провайдеров, прямые импорты его сервисов запрещены.
- Защита роутов — `JwtAuthGuard` из `auth` (`@UseGuards(JwtAuthGuard)` на контроллере); текущего пользователя брать через `@CurrentUser()`. Модуль, которому нужен guard, импортирует `AuthModule`.
- Unit-тесты класть рядом с кодом как `*.spec.ts`; e2e — в `test/` как `*.e2e-spec.ts`. Как запускать — раздел «Тесты».
- Общие правила ESLint — в `packages/eslint-config`; общий tsconfig — в `packages/tsconfig/nestjs.json`.
- При изменении архитектуры воркспейса (структура `src/`, набор модулей, стек, команды, env) обновляй этот файл и, если нужно, корневой `CLAUDE.md` / `README.md` в том же изменении. См. раздел «Поддержка документации» в корневом `CLAUDE.md`.

## File upload

Use this research for it: @docs/research-meeting-file-upload-and-display.md
