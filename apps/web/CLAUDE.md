# CLAUDE.md — apps/web

Фронтенд `@video-meetings/web`. Указания для Claude Code внутри этого воркспейса.

## Стек

- **Nuxt 4** (`compatibilityDate: 2025-01-01`), Vue 3, `vue-router`.
- **Nuxt UI** (`@nuxt/ui`, см. версию в `package.json`) + Tailwind через `~/assets/css/main.css`.
- Модули Nuxt: `@nuxt/eslint`, `@nuxt/ui`.
- TypeScript, тип модулей — ESM (`"type": "module"`).

## Структура

```
app/
  app.vue              — корневой компонент: <UApp> + <NuxtPage />
  app.config.ts        — тема Nuxt UI (ui.colors: primary=blue, neutral=slate)
  pages/               — файловый роутинг (index — дашборд со списком встреч, register, login)
  components/           — auto-import компоненты (AuthBackdrop — фон страниц auth; MeetingCard — карточка встречи)
  composables/         — auto-import композаблы (useAuth — клиент API auth, JWT в cookie access_token + данные пользователя из payload; useApi — авторизованный $fetch к API; useMeetings — CRUD встреч)
  middleware/          — маршрутные middleware (guest — уводит авторизованного с /login и /register на /; auth — уводит гостя с приватных страниц на /login)
  assets/css/main.css  — глобальные стили / точка входа Tailwind + @theme (шрифты, --ui-radius)
nuxt.config.ts         — конфиг Nuxt
eslint.config.mjs      — конфиг из @nuxt/eslint + общий base (только для JS/TS, не для *.vue)
```

Каталог `srcDir` — `app/` (структура Nuxt 4). Наличие `app/pages/` включает `vue-router` (в `app.vue` — `<NuxtPage />`). Автогенерация — в `.nuxt/`, сборка — в `.output/`.

Иконки — коллекция `@iconify-json/lucide` (bundled локально, `i-lucide-*`).
Шрифты — `Inter` (`--font-sans`) и `Manrope` (`--font-display`, класс `font-display` для заголовков), self-hosted через `@nuxt/fonts` (идёт с `@nuxt/ui`).
Палитра — синяя: `primary` = `blue` в `app.config.ts`; в компонентах использовать семантические цвета/классы Nuxt UI (`text-primary`, `bg-default`, …), не сырые оттенки Tailwind.

## Команды

| Команда                     | Действие                   |
| --------------------------- | -------------------------- |
| `npm run dev`               | Dev-сервер на `:3000`      |
| `npm run build`             | `nuxt build` → `.output/`  |
| `npm run start`             | `nuxt preview` на `:3000`  |
| `npm run generate`          | Статическая генерация      |
| `npm run lint` / `lint:fix` | ESLint                     |
| `npm run typecheck`         | `nuxt typecheck` (vue-tsc) |

`postinstall` вызывает `nuxt prepare` — он генерирует `.nuxt/tsconfig.json` и `.nuxt/eslint.config.mjs`, от которых зависят `tsconfig.json` и `eslint.config.mjs`. После смены зависимостей/конфига запускать `nuxt prepare` (или `npm install`).

## Конфигурация

- `runtimeConfig.public.apiBase` ← `NUXT_PUBLIC_API_BASE` (по умолчанию `http://localhost:4000`).
- Пример env — `.env.example`.

## Соглашения

- Не редактировать `.nuxt/**`, `.output/**` — они генерируются.
- UI строить на компонентах Nuxt UI (`U*`); доступна skill `nuxt-ui` в `.agents/skills/`.
- Любое изменение UI обязательно тестировать визуально через Playwright MCP — запустить приложение, открыть страницу в браузере и проверить работу изменения (в т.ч. скриншот) — и прогнать проверку по skill `ui-ux-pro-max`. Без выполнения обоих шагов задача не считается завершённой.
- `tsconfig.json` только расширяет `./.nuxt/tsconfig.json` — реальные настройки задаёт Nuxt.
- Тесты пока не настроены.
- При изменении архитектуры воркспейса (структура `app/`, модули Nuxt, стек, команды, env) обновляй этот файл и, если нужно, корневой `CLAUDE.md` / `README.md` в том же изменении. См. раздел «Поддержка документации» в корневом `CLAUDE.md`.
