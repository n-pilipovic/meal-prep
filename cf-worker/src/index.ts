import { getJSON, putJSON, type KVNamespace } from './kv-helpers';
import { sendScheduledPush } from './push';
import { generateMealPlanGroq } from './groq';
import { generateMealPlanGemini } from './gemini';
import {
  ATTACHMENT_LIMITS,
  createIssueFlow,
  getIssueDetail,
  handleWebhook,
  listHouseholdSuggestions,
  listMyIssues,
  postUserComment,
  refreshIssueStateFromGithub,
  sniffMime,
  toggleUpvote,
  verifyWebhookSignature,
  type IssueType,
  type IssuesEnv,
} from './issues';
import { Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers';

interface Env {
  KV: KVNamespace;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY?: string;
  FIREBASE_PROJECT_ID: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_ASSETS_RELEASE_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
}

function issuesEnv(env: Env): IssuesEnv | null {
  if (
    !env.GITHUB_TOKEN ||
    !env.GITHUB_REPO ||
    !env.GITHUB_ASSETS_RELEASE_ID ||
    !env.GITHUB_WEBHOOK_SECRET
  )
    return null;
  return {
    KV: env.KV,
    GITHUB_TOKEN: env.GITHUB_TOKEN,
    GITHUB_REPO: env.GITHUB_REPO,
    GITHUB_ASSETS_RELEASE_ID: env.GITHUB_ASSETS_RELEASE_ID,
    GITHUB_WEBHOOK_SECRET: env.GITHUB_WEBHOOK_SECRET,
    VAPID_SUBJECT: env.VAPID_SUBJECT,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
  };
}

interface Household {
  code: string;
  members: { id: string; name: string; avatar?: string; color: string }[];
  createdAt: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const USER_COLORS = ['#2d6a4f', '#e76f51', '#264653', '#e9c46a', '#6a4c93'];

async function getFirebaseUid(request: Request, env: Env): Promise<string | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const jwt = authorization.slice(7);

  try {
    const auth = Auth.getOrInitialize(
      env.FIREBASE_PROJECT_ID,
      WorkersKVStoreSingle.getOrInitialize('firebase-public-jwk-cache', env.KV as any),
    );
    const token = await auth.verifyIdToken(jwt);
    return token.uid;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // POST /api/household — create household (requires auth)
    if (request.method === 'POST' && path === '/api/household') {
      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const { name, avatar } = (await request.json()) as { name: string; avatar?: string };
      const code = generateCode();
      const member: Household['members'][0] = { id: uid, name, color: USER_COLORS[0] };
      if (avatar) member.avatar = avatar;
      const household: Household = {
        code,
        members: [member],
        createdAt: new Date().toISOString(),
      };
      await putJSON(env.KV, `household:${code}`, household);
      await env.KV.put(`user-household:${uid}`, code);
      return json({ code, userId: uid, household });
    }

    // POST /api/household/:code/join — join household (requires auth)
    const joinMatch = path.match(/^\/api\/household\/([A-Z0-9]+)\/join$/);
    if (request.method === 'POST' && joinMatch) {
      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const code = joinMatch[1];
      const { name, avatar } = (await request.json()) as { name: string; avatar?: string };
      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);

      // Prevent duplicate joins
      if (!household.members.some(m => m.id === uid)) {
        const colorIndex = household.members.length % USER_COLORS.length;
        const member: Household['members'][0] = { id: uid, name, color: USER_COLORS[colorIndex] };
        if (avatar) member.avatar = avatar;
        household.members.push(member);
        await putJSON(env.KV, `household:${code}`, household);
      }
      await env.KV.put(`user-household:${uid}`, code);
      return json({ userId: uid, household });
    }

    // GET /api/me/household — resolve current user's household from Firebase UID
    if (request.method === 'GET' && path === '/api/me/household') {
      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const code = await env.KV.get(`user-household:${uid}`);
      if (!code) return json({ error: 'No household' }, 404);

      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);

      return json(household);
    }

    // PUT /api/me/profile — update current user's profile (avatar) in their household
    if (request.method === 'PUT' && path === '/api/me/profile') {
      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const code = await env.KV.get(`user-household:${uid}`);
      if (!code) return json({ error: 'No household' }, 404);

      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);

      const { avatar } = (await request.json()) as { avatar?: string };
      const member = household.members.find(m => m.id === uid);
      if (!member) return json({ error: 'Member not found' }, 404);

      if (avatar) {
        member.avatar = avatar;
      } else {
        delete member.avatar;
      }
      await putJSON(env.KV, `household:${code}`, household);
      return json({ ok: true, household });
    }

    // GET /api/household/:code — get household info
    const householdMatch = path.match(/^\/api\/household\/([A-Z0-9]+)$/);
    if (request.method === 'GET' && householdMatch) {
      const code = householdMatch[1];
      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);
      return json(household);
    }

    // PUT /api/user/:id/plan — save meal plan
    const planPutMatch = path.match(/^\/api\/user\/([^/]+)\/plan$/);
    if (request.method === 'PUT' && planPutMatch) {
      const userId = planPutMatch[1];
      const plan = await request.json();
      await putJSON(env.KV, `plan:${userId}`, plan);
      return json({ ok: true });
    }

    // GET /api/household/:code/plans — get all plans
    const plansMatch = path.match(/^\/api\/household\/([A-Z0-9]+)\/plans$/);
    if (request.method === 'GET' && plansMatch) {
      const code = plansMatch[1];
      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);

      const plans: Record<string, unknown> = {};
      for (const member of household.members) {
        const plan = await getJSON(env.KV, `plan:${member.id}`);
        if (plan) plans[member.id] = plan;
      }
      return json(plans);
    }

    // POST/DELETE /api/user/:id/subscription — save or remove push subscription
    const subMatch = path.match(/^\/api\/user\/([^/]+)\/subscription$/);
    if (request.method === 'POST' && subMatch) {
      const userId = subMatch[1];
      const subscription = await request.json();
      await putJSON(env.KV, `subscription:${userId}`, subscription);
      return json({ ok: true });
    }
    if (request.method === 'DELETE' && subMatch) {
      const userId = subMatch[1];
      await env.KV.delete(`subscription:${userId}`);
      return json({ ok: true });
    }

    // PUT /api/user/:id/notification-prefs — save notification preferences
    const notifPrefsMatch = path.match(/^\/api\/user\/([^/]+)\/notification-prefs$/);
    if (request.method === 'PUT' && notifPrefsMatch) {
      const userId = notifPrefsMatch[1];
      const prefs = await request.json();
      await putJSON(env.KV, `notif-prefs:${userId}`, prefs);
      return json({ ok: true });
    }

    // GET /api/household/:code/shared — get shared state
    const sharedGetMatch = path.match(/^\/api\/household\/([A-Z0-9]+)\/shared$/);
    if (request.method === 'GET' && sharedGetMatch) {
      const code = sharedGetMatch[1];
      const shared = await getJSON(env.KV, `shared:${code}`);
      return json(shared ?? {
        shoppingChecked: {},
        shoppingAssignments: {},
        prepChecked: {},
        prepAssignments: { byUserPlan: {}, byMeal: {}, byItem: {} },
      });
    }

    // PUT /api/household/:code/shared — update shared state
    const sharedPutMatch = path.match(/^\/api\/household\/([A-Z0-9]+)\/shared$/);
    if (request.method === 'PUT' && sharedPutMatch) {
      const code = sharedPutMatch[1];
      const shared = await request.json();
      await putJSON(env.KV, `shared:${code}`, shared);
      return json({ ok: true });
    }

    // POST /api/generate-plan — AI meal plan generation (Gemini primary, Groq fallback)
    if (request.method === 'POST' && path === '/api/generate-plan') {
      const prefs = await request.json();

      // Try Gemini first
      if (env.GEMINI_API_KEY) {
        try {
          const plan = await generateMealPlanGemini(env.GEMINI_API_KEY, prefs as any);
          return json(plan);
        } catch (err: any) {
          console.error('Gemini failed, falling back to Groq:', err.message);
        }
      }

      // Fallback to Groq
      if (env.GROQ_API_KEY) {
        try {
          const plan = await generateMealPlanGroq(env.GROQ_API_KEY, prefs as any);
          return json(plan);
        } catch (err: any) {
          return json({ error: err.message ?? 'Failed to generate plan' }, 500);
        }
      }

      return json({ error: 'No AI provider configured' }, 500);
    }

    // POST /api/issues — submit a new issue (multipart/form-data)
    if (request.method === 'POST' && path === '/api/issues') {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const householdCode = await env.KV.get(`user-household:${uid}`);
      if (!householdCode) return json({ error: 'No household' }, 404);

      const household = await getJSON<Household>(env.KV, `household:${householdCode}`);
      if (!household) return json({ error: 'Household not found' }, 404);
      const author = household.members.find((m) => m.id === uid);
      if (!author) return json({ error: 'Member not found' }, 404);

      const form = await request.formData();
      const type = form.get('type') as IssueType | null;
      const title = (form.get('title') as string | null)?.trim() ?? '';
      const description = (form.get('description') as string | null)?.trim() ?? '';
      const contextRaw = (form.get('context') as string | null) ?? '{}';

      if (!type || !['bug', 'suggestion', 'question'].includes(type)) {
        return json({ error: 'Neispravan tip' }, 400);
      }
      if (!title || title.length > 100) {
        return json({ error: 'Naslov je obavezan i mora imati do 100 karaktera.' }, 400);
      }
      if (!description || description.length > 4000) {
        return json({ error: 'Opis je obavezan i mora imati do 4000 karaktera.' }, 400);
      }

      let context: Record<string, string> = {};
      try {
        context = JSON.parse(contextRaw);
      } catch {
        context = {};
      }

      // workers-types declares getAll as string[] but the runtime returns File for file parts
      const rawEntries = (form.getAll('attachments') as unknown as Array<File | string>).filter(
        (v): v is File => typeof v !== 'string',
      );
      if (rawEntries.length > ATTACHMENT_LIMITS.MAX_ATTACHMENTS) {
        return json({ error: `Najviše ${ATTACHMENT_LIMITS.MAX_ATTACHMENTS} priloga.` }, 400);
      }
      const attachments: { bytes: Uint8Array; mime: string }[] = [];
      for (const file of rawEntries) {
        if (file.size > ATTACHMENT_LIMITS.MAX_ATTACHMENT_SIZE) {
          return json({ error: 'Prilog je prevelik (>5 MB).' }, 400);
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        const mime = sniffMime(buf);
        if (!mime || !ATTACHMENT_LIMITS.ALLOWED_MIME.has(mime)) {
          return json({ error: 'Dozvoljeni formati: JPEG, PNG, WebP.' }, 400);
        }
        attachments.push({ bytes: buf, mime });
      }

      try {
        const result = await createIssueFlow(issuesCfg, {
          type,
          title,
          description,
          attachments,
          context,
          authorUserId: uid,
          authorName: author.name,
          householdCode,
        });
        return json(result);
      } catch (err: any) {
        return json({ error: err.message ?? 'Slanje nije uspelo.' }, 400);
      }
    }

    // GET /api/me/issues — list current user's issues
    if (request.method === 'GET' && path === '/api/me/issues') {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const householdCode = await env.KV.get(`user-household:${uid}`);
      if (!householdCode) return json([]);

      const list = await listMyIssues(issuesCfg, uid, householdCode);
      return json(list);
    }

    // GET /api/household/:code/suggestions — list household enhancement issues
    const householdSuggMatch = path.match(/^\/api\/household\/([A-Z0-9]+)\/suggestions$/);
    if (request.method === 'GET' && householdSuggMatch) {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const code = householdSuggMatch[1];
      const myCode = await env.KV.get(`user-household:${uid}`);
      if (myCode !== code) return json({ error: 'Forbidden' }, 403);

      const list = await listHouseholdSuggestions(issuesCfg, code, uid);
      return json(list);
    }

    // GET /api/issues/:n — issue detail (refreshes status from GitHub)
    const issueDetailMatch = path.match(/^\/api\/issues\/(\d+)$/);
    if (request.method === 'GET' && issueDetailMatch) {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const code = await env.KV.get(`user-household:${uid}`);
      if (!code) return json({ error: 'No household' }, 404);

      const number = Number(issueDetailMatch[1]);
      await refreshIssueStateFromGithub(issuesCfg, number);
      const detail = await getIssueDetail(issuesCfg, number, uid, code);
      if (!detail) return json({ error: 'Not found' }, 404);
      return json(detail);
    }

    // POST /api/issues/:n/comments — household member posts a comment
    const commentMatch = path.match(/^\/api\/issues\/(\d+)\/comments$/);
    if (request.method === 'POST' && commentMatch) {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const code = await env.KV.get(`user-household:${uid}`);
      if (!code) return json({ error: 'No household' }, 404);

      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);
      const author = household.members.find((m) => m.id === uid);
      if (!author) return json({ error: 'Member not found' }, 404);

      const { body } = (await request.json()) as { body?: string };
      const trimmed = (body ?? '').trim();
      if (!trimmed) return json({ error: 'Komentar je obavezan.' }, 400);
      if (trimmed.length > 2000)
        return json({ error: 'Komentar može imati do 2000 karaktera.' }, 400);

      const number = Number(commentMatch[1]);
      const result = await postUserComment(issuesCfg, number, uid, author.name, code, trimmed);
      if (!result.ok) return json({ error: result.reason }, result.status);
      return json({ ok: true });
    }

    // POST /api/issues/:n/upvote — toggle upvote on a suggestion
    const upvoteMatch = path.match(/^\/api\/issues\/(\d+)\/upvote$/);
    if (request.method === 'POST' && upvoteMatch) {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const uid = await getFirebaseUid(request, env);
      if (!uid) return json({ error: 'Unauthorized' }, 401);

      const number = Number(upvoteMatch[1]);
      const result = await toggleUpvote(issuesCfg, number, uid);
      if (!result) return json({ error: 'Not found' }, 404);
      return json(result);
    }

    // POST /api/github-webhook — GitHub webhook entrypoint (HMAC-verified)
    if (request.method === 'POST' && path === '/api/github-webhook') {
      const issuesCfg = issuesEnv(env);
      if (!issuesCfg) return json({ error: 'Issues not configured' }, 503);

      const event = request.headers.get('X-GitHub-Event');
      const signature = request.headers.get('X-Hub-Signature-256');
      const rawBody = await request.text();
      const valid = await verifyWebhookSignature(
        issuesCfg.GITHUB_WEBHOOK_SECRET,
        signature,
        rawBody,
      );
      if (!valid) return json({ error: 'Invalid signature' }, 401);

      try {
        const payload = JSON.parse(rawBody);
        if (event === 'issues' || event === 'issue_comment') {
          await handleWebhook(issuesCfg, event, payload);
        }
        return json({ ok: true });
      } catch (err: any) {
        return json({ error: err.message ?? 'Webhook error' }, 400);
      }
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();
    const minute = new Date(event.scheduledTime).getUTCMinutes();

    let cronType: 'daily' | 'dorucak' | 'uzina' | 'rucak' | 'uzina2' | 'vecera';
    if (hour === 7 && minute === 0) cronType = 'daily';
    else if (hour === 8 && minute === 30) cronType = 'dorucak';
    else if (hour === 10 && minute === 30) cronType = 'uzina';
    else if (hour === 13 && minute === 30) cronType = 'rucak';
    else if (hour === 15 && minute === 30) cronType = 'uzina2';
    else if (hour === 17 && minute === 30) cronType = 'vecera';
    else return;

    await sendScheduledPush(env.KV, cronType, {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    });
  },
};
