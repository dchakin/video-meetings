# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Overview

`video-meetings` is a monorepo on **npm workspaces** (Node.js >= 22).

```
apps/
  web/   — frontend: Nuxt 4 + Nuxt UI (TypeScript, ESM)
  api/   — backend: Nest.js 11 + Prisma 6 (PostgreSQL), JWT authentication (CQRS, @nestjs/cqrs) (TypeScript, CommonJS)
packages/
  eslint-config/ — shared flat ESLint config (@video-meetings/eslint-config, exports ./base)
  tsconfig/      — shared tsconfig (@video-meetings/tsconfig: base.json / nestjs.json)
```

Each app has its own `CLAUDE.md` in `apps/web/` and `apps/api/` — read it when working inside that workspace.

## Commands, setup, DB, tests

The full list of commands (from the root and per workspace), dependency installation, bringing up PostgreSQL
and running unit/e2e tests — see `README.md`. For a single workspace: `npm run <script> -w @video-meetings/web`
(or `@video-meetings/api`). The PostgreSQL port is set via `POSTGRES_PORT` (defaults to `5432`, but locally
may be overridden in `.env`) — check `.env` for the actual value instead of assuming it's fixed.
Details on api tests (test suites, running a single file/case) — `apps/api/CLAUDE.md`, section "Tests".

## Conventions

- **Do not edit by hand** generated files: `apps/web/.nuxt/**`, `apps/web/.output/**`, `apps/api/dist/**`.
- Change shared ESLint and tsconfig rules in `packages/*`, framework-specific ones in the apps themselves.
- Formatting — Prettier (`.prettierrc.json`), doesn't conflict with ESLint (`eslint-config-prettier`). After every `Write`/`Edit`, Claude Code automatically runs Prettier on the changed file (`PostToolUse` hook → `.claude/hooks/format-changed-file.mjs`).
- `.npmrc`: `engine-strict=true`, `save-exact=false`.
- Run `npm run lint` and `npm run typecheck` before committing.
- **Git hooks — Husky** (`.husky/`, initialized by the `prepare` script on `npm install`). `pre-commit` runs `npm run lint`, `npm run test` (unit tests across all workspaces) and `npm run test:e2e -w @video-meetings/api` (api e2e); the commit fails if anything fails. E2e tests require a running DB with migrations applied (`npm run db:up` + `npm run prisma:migrate -w @video-meetings/api`). To skip the check once — `git commit --no-verify`.

## Token economy

- `git diff` always with `--unified=0`
- `git log` always with `--oneline -10`
- `gh issue list` always with `--json number,title`
- `npm run test` always with `--silent`
- `npx tsc --noEmit` always with `2>&1 | tail -5`

## Keeping documentation up to date

When you change the project's architecture, update the documentation in the same change:

- new/renamed/removed workspace in `apps/*` or `packages/*` — update this file, `README.md`, and create/remove the corresponding `apps/*/CLAUDE.md`;
- stack, framework, or major version change — update the root `CLAUDE.md` and the `CLAUDE.md` of the affected workspace;
- changes to commands, scripts, ports, or environment variables — update `package.json` (`scripts`), the command list in `README.md`, and the configuration sections in the `CLAUDE.md` of the affected workspaces (`apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`);
- changes to conventions (module structure, test locations, lint/tsconfig rules) — record them in the "Conventions" section of the corresponding `CLAUDE.md`.

Documentation must not fall behind the code: a discrepancy is a bug.
