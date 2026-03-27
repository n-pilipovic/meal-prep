# Priprema Obroka

Multi-user meal preparation PWA for planning weekly meals, sharing shopping lists, and dividing prep tasks between household members. Built from a Serbian nutritionist's weekly meal plan.

**Live:** [n-pilipovic.github.io/meal-prep](https://n-pilipovic.github.io/meal-prep/)

## Features

- **Daily & weekly views** — 4 meals/day (breakfast 9h, snack 11h, lunch 14h, dinner 18h) with ingredient lists and recipes
- **Multi-user households** — create or join with a 6-character invite code, each member has their own meal plan
- **Shared shopping list** — aggregated ingredients across all users, assignable per person, checkable with real-time sync
- **Prep checklist** — daily preparation divided between users at 3 levels (by plan, by meal, by item)
- **Meal plan editor** — edit meals/ingredients/recipes, import from .docx, assign imported plans to specific users
- **Push notifications** — daily summary + per-meal reminders 30 min before (via Cloudflare Workers cron)
- **PWA** — installable on iOS (Add to Home Screen) and Android/Chrome, works offline
- **iOS install guide** — step-by-step overlay on first visit in Safari

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular v21 (standalone components, signals) |
| Styling | TailwindCSS v4 (CSS-based config) |
| Backend | Cloudflare Workers + KV |
| Push | Web Push API with VAPID (native Web Crypto, no npm deps) |
| PWA | @angular/pwa (service worker, manifest) |
| Tests | Vitest (unit), Playwright (E2E — iPhone 14, iPhone 13 Mini, desktop) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

## Development

```bash
npm install
npx ng serve                    # Dev server at localhost:4200
npx ng test --watch=false       # Unit tests (98 tests)
npx playwright test             # E2E tests (243 tests across 3 devices)
```

### Cloudflare Worker

```bash
cd cf-worker
npm install
npm run dev                     # Local worker at localhost:8787
npm run deploy                  # Deploy to Cloudflare
```

## Project Structure

```
src/app/
  core/
    models/          # WeeklyPlan, Household, SharedState, MealType
    services/        # MealData, Household, Api, Sync, ShoppingList, Notification
    guards/          # Onboarding guard
  features/
    onboarding/      # Create/join household
    daily-view/      # Home — meal cards + day navigation
    meal-detail/     # Ingredients + recipe instructions
    weekly-view/     # 7-day overview grid
    shopping-list/   # Aggregated ingredients, assignable, filterable
    prep-checklist/  # Daily prep with 3-level division
    editor/          # Meal plan editor + .docx import
    settings/        # Notifications, household, PWA install
  shared/
    components/      # BottomNav, DayNavigator, UserAvatar, IoS install prompt
    pipes/           # Quantity formatting

cf-worker/           # Cloudflare Worker (API + push notifications)
  src/
    index.ts         # Routes + cron handler
    push.ts          # Notification scheduling
    web-push.ts      # VAPID/Web Push implementation
    kv-helpers.ts    # KV read/write utilities
```

## Multi-User Architecture

```
Household "ABC123"
  ├── Ivana  → weekly plan (seed plan auto-assigned)
  ├── Novica → weekly plan
  ├── Shared Shopping List (combined from all plans)
  └── Shared Prep Checklist (divisible: byItem > byMeal > byUserPlan)
```

All data stored in Cloudflare KV. No database needed.

## Deployment

### GitHub Pages

Automatic via GitHub Actions on push to `main` — builds, runs unit tests, and deploys.

### Cloudflare Worker

```bash
cd cf-worker
npx wrangler login
npx wrangler kv namespace create KV        # Update wrangler.toml with ID
npx web-push generate-vapid-keys
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npm run deploy
```

Update `src/environments/environment.prod.ts` with the worker URL after deploying.

## Language

All UI text is in **Serbian** (Latin script). Meal types: doručak, užina, ručak, večera.
