# Repository Guidelines

## Project Structure & Module Organization

Application code lives in `app/`: route modules in `routes/`, shared UI in `components/`, business logic in `services/`, SQLite access in `db/`, and utilities in `lib/`. Tests mirror these areas under `tests/`. Drizzle migrations are committed in `drizzle/`, maintenance scripts in `scripts/`, and documentation in `docs/`. Current requirements live in `openspec/specs/`; proposals in `openspec/changes/` may describe future work, while `archive/` is historical.

## Build, Test, and Development Commands

- `npm install` installs dependencies; Node.js 22.22 or newer is required.
- `npm run dev` applies migrations, then starts the React Router development server.
- `npm run build` creates the production client and server bundles.
- `npm start` serves the completed build from `build/server/index.js`.
- `npm test` runs the Vitest suite once; `npm run test:watch` supports local iteration.
- `npm run test:e2e` runs Playwright tests from `tests/e2e/`.
- `npm run lint` checks ESLint; `npm run typecheck` generates route types and checks TypeScript.
- `npm run db:generate` creates migration files after schema changes; `npm run db:migrate` applies them.

## Coding Style & Naming Conventions

Use TypeScript/TSX with two-space indentation. Prettier enforces semicolons, double quotes, and trailing commas; check broad formatting changes with `npx prettier --check .`. ESLint includes TypeScript and React Hooks rules. Use kebab-case filenames, PascalCase components, and camelCase functions/variables. Follow dotted and dynamic route naming, such as `reports.project-financials.tsx` and `projects.$id.tsx`. Prefer the `~/*` application import alias.

## Testing Guidelines

Write Vitest files as `*.test.ts` or `*.test.tsx` under the matching `tests/` area. Use behavior-focused names and cover authorization, validation, persistence, and route outcomes. There is no enforced coverage threshold; meaningful regression coverage is expected. Run tests, typechecking, and linting before opening a PR.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit prefixes with concise Japanese summaries, for example `feat: v0.6の案件財務を追加`, plus `docs:` and `chore:`. Keep each commit focused. PRs should explain the use case, affected workflow, authorization impact, reproduction steps, and expected versus actual behavior. Link related issues or OpenSpec changes, include screenshots for UI changes, and call out migrations or configuration changes.

## Security & Configuration

Copy settings from `.env.example`; never commit secrets or local SQLite data. Production requires a `KOSU_SESSION_SECRET` of at least 32 characters. Treat `data/` as persistent state and consult `docs/release-checklist.md` before release or Docker deployment.
