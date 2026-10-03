# AI Learning Platform

Fieldnote helps learners understand competency gaps, follow a personalized roadmap, discover courses, track progress, and get learning guidance from an AI coach.

## Run & Operate

- The managed `artifacts/learning-platform: web` workflow serves the app at `/`.
- The managed `artifacts/api-server: API Server` workflow serves the API under `/api`.
- `pnpm run typecheck` — check all workspace packages.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients after OpenAPI changes.
- `pnpm --filter @workspace/db run push` — apply development schema changes.
- `GEMINI_API_KEY` — server-side secret required for AI coach responses.
- `ALLOWED_ORIGINS` — optional comma-separated origin allowlist for cross-origin API clients; same-origin app requests do not need it.

## Stack

- React, Vite, TypeScript, and Wouter
- Shared Express 5 API server
- PostgreSQL and Drizzle ORM
- OpenAPI contracts with generated Zod validators and React Query hooks
- Google Gemini API via the server-side `@google/genai` SDK

The supplied brief requested Python/FastAPI and MySQL. This first app build uses the workspace's existing TypeScript/Express and managed PostgreSQL foundation rather than replacing the runtime or database.

## Product scope

The current learner-focused release includes a dashboard, course catalog, competency gaps, a personalized roadmap, persistent demo-learner progress, recent activity, and a Gemini learning coach. The initial course and competency records are seed data.

This is not yet a production enterprise learning platform. There is no sign-in, user-specific data isolation, enforced role-based access, admin/trainer/department-head workspace, file analysis, assessment engine, certificates, or reporting/export workflow. Progress belongs to one shared demo learner until authentication and ownership are implemented.

## Source of truth

- `lib/api-spec/openapi.yaml` — API contract
- `lib/db/src/schema/learning.ts` — learning tables
- `artifacts/api-server/src/routes/learning.ts` — learning API and seed data
- `artifacts/learning-platform/src/App.tsx` — app routes and interface
- `artifacts/learning-platform/src/index.css` — visual theme