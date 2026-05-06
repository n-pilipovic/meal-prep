# External Setup

End-to-end setup of every external service the app depends on. Follow in order — later sections assume earlier ones are done.

| # | Service | Purpose | Free tier sufficient? |
|---|---------|---------|-----------------------|
| 1 | Firebase Authentication | Email + Google sign-in, JWT verification by the worker | Yes |
| 2 | Cloudflare Workers + KV | API backend, push notifications, AI proxy, feedback handler | Yes |
| 3 | Web Push (VAPID) | Push notification authentication | n/a (self-hosted keys) |
| 4 | Google Gemini API | AI meal-plan generator (primary) | Yes |
| 5 | Groq API | AI meal-plan generator (fallback) | Yes |
| 6 | GitHub Pages | Hosts the Angular app | Yes |
| 7 | GitHub repo `n-pilipovic/meal-prep` | Issues for user feedback + Release-asset storage for screenshot attachments | Yes |
| 8 | GitHub webhook | Pushes issue status changes back to the worker | Yes |

---

## 1. Firebase Authentication

### Console setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/). Project ID is referenced as `FIREBASE_PROJECT_ID` (current value: `meal-prep-37753`).
2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorized domains**: add `localhost`, `n-pilipovic.github.io`, and any preview domains you use.
4. **Project settings → Your apps → Web app**: register a web app and copy the SDK config object.

### Wire to Angular

Paste the SDK config into `src/environments/environment.ts` and `environment.prod.ts` under the `firebase` key. The `apiKey` here is *not* a secret — it's a public Firebase identifier and is safe to commit.

### Wire to the worker

```bash
# In wrangler.toml under [vars]
FIREBASE_PROJECT_ID = "your-project-id"
```

The worker uses [`firebase-auth-cloudflare-workers`](https://github.com/Code-Hex/firebase-auth-cloudflare-workers) to verify ID tokens. Public JWKs are cached in KV under `firebase-public-jwk-cache` — no extra setup beyond the project ID.

---

## 2. Cloudflare Workers + KV

### One-time auth

```bash
cd cf-worker
npm ci
npx wrangler login
```

### Create the KV namespace

```bash
npx wrangler kv namespace create KV
npx wrangler kv namespace create KV --preview
```

Copy the `id` and `preview_id` into [cf-worker/wrangler.toml](../cf-worker/wrangler.toml) under `[[kv_namespaces]]`.

### Required secrets

Set each via `npx wrangler secret put NAME` (you'll be prompted for the value):

| Secret | Source | Required for |
|--------|--------|--------------|
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` | Push notifications |
| `VAPID_PRIVATE_KEY` | same command | Push notifications |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | AI meal-plan generator |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) | AI meal-plan generator (fallback) |
| `GITHUB_TOKEN` | see §7 | User feedback |
| `GITHUB_ASSETS_RELEASE_ID` | see §7 (numeric ID, store as a secret) | User feedback attachments |
| `GITHUB_WEBHOOK_SECRET` | a random string you generate | User feedback (webhook verification) |

`VAPID_SUBJECT`, `FIREBASE_PROJECT_ID`, and `GITHUB_REPO` are non-secret `[vars]` already in `wrangler.toml`. Update them as needed.

### Deploy

```bash
npm run deploy
```

After the first deploy, copy the worker's URL (e.g. `https://meal-prep-api.<account>.workers.dev`) into `src/environments/environment.prod.ts` under `apiUrl`.

### CI/CD for the worker

Add the GitHub repo secret `CLOUDFLARE_API_TOKEN` (Settings → Secrets → Actions). The token needs `Edit Cloudflare Workers` permission. CI deploys the worker on every push to `main` via `.github/workflows/deploy.yml`.

---

## 3. Web Push (VAPID keys)

```bash
npx web-push generate-vapid-keys
```

- Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as worker secrets (see §2).
- Paste the **public** key into both `src/environments/environment.ts` and `environment.prod.ts` under `vapidPublicKey`. The browser uses this key when subscribing to push.
- `VAPID_SUBJECT` (in `wrangler.toml [vars]`) must be a valid `mailto:` URI for your contact email — push services drop notifications without it.

---

## 4. Google Gemini API (primary AI)

1. Get an API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. `npx wrangler secret put GEMINI_API_KEY`.

The worker uses `gemini-2.5-flash` for meal plan generation in [cf-worker/src/gemini.ts](../cf-worker/src/gemini.ts).

---

## 5. Groq API (fallback AI)

1. Get an API key from [console.groq.com/keys](https://console.groq.com/keys).
2. `npx wrangler secret put GROQ_API_KEY`.

The worker falls back to `llama-3.3-70b-versatile` if Gemini fails ([cf-worker/src/groq.ts](../cf-worker/src/groq.ts)).

---

## 6. GitHub Pages (Angular hosting)

1. Repo Settings → Pages → Source: **GitHub Actions**.
2. Verify the deployment workflow is enabled at `.github/workflows/deploy.yml`.
3. The base href is `/meal-prep/`; SPA routing is handled by `public/404.html`.

The site URL is `https://n-pilipovic.github.io/meal-prep/`. If you fork this project, change the base href in `angular.json` and the SPA fallback to match your repo slug.

---

## 7. GitHub Issues + Release-asset storage (User Feedback)

The "Povratna informacija" feature posts user-submitted issues directly into the **public** repo `n-pilipovic/meal-prep` and stores image attachments as **GitHub Release assets** under a fixed tag `feedback-assets`. No external object storage is needed.

### 7a. Create a fine-grained Personal Access Token

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → **Generate new token**.
2. **Repository access**: only `n-pilipovic/meal-prep`.
3. **Repository permissions**:
   - **Issues**: Read and write
   - **Contents**: Read and write *(Releases write is bundled under Contents)*
   - Everything else: leave at *No access*.
4. Expiration: 1 year is reasonable; rotate annually.
5. Copy the token (starts with `github_pat_…`).
6. `npx wrangler secret put GITHUB_TOKEN` and paste it in.

### 7b. Create the assets release (one-time)

The release is a long-lived "drawer" we upload screenshots into. It is *not* a real release — mark it as pre-release so it stays out of the user-facing release list.

```bash
gh release create feedback-assets \
  --repo n-pilipovic/meal-prep \
  --title "Feedback attachments" \
  --notes "Auto-managed by the worker — do not edit." \
  --prerelease
```

Then look up the numeric release id:

```bash
gh release view feedback-assets --repo n-pilipovic/meal-prep --json id,databaseId
```

Use `databaseId` (a number, e.g. `158291234`). Store it as a worker secret:

```bash
npx wrangler secret put GITHUB_ASSETS_RELEASE_ID
```

> If `GITHUB_REPO` is ever changed in `wrangler.toml`, recreate the release in the new repo and update the secret.

### 7c. Set the webhook secret

```bash
# Pick a strong random string (32+ chars)
openssl rand -base64 32 | tr -d '\n'
npx wrangler secret put GITHUB_WEBHOOK_SECRET
```

You'll paste this same value into the webhook UI in §8.

### Verifying the wiring

Once secrets are in place and the worker is deployed, sending an issue from the app should:

1. Upload each compressed image to `https://github.com/n-pilipovic/meal-prep/releases/download/feedback-assets/<uuid>.jpg`.
2. Open a new GitHub issue titled `[bug|suggestion|question] <title>` with the images embedded as markdown.
3. Apply labels `user-report` + (`bug` | `enhancement` | `question`).
4. Show up in *Settings → Moje prijave* in the app.

If the worker returns `503 Issues not configured`, one of the four GitHub-related secrets is missing.

---

## 8. GitHub Webhook (issue status → push notifications)

The worker maps GitHub events back to in-app push notifications so reporters know when their issue is closed, reopened, labeled `in-progress`, or commented on.

### Configure the webhook

1. Repo Settings → **Webhooks** → **Add webhook**.
2. **Payload URL**: `https://<your-worker-host>/api/github-webhook` (the same `apiUrl` used by the app).
3. **Content type**: `application/json`.
4. **Secret**: paste the same value you set as `GITHUB_WEBHOOK_SECRET` (§7c).
5. **SSL verification**: Enable SSL verification.
6. **Which events?** → *Let me select individual events*:
   - **Issues**
   - **Issue comments**
   - Untick everything else.
7. **Active**: checked.
8. Save.

GitHub will send a `ping` event immediately. If the webhook page shows a green check, signature verification is working.

### How it maps to push notifications

| GitHub event | App-side state | Push notification |
|--------------|----------------|-------------------|
| Issue closed (default) | `resolved` | "Tvoja prijava #N — Status: Rešeno" |
| Issue closed (`not_planned`) | `rejected` | "Status: Odbačeno" |
| Issue reopened | `open` | "Status: Otvoreno" |
| Label `in-progress` added | `in_progress` | "Status: U obradi" |
| Comment by repo owner/member | (status unchanged) | "Razvijač je odgovorio na #N" + first 80 chars |

Push delivery requires the user to have:
- Subscribed to push (toggled on in Settings → Obaveštenja).
- The `issueUpdates` notification preference enabled (default on).
- A live `subscription:{userId}` key in KV.

### Manual triage labels

The worker recognizes the label `in-progress` to map to the *U obradi* state. Add it to the repo:

```bash
gh label create in-progress --color FFA500 --description "Worker maps to 'U obradi' badge" --repo n-pilipovic/meal-prep
```

Closing an issue with reason **Not planned** (via the GitHub UI's close dropdown) maps to *Odbačeno*; closing as **Completed** maps to *Rešeno*.

---

## Summary: secrets & vars checklist

```
# wrangler.toml [vars]
VAPID_SUBJECT       = "mailto:..."
FIREBASE_PROJECT_ID = "meal-prep-37753"
GITHUB_REPO         = "n-pilipovic/meal-prep"

# wrangler secrets (set via `wrangler secret put`)
VAPID_PUBLIC_KEY              # web-push generate-vapid-keys
VAPID_PRIVATE_KEY             # web-push generate-vapid-keys
GEMINI_API_KEY                # aistudio.google.com/apikey
GROQ_API_KEY                  # console.groq.com/keys
GITHUB_TOKEN                  # fine-grained PAT, Issues:write + Contents:write
GITHUB_ASSETS_RELEASE_ID      # numeric id of the feedback-assets release
GITHUB_WEBHOOK_SECRET         # 32+ char random; same value pasted into GitHub webhook config

# GitHub repo secrets (Settings → Secrets → Actions)
CLOUDFLARE_API_TOKEN          # for CI worker deploy

# src/environments/environment(.prod).ts
apiUrl                        # the deployed worker URL
vapidPublicKey                # same as VAPID_PUBLIC_KEY
firebase.*                    # Firebase web app SDK config (public, safe to commit)
```
