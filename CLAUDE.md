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

### Reuse shared components before writing new ones

**Before building a new UI piece, check `src/components/` first — a strong project goal is maximizing reuse across modules rather than re-implementing the same widget per feature.** Several near-identical components already got duplicated once per module (e.g. four copies of `ConfirmDialog.tsx`) before being consolidated back into `src/components/`; don't reintroduce that pattern. Current shared components:

- `ConfirmDialog` — standard delete/destructive-action confirmation modal (title, message, Cancel/Confirm). Used everywhere something can be deleted.
- `RichTextEditor` (+ exported `RICH_CONTENT_CLASS`) — contentEditable-based rich text editor (bold, uppercase, color, bullets, inline image upload via a passed-in `uploadImage` fn). Render its saved HTML read-only with `dangerouslySetInnerHTML` wrapped in `RICH_CONTENT_CLASS` so bullets/images look identical in edit and view mode.
- `CodeBlock` — collapsible code snippet; pass `onChange` to make it an editable input, omit it for a read-only collapsible viewer.
- `TableBlock` — collapsible free-form spreadsheet-like table block, same editable-via-`onChange` / read-only-without-it convention as `CodeBlock`.
- `ShortcutsBar` / `ShortcutTile` — the icon-grid "quick links" row (with add/reorder/delete, favicon auto-detection, custom icon upload) used on the Dashboard, Grades, and Work Tracker pages, each backed by its own `*_shortcuts` table.
- `SectionContextButton` — the fixed "CONTEXT" tab docked to the left edge of the viewport, mounted once in `AppLayout` so it appears on every module automatically. See "Section context" below.

The **block pattern** — a title plus optional `RichTextEditor` + `CodeBlock` + `TableBlock` — is the standard shape for "flexible free-form entry" features (see `work_general_info`, `project_entries`, `work_endpoints`). Reach for that combination again rather than inventing a new entry format when a module needs open-ended notes.

### Module system

The app is organized as a fixed set of "modules" (Motorcycle, Medical, Content, Grades, Project Management, Programming, Tasks, Insurance, Finance, Work Tracker), each a self-contained vertical slice under `src/features/<name>/`. A module typically contains:
- `<Name>Page.tsx` — top-level page with its own tab state, fetches data in `useEffect` and passes it down
- `api.ts` — direct Supabase queries (no shared data-fetching layer/React Query; each module calls `supabase.from(...)` itself and throws on `error`)
- `types.ts` — row types matching Supabase tables, plus any pure helper functions for that domain (e.g. grade-point math in `grades/types.ts`)
- `tabs/` — sub-views switched by local tab state within the page
- `components/` — module-scoped UI pieces (only for things genuinely specific to that module — check `src/components/` first, see above)

`src/lib/modules.ts` (`MODULES`) is the single source of truth for module metadata (id, name, route path, description, icon) driving both the dashboard cards, the nav in `AppLayout`, and the section key `SectionContextButton` uses. Adding a module means: add an entry here, add a route in `src/app/router.tsx`, and add the `src/features/<name>/` slice.

All modules are now wired to Supabase (the earlier placeholder mock data in `projects` has been replaced by a real `personal_projects` + `project_entries` backend). `grades`, `medical`, and `work` remain good reference patterns for a fully wired module (api.ts + types.ts + tabs).

A few modules go one level deeper with a **nested workspace** pattern: a list page (`ProjectsPage.tsx`) links into a per-item page with its own route param and its own tab bar (`ProjectWorkspacePage.tsx` at `/projects/:id`, tabs: Overview/Links/Credentials/Images/Entries). Reach for this when a module's items each need a substantial amount of their own sub-content, rather than cramming it into an expandable card.

### Section context ("CONTEXT" button)

Every module page gets a free-text scratchpad, without any per-page wiring: `SectionContextButton` is mounted once in `AppLayout.tsx` and renders a fixed tab on the left edge of the viewport on every route. Clicking it opens a modal with an editable textarea (paste-anything) plus Copy and Save. The note is scoped by matching `location.pathname` against `MODULES` (falls back to `"dashboard"` on `/`) and persisted via `src/lib/sectionContext.ts` against the `section_notes` table (one row per `user_id` + `section`, upserted on save). Don't add bespoke "notes" fields to a module when this already covers the same need.

### Routing & auth

- `src/app/router.tsx` defines all routes and wraps the authenticated tree in a `ProtectedRoute` that reads `useAuth()` and redirects to `/login` when there's no session.
- `src/hooks/useAuth.tsx` is a context provider (mounted once in `main.tsx`) wrapping Supabase's `auth.getSession()` / `onAuthStateChange`.
- `src/lib/supabase.ts` creates the single Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (throws at import time if missing — set these in `.env.local`).
- `src/app/layout/AppLayout.tsx` is the authenticated shell (topbar, mobile drawer nav, sign-out) rendered around `<Outlet />`. Note: `src/app/AppLayout.tsx` (one level up, no `layout/`) is a stale duplicate not referenced by the router — don't edit it by mistake.
- `src/App.tsx` is likewise unused dead code; the real entry tree is `main.tsx` → `AuthProvider` → `RouterProvider`.

### Styling conventions

Design tokens (`--color-background`, `--color-surface`, `--color-primary`, `--color-muted`, etc.) are defined once in `src/index.css` and consumed as Tailwind utility classes (`bg-surface`, `text-muted`, `border-border`, ...). Reuse these tokens rather than introducing raw colors, so all modules share the same dark theme.

### Supabase data layer

There is no `supabase/` migrations directory or CLI setup in this repo — schema changes are applied by hand against the live project via the SQL editor or the Supabase MCP connector (`apply_migration`), not tracked as files. Keep this doc's description of the schema in sync manually when you add/change tables.

- **The app's real project ref is `dmhlbgdakispkgbucgmq`** (read `VITE_SUPABASE_URL` in `.env.local` to confirm). The Supabase MCP connector is authorized per-organization from the claude.ai Connectors settings and may be pointed at a *different* Supabase project/org than this app — always cross-check `list_projects`' project id against `.env.local` before running any migration against it, don't assume the only project it can see is the right one.
- Every table follows the same per-user shape: `user_id uuid not null references auth.users(id) on delete cascade`, RLS enabled, and four policies (select/insert/update/delete) each gated on `auth.uid() = user_id`. Match this exactly for new tables.
- Repeatable/array fields (headers, resources, platforms, category_ids, tech_stack, milestones, ...) are stored as `jsonb not null default '[]'::jsonb`, normalized back to typed arrays in `api.ts` (`Array.isArray(...) ? ... : []`) since Supabase returns raw JSON. Optional text fields default to `''`, not `null`.
- Storage buckets are public (e.g. `work-files`, `shortcut-icons`) so uploaded image/icon URLs can be embedded directly without re-signing on every render.
