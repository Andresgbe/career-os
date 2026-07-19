# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build via Vite
- `npm run lint` — ESLint over the whole project
- `npm run preview` — preview the production build locally

There is no test runner configured in this project.

## Architecture

NEXUS ("career-os") is a personal dashboard SPA: React 19 + TypeScript + Vite, Tailwind v4 (via `@tailwindcss/vite`, config lives in `src/index.css` under `@theme`, not a `tailwind.config.js`), React Router v7, and Supabase for auth + data.

### Module system

The app is organized as a fixed set of "modules" (Motorcycle, Medical, Content, Grades, Projects, Programming, Tasks), each a self-contained vertical slice under `src/features/<name>/`. A module typically contains:
- `<Name>Page.tsx` — top-level page with its own tab state, fetches data in `useEffect` and passes it down
- `api.ts` — direct Supabase queries (no shared data-fetching layer/React Query; each module calls `supabase.from(...)` itself and throws on `error`)
- `types.ts` — row types matching Supabase tables, plus any pure helper functions for that domain (e.g. grade-point math in `grades/types.ts`)
- `tabs/` — sub-views switched by local tab state within the page
- `components/` — module-scoped UI pieces

`src/lib/modules.ts` (`MODULES`) is the single source of truth for module metadata (id, name, route path, description, icon) driving both the dashboard cards and the nav in `AppLayout`. Adding a module means: add an entry here, add a route in `src/app/router.tsx`, and add the `src/features/<name>/` slice.

Not every module is wired to Supabase yet — e.g. `features/projects/ProjectsPage.tsx` currently renders hardcoded mock data as a placeholder; follow the `grades` or `medical` module as the reference pattern for a fully wired module (api.ts + types.ts + tabs).

### Routing & auth

- `src/app/router.tsx` defines all routes and wraps the authenticated tree in a `ProtectedRoute` that reads `useAuth()` and redirects to `/login` when there's no session.
- `src/hooks/useAuth.tsx` is a context provider (mounted once in `main.tsx`) wrapping Supabase's `auth.getSession()` / `onAuthStateChange`.
- `src/lib/supabase.ts` creates the single Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (throws at import time if missing — set these in `.env.local`).
- `src/app/layout/AppLayout.tsx` is the authenticated shell (topbar, mobile drawer nav, sign-out) rendered around `<Outlet />`. Note: `src/app/AppLayout.tsx` (one level up, no `layout/`) is a stale duplicate not referenced by the router — don't edit it by mistake.
- `src/App.tsx` is likewise unused dead code; the real entry tree is `main.tsx` → `AuthProvider` → `RouterProvider`.

### Styling conventions

Design tokens (`--color-background`, `--color-surface`, `--color-primary`, `--color-muted`, etc.) are defined once in `src/index.css` and consumed as Tailwind utility classes (`bg-surface`, `text-muted`, `border-border`, ...). Reuse these tokens rather than introducing raw colors, so all modules share the same dark theme.
