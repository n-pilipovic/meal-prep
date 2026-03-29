import { getJSON, putJSON, type KVNamespace } from './kv-helpers';
import { sendScheduledPush } from './push';
import { generateMealPlanGroq } from './groq';
import { generateMealPlanGemini } from './gemini';

interface Env {
  KV: KVNamespace;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY?: string;
}

interface Household {
  code: string;
  members: { id: string; name: string; avatar?: string; color: string }[];
  createdAt: string;
}

// In production, restrict to your GitHub Pages domain:
// 'Access-Control-Allow-Origin': 'https://YOUR_USERNAME.github.io'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

function generateId(): string {
  return crypto.randomUUID();
}

const USER_COLORS = ['#2d6a4f', '#e76f51', '#264653', '#e9c46a', '#6a4c93'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // POST /api/household — create household
    if (request.method === 'POST' && path === '/api/household') {
      const { name } = (await request.json()) as { name: string };
      const code = generateCode();
      const userId = generateId();
      const household: Household = {
        code,
        members: [{ id: userId, name, color: USER_COLORS[0] }],
        createdAt: new Date().toISOString(),
      };
      await putJSON(env.KV, `household:${code}`, household);
      return json({ code, userId, household });
    }

    // POST /api/household/:code/join — join household
    const joinMatch = path.match(/^\/api\/household\/([A-Z0-9]+)\/join$/);
    if (request.method === 'POST' && joinMatch) {
      const code = joinMatch[1];
      const { name } = (await request.json()) as { name: string };
      const household = await getJSON<Household>(env.KV, `household:${code}`);
      if (!household) return json({ error: 'Household not found' }, 404);

      const userId = generateId();
      const colorIndex = household.members.length % USER_COLORS.length;
      household.members.push({ id: userId, name, color: USER_COLORS[colorIndex] });
      await putJSON(env.KV, `household:${code}`, household);
      return json({ userId, household });
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
