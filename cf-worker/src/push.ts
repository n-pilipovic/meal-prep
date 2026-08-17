import { getJSON, putJSON, type KVNamespace } from './kv-helpers';
import { sendPushNotification } from './web-push';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface Household {
  code: string;
  members: { id: string; name: string }[];
}

interface MealPlan {
  days: {
    dayIndex: number;
    dayName: string;
    meals: {
      type: string;
      time?: string;
      name: string;
      ingredients: { name: string; quantity: number | null; unit: string }[];
    }[];
  }[];
}

interface NotificationPreferences {
  enabled: boolean;
  dailySummary: boolean;
  mealReminders: boolean;
  /** Absent on prefs saved before the cook-plan feature — treated as enabled. */
  cookPlanReminders?: boolean;
  /** Per-user overrides set in Podešavanja, keyed by meal type. */
  mealTimes?: Record<string, string>;
  /** IANA zone reported by the browser. Without it we cannot turn "08:30" into an instant. */
  timeZone?: string;
  dailySummaryTime?: string;
}

interface SharedHouseholdState {
  cookPlanSettings?: { cookDayIndexes?: number[] };
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** How often the cron fires. Every candidate time is matched within this window. */
export const TICK_MINUTES = 5;

const REMINDER_LEAD_MINUTES = 30;

const DEFAULT_TIME_ZONE = 'Europe/Belgrade';

const DEFAULT_DAILY_SUMMARY = '07:00';

/** Night-before nudge: prep (chop, peel, soak) happens after dinner. */
const COOK_REMINDER_TIME = '20:00';

const MEAL_ORDER = ['dorucak', 'uzina', 'rucak', 'uzina2', 'vecera'] as const;

const MEAL_LABELS: Record<string, string> = {
  dorucak: 'Doručak',
  uzina: 'Užina',
  rucak: 'Ručak',
  uzina2: 'Užina 2',
  vecera: 'Večera',
};

/** Mirrors MEAL_TIMES in src/app/core/models/meal.model.ts. */
const DEFAULT_MEAL_TIMES: Record<string, string> = {
  dorucak: '09:00',
  uzina: '11:00',
  rucak: '14:00',
  uzina2: '16:00',
  vecera: '18:00',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Runs on every cron tick and decides, per user, whether anything is due right
 * now in *their* local time.
 *
 * The previous version hard-coded one cron per meal in UTC, which meant every
 * reminder landed one or two hours late depending on DST, and personal meal
 * times were ignored entirely.
 */
export async function sendScheduledPush(
  kv: KVNamespace,
  now: Date,
  vapid: VapidConfig,
): Promise<void> {
  const householdKeys = await kv.list({ prefix: 'household:' });

  for (const key of householdKeys.keys) {
    const household = await getJSON<Household>(kv, key.name);
    if (!household) continue;

    // Cook days live in household-shared state; absent until someone opens
    // the cook-plan feature, and then reminders start for the whole household.
    const shared = await getJSON<SharedHouseholdState>(kv, `shared:${household.code}`);
    const cookDays = shared?.cookPlanSettings?.cookDayIndexes ?? null;

    for (const member of household.members) {
      try {
        await processMember(kv, member.id, now, vapid, cookDays);
      } catch (err) {
        // One bad subscription must not stop the rest of the household.
        console.error(`Scheduled push failed for ${member.id}:`, err);
      }
    }
  }
}

async function processMember(
  kv: KVNamespace,
  userId: string,
  now: Date,
  vapid: VapidConfig,
  cookDays: number[] | null = null,
): Promise<void> {
  const sub = await getJSON<PushSubscription>(kv, `subscription:${userId}`);
  if (!sub) return;

  const prefs = await getJSON<NotificationPreferences>(kv, `notif-prefs:${userId}`);
  if (prefs && !prefs.enabled) return;

  const local = zonedNow(now, prefs?.timeZone);

  const plan = await getJSON<MealPlan>(kv, `plan:${userId}`);
  if (!plan) return;

  const day = plan.days[local.dayIndex];
  if (!day) return;

  if (!prefs || prefs.dailySummary) {
    const target = usableTime(prefs?.dailySummaryTime) ?? DEFAULT_DAILY_SUMMARY;
    if (isDue(local.minutes, toMinutes(target))) {
      const ingredients = day.meals
        .flatMap(m => m.ingredients)
        .map(formatIngredient);

      await deliver(kv, userId, local.date, 'daily-summary', sub, vapid, {
        title: `Priprema za danas — ${day.dayName}`,
        body: ingredients.join('\n'),
        tag: 'daily-summary',
        data: { url: '/meal-prep/today' },
      });
    }
  }

  if (
    cookDays &&
    cookDays.length > 0 &&
    prefs?.cookPlanReminders !== false &&
    cookDays.includes((local.dayIndex + 1) % 7) &&
    isDue(local.minutes, toMinutes(COOK_REMINDER_TIME))
  ) {
    await deliver(kv, userId, local.date, 'cook-reminder', sub, vapid, {
      title: 'Sutra je dan kuvanja 🍳',
      body: 'Večeras možeš da pripremiš sastojke: operi, iseckaj, potopi. Pogledaj plan kuvanja.',
      tag: 'cook-reminder',
      data: { url: '/meal-prep/cook-plan' },
    });
  }

  if (prefs && !prefs.mealReminders) return;

  for (const mealType of MEAL_ORDER) {
    const meal = day.meals.find(m => m.type === mealType);
    if (!meal) continue;

    const mealTime = resolveMealTime(mealType, meal.time, prefs?.mealTimes);
    // Clamped rather than wrapped: a 00:10 meal reminds at midnight, never on
    // the previous calendar day where the plan would show different meals.
    const remindAt = Math.max(0, toMinutes(mealTime) - REMINDER_LEAD_MINUTES);
    if (!isDue(local.minutes, remindAt)) continue;

    await deliver(kv, userId, local.date, `meal-${mealType}`, sub, vapid, {
      title: `${MEAL_LABELS[mealType]} za ${REMINDER_LEAD_MINUTES} min (${mealTime})`,
      body: meal.ingredients.map(formatIngredient).join('\n') || meal.name,
      tag: `meal-${mealType}`,
      data: { url: `/meal-prep/day/${local.dayIndex}/meal/${mealType}` },
    });
  }
}

/** Personal override > the plan's own time > the shared default. */
function resolveMealTime(
  mealType: string,
  planTime: string | undefined,
  overrides: Record<string, string> | undefined,
): string {
  return (
    usableTime(overrides?.[mealType]) ??
    usableTime(planTime) ??
    DEFAULT_MEAL_TIMES[mealType]
  );
}

/**
 * Sends once per user, per local day, per tag. Cloudflare may invoke a cron
 * more than once, and overlapping ticks would otherwise duplicate a reminder.
 */
async function deliver(
  kv: KVNamespace,
  userId: string,
  localDate: string,
  tag: string,
  sub: PushSubscription,
  vapid: VapidConfig,
  notification: { title: string; body: string; tag: string; data: unknown },
): Promise<void> {
  const guard = `push-sent:${userId}:${localDate}:${tag}`;
  if (await kv.get(guard)) return;

  // Claim the slot first: a duplicate is worse than a dropped notification if
  // the send itself throws — the next tick would otherwise resend.
  await putJSON(kv, guard, true, { expirationTtl: 60 * 60 * 26 });

  await sendPushNotification(
    sub,
    {
      ...notification,
      icon: '/meal-prep/icons/icon-192x192.png',
      badge: '/meal-prep/icons/icon-72x72.png',
      actions: [{ action: 'view', title: 'Pogledaj' }],
    },
    { publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    vapid.subject,
  );
}

function formatIngredient(i: { name: string; quantity: number | null; unit: string }): string {
  return i.quantity != null ? `☐ ${i.name} ${i.quantity}${i.unit}` : `☐ ${i.name}`;
}

function isDue(nowMinutes: number, targetMinutes: number): boolean {
  const delta = nowMinutes - targetMinutes;
  return delta >= 0 && delta < TICK_MINUTES;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function usableTime(time: string | undefined | null): string | undefined {
  return typeof time === 'string' && TIME_PATTERN.test(time) ? time : undefined;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Wall-clock reading of `now` in the user's zone — DST is Intl's problem, not ours. */
export function zonedNow(
  now: Date,
  timeZone: string | undefined,
): { minutes: number; dayIndex: number; date: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = zonedFormatter(timeZone ?? DEFAULT_TIME_ZONE).formatToParts(now);
  } catch {
    // Unknown/garbage IANA id — fall back rather than drop the notification.
    parts = zonedFormatter(DEFAULT_TIME_ZONE).formatToParts(now);
  }

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  return {
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    dayIndex: WEEKDAY_INDEX[get('weekday')] ?? 0,
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
