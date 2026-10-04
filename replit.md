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
- `LEARNING_ROLE_ASSIGNMENTS` — optional comma-separated `clerkUserId=role` assignments (`learner`, `trainer`, `department_head`, or `admin`). Roles are never self-selected in the app.

## Stack

- React, Vite, TypeScript, and Wouter
- Shared Express 5 API server
- PostgreSQL and Drizzle ORM
- OpenAPI contracts with generated Zod validators and React Query hooks
- Google Gemini API via the server-side `@google/genai` SDK

The supplied brief requested Python/FastAPI and MySQL. This first app build uses the workspace's existing TypeScript/Express and managed PostgreSQL foundation rather than replacing the runtime or database.

## Product scope

The learner experience includes a dashboard, course catalog, private competency profile, personalized roadmap, course progress, recent activity, a Gemini learning coach, and account settings for appearance and learning preferences. Clerk sign-in is required for learning routes. Each account receives its own progress, competency, roadmap, activity, and learning-preference records; course descriptions remain a shared catalog. New accounts default to the learner role.

The API enforces authentication, scopes learner data by verified Clerk user ID, and restricts learner progress updates, learning settings, and coach requests to the learner role. Administrators can assign roles with `LEARNING_ROLE_ASSIGNMENTS`; the app does not yet include role-management screens or trainer, department-head, or admin workspaces. File analysis, assessments, certificates, and reporting/export workflows are also not implemented.

## Source of truth

- `lib/api-spec/openapi.yaml` — API contract
- `lib/db/src/schema/learning.ts` — learning tables
- `artifacts/api-server/src/routes/learning.ts` — learning API and seed data
- `artifacts/learning-platform/src/App.tsx` — app routes and interface
- `artifacts/learning-platform/src/index.css` — visual theme