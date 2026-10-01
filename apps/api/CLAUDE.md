# CLAUDE.md — apps/api

Бэкенд `@video-meetings/api`. Указания для Claude Code внутри этого воркспейса.

## Стек

- **Nest.js 11** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`).
- TypeScript, CommonJS, декораторы (`emitDecoratorMetadata`, `experimentalDecorators`).
- `tsconfig.json` расширяет `@video-meetings/tsconfig/nestjs.json`.
- **Prisma 6** (`@prisma/client`, dev-зависимость `prisma`) — ORM поверх PostgreSQL. Схема — `prisma/schema.prisma`, миграции — `prisma/migrations/`.
- **Auth**: `@nestjs/cqrs` (CQRS — команды/обработчики), `@nestjs/jwt` (JWT), `@nestjs/config` (env), `bcryptjs` (хеш паролей), `class-validator` / `class-transformer` (валидация DTO).
- **Безопасность**: `helmet` (security-заголовки, см. `main.ts`), `@nestjs/throttler` (rate limiting, глобальный `APP_GUARD` + `@Throttle` на auth/смене пароля).
- **OpenRouter**: модуль `open-router` — обычный HTTP-клиент (`fetch`) к OpenAI-совместимому `POST /api/v1/chat/completions` OpenRouter, без SDK. Нужен `OPENROUTER_API_KEY` в окружении.
- Держать мажоры на CJS-совместимых версиях: `@nestjs/config@4`, `@nestjs/jwt@11`, `@nestjs/cqrs@11`, `@prisma/client@6` (более новые ломают ts-jest CJS / требуют `prisma.config.ts`).
- Тесты — Jest + ts-jest (конфиг в `package.json`, `rootDir: src`, `*.spec.ts`); e2e — `test/jest-e2e.json`. E2e поднимают реальное приложение и ходят в БД из `docker-compose.yml` — перед прогоном нужен `npm run db:up` и применённые миграции.

## Структура

```
src/
  main.ts            — bootstrap: отключает встроенный body-parser Nest и сам ограничивает JSON-тело (1mb), `helmet()` (CSP выключен — чистый API; CORP: cross-origin — фронтенд на другом origin грузит аватары/файлы), CORS (env WEB_ORIGIN, ограничен по methods/headers), слушает PORT (по умолчанию 4000)
  app.module.ts      — корневой модуль: ConfigModule (global), ThrottlerModule (глобальный rate limit, выключен при NODE_ENV=test), PrismaModule, AuthModule, MeetingModule, MeetingFileModule, MeetingSummaryModule, глобальный ValidationPipe через APP_PIPE, глобальный ThrottlerGuard через APP_GUARD
  app.controller.ts  — GET / → AppService.getHello()
  app.service.ts
  common/
    email.util.ts    — normalizeEmail(email) (trim + lowercase) — применяется во всех DTO/хендлерах, где email сравнивается или используется как ключ (регистрация, логин, участники встречи)
    password.util.ts — BCRYPT_ROUNDS (общий cost factor для register/смены пароля)
  prisma/
    prisma.module.ts   — @Global-модуль, экспортирует PrismaService
    prisma.service.ts  — PrismaClient + connect/disconnect по хукам жизненного цикла
  auth/                — CQRS: авторизация (хеш/сверка пароля, выпуск и проверка JWT). Пользователей не трогает — делегирует модулю `users` через CQRS
    auth.module.ts     — CqrsModule + UsersModule + JwtModule (secret через `getJwtSecretOrThrow`, expiresIn из env), регистрирует command-обработчики и TokenService; экспортирует CqrsModule вместе с JwtModule/JwtAuthGuard — модулям с `@UseGuards(JwtAuthGuard)` (`meeting`, `meeting-file`) нужен доступ к `QueryBus`, от которого зависит guard
    auth.controller.ts — POST /auth/register → RegisterCommand, POST /auth/login → LoginCommand; оба под `@Throttle` (10 запросов/мин с одного IP)
    auth.types.ts      — AuthResult, JwtPayload (включает `tokenVersion` — сверяется в JwtAuthGuard с БД, отзывает токены при смене пароля)
    jwt-secret.util.ts — getJwtSecretOrThrow(config): требует явный `JWT_SECRET` ≥ 32 символов, без дефолта — иначе приложение не стартует
    commands/
      register.command.ts / register.handler.ts — bcrypt-хеш пароля → CreateUserCommand (CommandBus) → выдаёт JWT
      login.command.ts / login.handler.ts       — FindUserByEmailQuery (QueryBus) → сверяет bcrypt-хеш (401), при отсутствии пользователя сравнивает с фиктивным хешем той же длины (защита от user enumeration по времени ответа) → выдаёт JWT
      index.ts         — AUTH_COMMAND_HANDLERS + реэкспорт команд
    tokens/token.service.ts — общий выпуск JWT (jwt.signAsync)
    dto/auth-credentials.dto.ts — { email, password }, правила class-validator; email нормализуется через `normalizeEmail`, пароль — 8–72 БАЙТ (`@IsByteLength`, не символов — bcrypt учитывает только первые 72 байта)
    guards/jwt-auth.guard.ts — проверяет `Authorization: Bearer <JWT>` и что `tokenVersion` из токена совпадает с текущим у пользователя (запрашивается у `users` через `GetUserTokenVersionQuery`/`QueryBus`, без прямого чтения таблицы `User`; иначе 401 — отзыв токенов при смене пароля), кладёт payload в `request.user`; экспортируется вместе с JwtModule
    current-user.decorator.ts — `@CurrentUser()`: достаёт JwtPayload из запроса
  users/               — CQRS: единственный владелец таблицы User (создание, поиск, профиль, смена имени и пароля). Провайдеров наружу не экспортирует — только команды/запросы
    users.module.ts    — CqrsModule, регистрирует command- и query-обработчики
    users.types.ts     — UserProfile (публичная форма без passwordHash), AvatarFileInput (файл аватара независимо от транспорта) и toUserProfile(user) (имя по умолчанию — локальная часть email)
    avatar-storage.config.ts — getAvatarStorageDir() / getAvatarMaxSizeBytes() (env AVATAR_STORAGE_DIR / AVATAR_MAX_SIZE_BYTES, дефолт 5 МБ), ALLOWED_AVATAR_MIME_TYPES (JPEG/PNG/WebP), AVATAR_MIME_TYPE_EXTENSIONS (mimetype → расширение файла на диске), AVATAR_URL_PREFIX (`/avatars/`)
    commands/
      create-user.command.ts / create-user.handler.ts — создаёт User по { email (нормализован через `normalizeEmail`), passwordHash } напрямую через `create` (без предварительного `findUnique` — избегает гонки параллельных регистраций), 409 при перехваченном P2002 (уникальный индекс по email)
      update-user-name.command.ts / update-user-name.handler.ts — обновляет name по userId, возвращает UserProfile (404, если пользователя нет)
      change-password.command.ts / change-password.handler.ts — сверяет старый пароль (bcrypt, 401 при несовпадении; длина/байтовый размер новых паролей проверены на уровне ChangePasswordDto), хеширует и обновляет passwordHash вместе с инкрементом `tokenVersion` (отзывает все ранее выданные JWT; 404, если пользователя нет)
      update-avatar.command.ts / update-avatar.handler.ts — валидирует формат (JPEG/PNG/WebP) и размер (до 5 МБ, 400 иначе) присланного файла, сохраняет его в `AVATAR_STORAGE_DIR` под случайным именем (`randomUUID` + расширение по проверенному mimetype, не по имени файла от клиента — иначе можно сохранить произвольные байты под расширением вроде `.html`), обновляет `avatarUrl` (404, если пользователя нет; при ошибке записи в БД сохранённый файл удаляется, чтобы не оставлять сироту), затем удаляет предыдущий файл аватара при замене (по старому `avatarUrl`, ошибка отсутствия файла игнорируется)
      index.ts         — USERS_COMMAND_HANDLERS + реэкспорт команд
    queries/
      find-user-by-email.query.ts / find-user-by-email.handler.ts — ищет User по email, возвращает User | null
      get-user-profile.query.ts / get-user-profile.handler.ts — возвращает UserProfile по userId (404, если пользователя нет)
      get-avatar-file.query.ts / get-avatar-file.handler.ts — по имени файла из `avatarUrl` возвращает { storagePath, mimeType }; имя строго `<uuid>.<jpg|png|webp>` (защита от `../`), иначе или при отсутствии файла — 404
      get-user-token-version.query.ts / get-user-token-version.handler.ts — возвращает текущий `tokenVersion` пользователя (`null`, если пользователя нет); используется `JwtAuthGuard` из `auth` через `QueryBus`, чтобы `auth` не читал таблицу `User` напрямую
      index.ts         — USERS_QUERY_HANDLERS + реэкспорт запросов
  profile/             — HTTP-слой профиля пользователя (CQRS-диспатч в `users`), защищён `JwtAuthGuard`
    profile.module.ts     — контроллеры ProfileController и AvatarsController; импортирует CqrsModule, AuthModule (ради JwtAuthGuard) и UsersModule (ради обработчиков команд/запросов `users`)
    profile.controller.ts — GET /profile → `GetUserProfileQuery` через `QueryBus`; PATCH /profile (имя, DTO `UpdateProfileNameDto`) → `UpdateUserNameCommand`; PATCH /profile/password (DTO `ChangePasswordDto`) → `ChangePasswordCommand`; POST /profile/avatar (multipart, поле `file`, `FileInterceptor` с лимитом `getAvatarMaxSizeBytes()`) → `UpdateAvatarCommand` через `CommandBus`; без файла — 400 до диспатча команды
    avatars.controller.ts — GET /avatars/:fileName → `GetAvatarFileQuery`, отдаёт файл через `StreamableFile` (`Content-Type` по расширению, `nosniff`, `Cache-Control: immutable`). **Без** `JwtAuthGuard`: `<img src>` не шлёт `Authorization`, имена файлов — случайные UUID
    dto/update-profile-name.dto.ts — { name } (1–100 символов)
    dto/change-password.dto.ts — { oldPassword, newPassword } (newPassword — 8–72 БАЙТ, `@IsByteLength`)
  meeting/             — обычный модуль Nest (controller + service), защищён `JwtAuthGuard`
    meeting.module.ts     — импортирует AuthModule (ради JwtAuthGuard/JwtModule)
    meeting.controller.ts — POST /meetings, GET /meetings, GET /meetings/:id (`id` — `ParseUUIDPipe`); все под `@UseGuards(JwtAuthGuard)`
    meeting.service.ts    — CRUD через Prisma; список и создание скоупятся по `ownerId`, получение одной встречи (`findOneForMember`) доступно владельцу и участникам (сверка по email из JwtPayload, как в meeting-file) — 404 на недоступную/отсутствующую. **Известный риск** (сознательно не устранён — требует редизайна с подтверждением email/инвайт-токенами): участник добавляется по email без проверки владения им, поэтому пользователь, зарегистрировавшийся на ещё не занятый email участника после того как его туда вписал владелец встречи, получает доступ к встрече и её файлам
    dto/create-meeting.dto.ts — { title (≤200 символов), date (ISO), participants: string[] (email, ≤50 штук, нормализуются через `normalizeEmail`) }, правила class-validator
  meeting-file/        — обычный модуль Nest (controller + service), защищён `JwtAuthGuard`
    meeting-file.module.ts     — импортирует AuthModule
    meeting-file.controller.ts — POST /meetings/:meetingId/files (multipart, поле `file`, `FileInterceptor` с лимитом `FILE_MAX_SIZE_BYTES` и `files: 1`), GET /meetings/:meetingId/files, GET /meetings/:meetingId/files/:fileId/download (побайтовая отдача через `StreamableFile`, `Content-Type` + `X-Content-Type-Options: nosniff`), DELETE /meetings/:meetingId/files/:fileId (204 No Content); все параметры-id — `ParseUUIDPipe`; под `@UseGuards(JwtAuthGuard)`
    meeting-file.service.ts    — только владелец встречи может загружать и удалять; список файлов и скачивание доступны владельцу и участникам (сверка по email из JwtPayload); недоступная/чужая встреча, чужой файл или недостающие права на удаление → 404 (как в `meeting`, скрывает существование). Загрузка: тип файла проверяется по белому списку `ALLOWED_MEETING_FILE_MIME_TYPES` (400 иначе — HTML/SVG сознательно исключены), лимит числа/суммарного объёма файлов на встречу — `assertQuotaOrThrow` (`MAX_FILES_PER_MEETING` / `MAX_TOTAL_SIZE_BYTES_PER_MEETING`). Файл читается в память (multer memory storage — лимит размера отклоняет запрос до записи на диск), затем пишется в `FILE_STORAGE_DIR` под случайным именем (`randomUUID` + расширение по проверенному mimetype из `MEETING_FILE_MIME_TYPE_EXTENSIONS`, не по имени файла от клиента) и фиксируется в таблице `MeetingFile`; удаление стирает запись в БД и файл с диска (`fs.unlink`, ошибка отсутствия файла игнорируется). Для `video/mp4`/`audio/mpeg` при создании записи сразу выставляется `transcriptionStatus = QUEUED`, затем без ожидания (не блокируя ответ на upload) запускается `WhisperTranscriptionService.transcribeFile` (модуль `transcription`) — статус проходит QUEUED → IN_PROGRESS → DONE (с `transcriptionText`) либо ERROR при сбое; после завершения (DONE или ERROR) публикуется `TranscriptionFinishedEvent` (`events/transcription-finished.event.ts`) через `EventBus` — на него реагирует `meeting-summary` (автовыжимка)
    file-storage.config.ts     — `getFileStorageDir()` / `getFileMaxSizeBytes()` (env `FILE_STORAGE_DIR` / `FILE_MAX_SIZE_BYTES`), `ALLOWED_MEETING_FILE_MIME_TYPES` / `MEETING_FILE_MIME_TYPE_EXTENSIONS` (белый список типов и расширение на диске по mimetype, включая `video/mp4` → `.mp4` и `audio/mpeg` → `.mp3` для транскрибации), `MAX_FILES_PER_MEETING` / `MAX_TOTAL_SIZE_BYTES_PER_MEETING` (квота на встречу)
    meeting-file.types.ts      — `MeetingFileResponse` — публичная форма файла без внутреннего `storagePath`, включает `transcriptionStatus` / `transcriptionText` (`null`, если транскрибация неприменима к формату файла)
  transcription/       — обычный модуль Nest (без контроллера — используется только другими сервисами), интеграция с локальным Whisper
    transcription.module.ts        — экспортирует `WhisperTranscriptionService`
    whisper-transcription.service.ts — `transcribeFile(filePath, mimeType)`: распознаёт речь локальной моделью Whisper (whisper.cpp через npm-пакет `nodejs-whisper`, без внешних API); извлечение аудиодорожки из `video/mp4` отдельным шагом не делается — `nodejs-whisper` сам прогоняет файл через системный `ffmpeg` перед распознаванием (нужен установленный `ffmpeg` в окружении). Бросает ошибку при сбое без внутреннего подавления — статус файла в ERROR переводит вызывающий код (`meeting-file.service.ts`)
    transcription.constants.ts     — `WHISPER_MODEL_NAME` (`'base'` — в PRD модель названа "low", такого размера у Whisper нет; `base` выбрана как ближайшая маленькая модель, обоснование в комментарии у константы), `TRANSCRIBABLE_MEETING_FILE_MIME_TYPES` (`video/mp4`, `audio/mpeg`)
  open-router/         — обычный модуль Nest (без контроллера), HTTP-клиент к OpenRouter — потребитель — `meeting-summary`
    open-router.module.ts      — экспортирует `OpenRouterService`
    open-router.service.ts     — `ask(prompt, model)`: `fetch` на `https://openrouter.ai/api/v1/chat/completions` (OpenAI-совместимый формат), возвращает `choices[0].message.content`; `chat({model, messages, tools})` — один шаг диалога с инструментами (tool calling), возвращает `{content, toolCalls}`; не-2xx или пустой ответ — ошибка
    open-router.types.ts       — типы сообщений/инструментов/вызовов OpenAI-совместимого формата
    open-router.config.ts      — `getOpenRouterApiKeyOrThrow()`: валидирует наличие `OPENROUTER_API_KEY` в `process.env`
    open-router.constants.ts   — `OPEN_ROUTER_FREE_MODEL` (`'liquid/lfm-2.5-2.6b:free'`) — бесплатная модель (суффикс `:free`, не списывает с баланса) для тестовых/быстрых запросов; `OPEN_ROUTER_FREE_TOOLS_MODEL` — бесплатная модель с поддержкой tool calling (для агента; список — `GET /api/v1/models?supported_parameters=tools`); лимит — 20 запросов/мин и 50/день, пока на аккаунт не куплено 10+ кредитов. Некоторые `:free` модели временами получают 429/502 от апстрим-провайдера (общий бесплатный пул на всех пользователей OpenRouter) — если тест начнёт падать с такой ошибкой, это не баг кода, стоит проверить `GET https://openrouter.ai/api/v1/models` и сменить модель на другую `:free`
    open-router.service.spec.ts — реальный вызов OpenRouter API (тратит токены), пропускается через `describe.skip`, если `OPENROUTER_API_KEY` не задан в окружении
  meeting-summary/     — обычный модуль Nest (controller + service), защищён `JwtAuthGuard`; выжимка встречи (summary, action items, решения) через `OpenRouterService`
    meeting-summary.controller.ts — GET /meetings/:meetingId/summary (сохранённая выжимка и статус, 404 если её ещё нет) и POST (202 Accepted) — ручной (повторный) запуск, используется кнопкой «Повторить» после `ERROR`: переводит выжимку в `IN_PROGRESS` и запускает генерацию без ожидания; 400 — нет `DONE`-транскрипций, 409 — генерация уже идёт
    meeting-summary.service.ts    — `getSummary` и `startGeneration` (доступ владельцу/участнику, иначе 404; атомарный захват статуса через `updateMany`/`create` — параллельный запуск даёт 409; после `ERROR` запуск разрешён), `startAutoGeneration(meetingId)` (автозапуск: ничего не делает, пока у встречи есть файлы `QUEUED`/`IN_PROGRESS` или нет `DONE`-транскрипций; при 409 — генерация уже идёт — помечает встречу в in-memory наборе и после окончания текущей генерации запускает повторный прогон по новым транскрипциям) и `generate`: берёт тексты транскрипций файлов со статусом `DONE`, запускает агента и полностью перезаписывает выжимку (статус `DONE`); при любом сбое — статус `ERROR` без записи данных
    events/start-summary-on-transcription-finished.handler.ts — `@EventsHandler(TranscriptionFinishedEvent)` → `MeetingSummaryService.startAutoGeneration`; ошибки только логирует. Событие публикует `MeetingFileService` (через CQRS `EventBus`) после завершения транскрибации файла — и при `DONE`, и при `ERROR`
    agent/                        — tool-calling агент выжимки: `meeting-summary-agent.service.ts` (цикл до `MAX_AGENT_STEPS`: `OpenRouterService.chat` → применение вызовов инструментов к черновику → ответы `tool` с `ok`/текстом ошибки валидации, чтобы модель могла исправиться; ошибка, если не вызван `finish` или нет summary), `meeting-summary-agent.tools.ts` (enum `MeetingSummaryAgentTool`: `set_summary`, `add_action_item`, `add_decision`, `finish` + JSON-схемы), `meeting-summary-agent.draft.ts` (черновик в памяти, `applyToolCall`, `finalizeDraft` — в БД пишется только целиком), `meeting-summary-agent.prompt.ts` (системный промпт, язык ответа = язык транскрипции)
    meeting-summary.constants.ts  — `MEETING_SUMMARY_MODEL` (`OPEN_ROUTER_FREE_TOOLS_MODEL`), `MEETING_SUMMARY_MAX_TOKENS`, `MAX_AGENT_STEPS`
  *.spec.ts          — unit-тесты рядом с кодом
prisma/
  schema.prisma      — datasource (env DATABASE_URL) + модели User (включая `tokenVersion` — отзыв JWT при смене пароля), Meeting (owner → User), MeetingFile (meeting → Meeting, uploadedBy → User; `transcriptionStatus` — enum `TranscriptionStatus` (QUEUED/IN_PROGRESS/DONE/ERROR), `null` = транскрибация неприменима (не video/mp4 или audio/mpeg); `transcriptionText` — текст готовой транскрипции), MeetingSummary (одна на Meeting: `status` — enum `MeetingSummaryStatus` IN_PROGRESS/DONE/ERROR, `summary`, `actionItems` Json `[{description, assignee|null}]`, `decisions` String[])
  migrations/        — SQL-миграции Prisma
test/
  app.e2e-spec.ts, auth.e2e-spec.ts, avatars.e2e-spec.ts, meeting.e2e-spec.ts, meeting-file.e2e-spec.ts, jest-e2e.json
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
- JWT — `JWT_SECRET` (**обязателен**, без дефолта, минимум 32 символа — иначе приложение не стартует, см. `getJwtSecretOrThrow`; сгенерировать: `openssl rand -base64 48`) и `JWT_EXPIRES_IN` (по умолчанию `1d`).
- CORS — `WEB_ORIGIN` (по умолчанию `http://localhost:3000`): список разрешённых origin фронтенда через запятую, включается в `main.ts` через `app.enableCors()` (ограничен по `methods`/`allowedHeaders`).
- Rate limiting — `@nestjs/throttler`, глобально 100 запросов/мин с одного IP (`ThrottlerModule` в `app.module.ts`), на `/auth/register`, `/auth/login` и `PATCH /profile/password` — 10 запросов/мин (`@Throttle`). Выключен при `NODE_ENV=test` (иначе падают e2e).
- Файлы встреч — `FILE_STORAGE_DIR` (по умолчанию `storage/meeting-files`, путь относительно `process.cwd()` — вне `dist`, не коммитится, см. `.gitignore`) и `FILE_MAX_SIZE_BYTES` (по умолчанию `10485760`, 10 MB). Тип файла — белый список MIME (`ALLOWED_MEETING_FILE_MIME_TYPES`), квота на встречу — `MAX_FILES_PER_MEETING` / `MAX_TOTAL_SIZE_BYTES_PER_MEETING` (константы в `file-storage.config.ts`, не env).
- Аватары пользователей — `AVATAR_STORAGE_DIR` (по умолчанию `storage/avatars`, та же логика, что и у файлов встреч) и `AVATAR_MAX_SIZE_BYTES` (по умолчанию `5242880`, 5 MB).
- OpenRouter (`open-router`) — `OPENROUTER_API_KEY` (без дефолта; отсутствие валидируется в `getOpenRouterApiKeyOrThrow()` при вызове `OpenRouterService.ask`). Без него пропускается `open-router.service.spec.ts`.

## Деплой

- `apps/api/Dockerfile` (multi-stage, собирать из корня репозитория: `docker build -f apps/api/Dockerfile -t video-meetings-api .` — нужен полный контекст монорепо из-за npm workspaces).
- Транскрибация (`transcription/whisper-transcription.service.ts`) требует в рантайме системный `ffmpeg` и собранный нативный биндинг whisper.cpp (пакет `nodejs-whisper`) со скачанной моделью (`WHISPER_MODEL_NAME` в `transcription.constants.ts`, сейчас `base`) — вне Docker-образа (например, при запуске `npm run start:prod` напрямую на хосте/VM) их нужно поставить и скачать вручную: `sudo apt install build-essential cmake ffmpeg` и `npx nodejs-whisper download` (интерактивно спросит имя модели и про CUDA — при отсутствии этого шага первый же файл mp4/mp3 уйдёт в `transcriptionStatus = ERROR`).
- Сборочный этап Dockerfile ставит build-инструменты (`build-essential`, `cmake`, `git`, `wget`) и скачивает модель `base` в момент сборки образа (`npx nodejs-whisper download`, ответ на визард подаётся неинтерактивно через `printf`), чтобы не тратить время/сеть на это при старте контейнера; рантайм-этап ставит только `ffmpeg` (build-инструменты там не нужны — биндинг уже скомпилирован).
- Контейнер на старте сам применяет миграции (`prisma migrate deploy`) перед `node dist/main.js` — накатывать их вручную в проде не требуется.
- `FILE_STORAGE_DIR`/`AVATAR_STORAGE_DIR` — не персистентные volume в образе; в проде монтировать их как volume/managed storage, иначе загруженные файлы и аватары теряются при пересоздании контейнера.

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
это ожидаемо, данные живут в dev-БД. `JWT_SECRET` (обязателен) / `JWT_EXPIRES_IN` берутся из
`apps/api/.env`.

Один файл или один кейс: `npm test -- auth` (по подстроке пути), `npm run test:e2e -- -t "returns a JWT"` (по имени `it`/`describe`).

Перед коммитом изменений в api прогонять оба набора и убеждаться, что они зелёные.

## CQRS (модули `auth` и `users`)

`auth` и `users` реализованы по паттерну **CQRS** через `@nestjs/cqrs` (`CqrsModule` в `imports` каждого).
Остальные модули (напр. `meeting`) CQRS не используют (исключение — доменное событие `TranscriptionFinishedEvent` между `meeting-file` и `meeting-summary` через `EventBus`) — там обычные `controller` + `service`. Применять CQRS
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
