# Architecture Snapshot

## Repository Map

140 modules, 1705 symbols, grouped by area. Every module is in `facts.jsonl`, or query_facts(kind="module").

| Area | Modules | Symbols | Languages |
|------|---------|---------|-----------|
| `apps` | 140 | 1705 | typescript |

Largest modules:
- `apps/backend/src/client` — 164 symbols (typescript)
- `apps/backend/src/pro` — 151 symbols (typescript)
- `apps/backend/src/common` — 100 symbols (typescript)
- `apps/web/components` — 89 symbols (typescript)
- `apps/backend/src` — 67 symbols (typescript)
- `apps/pro/components` — 61 symbols (typescript)
- `apps/backend/src/modules/auth` — 57 symbols (typescript)
- `apps/backend/src/modules/directory` — 51 symbols (typescript)
- `apps/admin/components` — 49 symbols (typescript)
- `apps/backend/src/modules/finance` — 48 symbols (typescript)
- `apps/backend/src/modules/people` — 44 symbols (typescript)
- `apps/backend/src/modules/marketplace` — 40 symbols (typescript)
- `apps/admin/.next/types/app/(panel)` — 30 symbols (typescript)
- `apps/pro/.next/types/app` — 30 symbols (typescript)
- `apps/web/.next/types/app` — 30 symbols (typescript)
- `apps/web/lib` — 27 symbols (typescript)
- `apps/pro/lib` — 26 symbols (typescript)
- `apps/backend/src/modules/admins` — 22 symbols (typescript)
- `apps/backend/src/modules/audit` — 21 symbols (typescript)
- `apps/admin/lib` — 18 symbols (typescript)

## Extraction Quality

- Files parsed: **249** / 825 seen (1 file(s) + 6 directory tree(s) skipped by ignore globs)
- Parse errors: 0

## Architecture Pattern

**Architecture pattern: nextjs** (confidence: 79%)

Recognised nextjs from directory names: 111 of 140 typescript modules classified. All 518 imports between ordered layers run inward; none run against the order.

Layer mapping:
- module "apps/admin/.next/static/webpack/app" maps to layer "pages"
- module "apps/admin/.next/types/app" maps to layer "pages"
- module "apps/admin/.next/types/app/(panel)" maps to layer "pages"
- module "apps/admin/.next/types/app/login" maps to layer "pages"
- module "apps/admin/app" maps to layer "pages"
- module "apps/admin/app/(panel)" maps to layer "pages"
- module "apps/admin/app/(panel)/administrateurs" maps to layer "pages"
- module "apps/admin/app/(panel)/categories" maps to layer "pages"
- module "apps/admin/app/(panel)/clients" maps to layer "pages"
- module "apps/admin/app/(panel)/commandes" maps to layer "pages"
- module "apps/admin/app/(panel)/comptabilite" maps to layer "pages"
- module "apps/admin/app/(panel)/compte" maps to layer "pages"
- … and 99 more (query_insights(explainer="layers") for all)

## How to Add a Feature

This code is laid out as **nextjs**. A dependency runs from an outer layer to an inner one, so a feature is built inward:

1. **api, pages** — e.g. `apps/backend/api`
2. **components** — e.g. `apps/admin/components`
3. **lib** — e.g. `apps/admin/lib`

## Entry Points

- **handler**: `apps/backend/src.handler` (apps/backend/src/serverless.ts)
- **main**: `apps/backend/src/seed.main` (apps/backend/src/seed/seed.ts)
275 routes, 15 shown:
- **route** DELETE `/advertisements/:id` (apps/backend/src/modules/directory/directory.controller.ts)
- **route** DELETE `/auth/me` (apps/backend/src/client/auth.controller.ts)
- **route** DELETE `/auth/me` (apps/backend/src/modules/auth/auth.controller.ts)
- **route** DELETE `/auth/me` (apps/backend/src/pro/auth.controller.ts)
- **route** DELETE `/auth/sessions/:id` (apps/backend/src/modules/auth/auth.controller.ts)
- **route** DELETE `/products/:id` (apps/backend/src/modules/marketplace/marketplace.controller.ts)
- **route** DELETE `/vehicles/:id` (apps/backend/src/client/account.controller.ts)
- **route** GET `/` (apps/admin/.next/types/app/(panel)/layout.ts)
- **route** GET `/` (apps/admin/.next/types/app/(panel)/page.ts)
- **route** GET `/` (apps/admin/.next/types/app/layout.ts)
- **route** GET `/` (apps/admin/app/(panel)/layout.tsx)
- **route** GET `/` (apps/admin/app/(panel)/page.tsx)
- **route** GET `/` (apps/admin/app/layout.tsx)
- **route** GET `/` (apps/pro/.next/types/app/layout.ts)
- **route** GET `/` (apps/pro/.next/types/app/page.ts)
- … and 260 more (query_facts(kind="route") for all)

## Routes

275 routes, grouped by path prefix. query_facts(kind="route") for all of them.

| Prefix | Routes | Methods | Example |
|--------|--------|---------|----------|
| `/auth` | 34 | DELETE, GET, PATCH, POST | `/auth/2fa/enroll` |
| `/interventions` | 19 | GET, POST | `/interventions` |
| `/` | 14 | GET | `/` |
| `/compte` | 14 | GET | `/compte` |
| `/finance` | 12 | GET, POST | `/finance` |
| `/requests` | 8 | GET, POST | `/requests` |
| `/admins` | 7 | GET, PATCH, POST | `/admins` |
| `/companies` | 7 | GET, PATCH, POST | `/companies` |
| `/products` | 7 | DELETE, GET, PATCH, POST | `/products` |
| `/professionals` | 7 | GET, PATCH, POST | `/professionals` |
| `/orders` | 6 | GET, POST | `/orders` |
| `/professionnels` | 6 | GET | `/professionnels` |
| `/profil` | 6 | GET | `/profil` |
| `/advertisements` | 5 | DELETE, GET, PATCH, POST | `/advertisements` |
| `/notifications` | 5 | GET, POST | `/notifications` |
| `/service-categories` | 5 | GET, POST, PUT | `/service-categories` |
| `/bienvenue` | 4 | GET | `/bienvenue` |
| `/connexion` | 4 | GET | `/connexion` |
| `/entreprises` | 4 | GET | `/entreprises` |
| `/inscription` | 4 | GET | `/inscription` |
| `/operations` | 4 | GET | `/operations` |
| `/product-categories` | 4 | GET, PATCH, POST | `/product-categories` |
| `/services` | 4 | GET | `/services` |
| `/users` | 4 | GET, POST | `/users` |
| `/vehicles` | 4 | DELETE, GET, PATCH, POST | `/vehicles` |
| `/ads` | 3 | GET, POST | `/ads` |
| `/api` | 3 | GET | `/api` |
| `/audit-logs` | 3 | GET | `/audit-logs` |
| `/disputes` | 3 | GET, POST | `/disputes` |
| `/invoices` | 3 | POST | `/invoices/:id/confirm` |
| `/marketplace` | 3 | GET | `/marketplace` |
| `/mot-de-passe-oublie` | 3 | GET | `/mot-de-passe-oublie` |
| `/reviews` | 3 | GET, POST | `/reviews` |
| `/site-images` | 3 | GET, PUT | `/site-images` |
| `/accounting` | 2 | GET | `/accounting/export` |
| `/actualites` | 2 | GET | `/actualites` |
| `/aide` | 2 | GET | `/aide` |
| `/dashboard` | 2 | GET | `/dashboard` |
| `/demandes` | 2 | GET | `/demandes` |
| `/depannage` | 2 | GET | `/depannage` |
| `/documents` | 2 | GET, POST | `/documents` |
| `/favoris` | 2 | GET | `/favoris` |
| `/login` | 2 | GET | `/login` |
| `/recherche` | 2 | GET | `/recherche` |
| `/reports` | 2 | GET, POST | `/reports` |
| `/settings` | 2 | GET, PUT | `/settings/commission` |
| `/uploads` | 2 | POST | `/uploads/signature` |
| `/a-propos` | 1 | GET | `/a-propos` |
| `/administrateurs` | 1 | GET | `/administrateurs` |
| `/catalogue` | 1 | GET | `/catalogue/[id]` |
| `/categories` | 1 | GET | `/categories` |
| `/clients` | 1 | GET | `/clients` |
| `/commandes` | 1 | GET | `/commandes` |
| `/comptabilite` | 1 | GET | `/comptabilite` |
| `/confidentialite` | 1 | GET | `/confidentialite` |
| `/earnings` | 1 | GET | `/earnings` |
| `/events` | 1 | GET | `/events/recent` |
| `/gains` | 1 | GET | `/gains` |
| `/health` | 1 | GET | `/health` |
| `/journal` | 1 | GET | `/journal` |

## Dependency Rules

- `apps/admin/app/(panel)/interventions` -> `apps/admin/components`
- `apps/admin/app/(panel)/interventions` -> `apps/admin/lib`
- `apps/admin/app/(panel)/professionnels` -> `apps/admin/components`
- `apps/admin/app/(panel)/professionnels` -> `apps/admin/lib`
- `apps/admin/app/(panel)` -> `apps/admin/components`
- `apps/admin/app/(panel)` -> `apps/admin/lib`
- `apps/admin/app` -> `apps/admin/components`
- `apps/admin/app` -> `apps/admin/lib`
- `apps/admin` -> `apps/admin/lib`
- `apps/backend/src/modules` -> `apps/backend/src/common`
- `apps/backend/src/modules` -> `apps/backend/src`
- `apps/backend/src` -> `apps/backend/src/common`
- `apps/backend/src` -> `apps/backend/src`
- `apps/pro/app/demandes` -> `apps/pro/components`
- `apps/pro/app/demandes` -> `apps/pro/lib`
- `apps/pro/app/interventions` -> `apps/pro/components`
- `apps/pro/app/interventions` -> `apps/pro/lib`
- `apps/pro/app/profil` -> `apps/pro/components`
- `apps/pro/app/profil` -> `apps/pro/lib`
- `apps/pro/app` -> `apps/pro/components`
- `apps/pro/app` -> `apps/pro/lib`
- `apps/pro` -> `apps/pro/components`
- `apps/pro` -> `apps/pro/lib`
- `apps/web/app/actualites` -> `apps/web/components`
- `apps/web/app/actualites` -> `apps/web/lib`
- `apps/web/app/catalogue` -> `apps/web/components`
- `apps/web/app/catalogue` -> `apps/web/lib`
- `apps/web/app/compte/demandes` -> `apps/web/components`
- `apps/web/app/compte/demandes` -> `apps/web/lib`
- `apps/web/app/compte/interventions` -> `apps/web/components`
- `apps/web/app/compte/interventions` -> `apps/web/lib`
- `apps/web/app/compte` -> `apps/web/components`
- `apps/web/app/compte` -> `apps/web/lib`
- `apps/web/app/entreprises` -> `apps/web/components`
- `apps/web/app/entreprises` -> `apps/web/lib`
- `apps/web/app/marketplace` -> `apps/web/components`
- `apps/web/app/marketplace` -> `apps/web/lib`
- `apps/web/app/professionnels` -> `apps/web/components`
- `apps/web/app/professionnels` -> `apps/web/lib`
- `apps/web/app/services` -> `apps/web/components`
- `apps/web/app/services` -> `apps/web/lib`
- `apps/web/app` -> `apps/web/components`
- `apps/web/app` -> `apps/web/lib`
- `apps/web` -> `apps/web/components`
- `apps/web` -> `apps/web/lib`

## Critical Modules

| Module | Fan-In | Fan-Out | Criticality |
|--------|--------|---------|-------------|
| `apps/admin/app/(panel)` | 0 | 36 | high |
| `apps/web/components` | 30 | 0 | high |
| `apps/web/lib` | 30 | 0 | high |
| `apps/web/app` | 0 | 25 | high |
| `apps/admin/lib` | 23 | 0 | high |
| `apps/admin/components` | 21 | 0 | high |
| `apps/backend/src` | 14 | 6 | high |
| `apps/pro/components` | 16 | 0 | high |
| `apps/pro/lib` | 15 | 0 | high |
| `apps/pro/app` | 0 | 14 | high |

---

*Generated at 2026-11-14T22:01:33Z in 2.565405303s. 3575 facts, 91 insights.*
