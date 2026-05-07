# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-user meal preparation PWA built from a Serbian nutritionist's weekly meal plan (Ivana.docx). Each household member has their own meal plan; shopping lists and prep checklists are shared and divisible between users.

## Commands

```bash
# Angular app (from repo root)
npx ng serve                    # Dev server at localhost:4200
npx ng build                    # Production build to dist/meal-preparation/
npx ng test --watch=false       # Run unit tests (Vitest)
npx playwright test             # Run E2E tests (needs ng serve running)

# Cloudflare Worker (from cf-worker/)
cd cf-worker && npm run dev     # Local worker dev server
cd cf-worker && npm run deploy  # Deploy to Cloudflare

# Deployment
npm run deploy                  # Deploy Angular app to GitHub Pages
```

## Deployment

### GitHub Pages (Angular app)

- CI/CD via `.github/workflows/deploy.yml` — builds, tests, and deploys on push to `main`
- Uses `actions/deploy-pages@v4` with GitHub Pages environment
- SPA routing: `public/404.html` redirects all paths to `index.html`
- Base href: `/meal-preparation/`

### Cloudflare Worker

```bash
cd cf-worker
npm ci
npx wrangler login                          # One-time auth
npx wrangler kv namespace create KV         # Create KV namespace
# Update wrangler.toml with the namespace ID
npx web-push generate-vapid-keys            # Generate VAPID keys
npx wrangler secret put VAPID_PUBLIC_KEY    # Set as secret
npx wrangler secret put VAPID_PRIVATE_KEY   # Set as secret
npm run deploy                              # Deploy worker
```

After deploying, update `src/environments/environment.prod.ts` with the worker URL.

## External setup

For step-by-step setup of GitHub, Cloudflare, Firebase, AI providers, and the feedback feature, see [docs/EXTERNAL_SETUP.md](docs/EXTERNAL_SETUP.md). The README's *Deployment* section is the short-form summary.

## Architecture

### Angular App (`src/app/`)

- **Angular v21** with standalone components, signals, and `FormsModule` (template-driven `ngModel` bound to signals — Signal Forms is *not* used)
- **TailwindCSS v4** with CSS-based config (no tailwind.config.js), PostCSS via `.postcssrc.json`
- Custom theme tokens in `src/styles.css` under `@theme` (cream, green-primary, orange-primary palette)
- Routing uses `withComponentInputBinding()` — route params bind directly to component `input()` signals
- `MealDataService` loads meal plan from localStorage first, falls back to `assets/data/weekly-plan.json`
- All state management via Angular signals (no NgRx)
- `auth.interceptor.ts` attaches the Firebase ID token as `Bearer` to every call to `environment.apiUrl`

### Cloudflare Worker (`cf-worker/`)

- Lightweight API for households, push notifications, AI plan generation, and user feedback
- KV namespace keys: `household:{code}`, `user-household:{uid}`, `plan:{userId}`, `subscription:{userId}`, `notif-prefs:{userId}`, `shared:{householdCode}`, `issue:{number}`, `userIssues:{userId}`, `householdIssues:{householdCode}`, `ratelimit:issues:{householdCode}`, `firebase-public-jwk-cache`
- Firebase JWT verification via `firebase-auth-cloudflare-workers`; `getFirebaseUid(request, env)` returns the verified UID or null
- 6 cron triggers for meal push notifications (daily summary 07:00 UTC, per-meal reminders 30 min before each meal)
- GitHub webhook (`POST /api/github-webhook`) verifies `X-Hub-Signature-256` HMAC and dispatches push notifications to the original reporter when an issue's status changes, the developer comments, or a household member comments. User-posted comments are tagged with an HTML-comment marker `<!-- mp:user-comment authorId="..." authorName="..." -->` so the webhook can attribute them and suppress self-notifications
- CORS enabled for GitHub Pages origin

### Data Flow

- Meal plan source: `Ivana.docx` → transcribed into `src/assets/data/weekly-plan.json`
- Per-user plans stored in Cloudflare KV, synced via `ApiService`
- Shared state (shopping checks, prep assignments) synced to KV
- User feedback: `IssueReportService` → multipart POST → worker uploads each image to GitHub Releases asset storage (tag `feedback-assets`) → opens an issue with the embedded URLs. Comment composer on the detail page posts via `POST /api/issues/:n/comments` with the same auth + same-household check

### Key Models (`src/app/core/models/`)

- `meal.model.ts`: `WeeklyPlan > DayPlan > Meal > Ingredient`, plus `Recipe`, `MealType` enum, `DAY_NAMES`
- `user.model.ts`: `Household`, `UserProfile`, `SharedState`, `PrepAssignments` (3-level: byUserPlan > byMeal > byItem), `NotificationPreferences` (incl. optional `issueUpdates`)
- `issue.model.ts`: `IssueType`, `IssueState`, `IssueRecord`, `IssueDetail`, `IssueAttachment`, plus Serbian label maps

### Feature Modules (`src/app/features/`)

Each feature is a lazy-loaded standalone component:

- `daily-view/` — main home view with meal cards + day navigation
- `meal-detail/` — full ingredient list + recipe instructions
- `weekly-view/` — 7-day overview grid
- `shopping-list/` — aggregated ingredients across all users, assignable
- `prep-checklist/` — daily prep with progress bar, divisible
- `settings/` — notifications, household, editor access, feedback entry
- `editor/` — meal plan editor with .docx/.odt import, AI generator, and user assignment
- `report-issue/` — unified feedback form (bug/suggestion/question) with image attachments
- `my-issues/` — tabbed list (mine / household suggestions) + detail view with developer + household-member comments and a composer to reply

## Conventions

- All UI text is in **Serbian** (Latin script)
- Meal types: `dorucak` (breakfast 9h), `uzina` (snack 11h), `rucak` (lunch 14h), `vecera` (dinner 18h)
- Mobile-first design: 375-430px primary target, safe area insets for iOS
- Minimum 44x44px touch targets
- Division default: each user prepares their own plan; override priority: byItem > byMeal > byUserPlan

## Each code change

- run unit and e2e tests after any code change.
