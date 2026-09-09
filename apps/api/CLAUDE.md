# CLAUDE.md — apps/api

Бэкенд `@video-meetings/api`. Указания для Claude Code внутри этого воркспейса.

## Стек

- **Nest.js 11** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`).
- TypeScript, CommonJS, декораторы (`emitDecoratorMetadata`, `experimentalDecorators`).
- `tsconfig.json` расширяет `@video-meetings/tsconfig/nestjs.json`.
- Тесты — Jest + ts-jest (конфиг в `package.json`, `rootDir: src`, `*.spec.ts`); e2e — `test/jest-e2e.json`.

## Структура

```
src/
  main.ts            — bootstrap, слушает PORT (по умолчанию 4000)
  app.module.ts      — корневой модуль
  app.controller.ts  — GET / → AppService.getHello()
  app.service.ts
  *.spec.ts          — unit-тесты рядом с кодом
test/
  app.e2e-spec.ts, jest-e2e.json
nest-cli.json        — sourceRoot: src, deleteOutDir: true
```

Сборка — в `dist/` (`nest build`).

## Команды

| Команда                                    | Действие                        |
| ------------------------------------------ | ------------------------------- |
| `npm run dev`                              | `nest start --watch`            |
| `npm run start`                            | `nest start`                    |
| `npm run start:prod`                       | `node dist/main.js`             |
| `npm run build`                            | `nest build` → `dist/`          |
| `npm run lint` / `lint:fix`                | ESLint по `{src,test}/**/*.ts`  |
| `npm run typecheck`                        | `tsc --noEmit -p tsconfig.json` |
| `npm run test` / `test:watch` / `test:cov` | Jest unit                       |
| `npm run test:e2e`                         | Jest e2e                        |

## Конфигурация

- Порт — `PORT` (по умолчанию 4000). Пример env — `.env.example`.

## Соглашения

- Не редактировать `dist/**` — генерируется, чистится при каждой сборке.
- Новые фичи — модулями Nest: `<feature>.module.ts` / `.controller.ts` / `.service.ts`, регистрировать в `imports` родительского модуля.
- Unit-тесты класть рядом с кодом как `*.spec.ts`.
- Общие правила ESLint — в `packages/eslint-config`; общий tsconfig — в `packages/tsconfig/nestjs.json`.
- При изменении архитектуры воркспейса (структура `src/`, набор модулей, стек, команды, env) обновляй этот файл и, если нужно, корневой `CLAUDE.md` / `README.md` в том же изменении. См. раздел «Поддержка документации» в корневом `CLAUDE.md`.
