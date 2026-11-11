# AGENTS.md

Project guidance for AI coding assistants.

## Commands

- Dev server: `npm run dev` (port 3000)
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`
- Lint: `npm run lint`

## Conventions

- File-based routing via TanStack Router; the main dashboard is a single
  monolith in `src/routes/index.tsx`.
- `@/*` maps to `src/*`.
- All app state is client-side mock data; URL search params are the source of
  truth for filters/views (validated by Zod in `searchSchema`).
- Production server is Nitro (Vercel preset) — `src/server.ts` is the SSR entry.

## Git

- Do not rewrite pushed history (force-push, rebase, amend, squash) on shared
  branches.
- Keep the default branch in a working, buildable state.
