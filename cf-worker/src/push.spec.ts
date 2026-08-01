import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendScheduledPush, zonedNow, TICK_MINUTES } from './push';
import type { KVNamespace } from './kv-helpers';

const sent: { title: string; tag: string; body: string }[] = [];

vi.mock('./web-push', () => ({
  sendPushNotification: async (_sub: unknown, notification: any) => {
    sent.push({ title: notification.title, tag: notification.tag, body: notification.body });
    return true;
  },
}));

const VAPID = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:x@y.z' };

function makeKv(seed: Record<string, unknown> = {}): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) store.set(k, JSON.stringify(v));

  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix }: { prefix?: string } = {}) {
      return {
        keys: [...store.keys()]
          .filter(k => !prefix || k.startsWith(prefix))
          .map(name => ({ name })),
      };
    },
  };
}

/** Friday 2026-08-07 — dayIndex 4 in Belgrade (CEST, UTC+2). */
const FRIDAY_PLAN = {
  days: [
    { dayIndex: 0, dayName: 'Ponedeljak', meals: [] },
    { dayIndex: 1, dayName: 'Utorak', meals: [] },
    { dayIndex: 2, dayName: 'Sreda', meals: [] },
    { dayIndex: 3, dayName: 'Četvrtak', meals: [] },
    {
      dayIndex: 4,
      dayName: 'Petak',
      meals: [
        {
          type: 'dorucak',
          time: '07:30',
          name: 'Omlet',
          ingredients: [{ name: 'Jaja', quantity: 4, unit: 'kom' }],
        },
        {
          type: 'rucak',
          time: '13:00',
          name: 'Varivo',
          ingredients: [{ name: 'Pasulj', quantity: 90, unit: 'g' }],
        },
      ],
    },
    { dayIndex: 5, dayName: 'Subota', meals: [] },
    { dayIndex: 6, dayName: 'Nedelja', meals: [] },
  ],
};

function seedUser(prefs: Record<string, unknown> = {}) {
  return {
    'household:ABC': { code: 'ABC', members: [{ id: 'u1', name: 'Novica' }] },
    'subscription:u1': { endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } },
    'notif-prefs:u1': {
      enabled: true,
      dailySummary: false,
      mealReminders: true,
      timeZone: 'Europe/Belgrade',
      ...prefs,
    },
    'plan:u1': FRIDAY_PLAN,
  };
}

/** A UTC instant, so the tests state the wall clock they mean explicitly. */
const utc = (iso: string) => new Date(iso);

describe('zonedNow', () => {
  it('reads the wall clock in the target zone, not UTC', () => {
    // 06:00Z in August is 08:00 in Belgrade (CEST, UTC+2)
    const local = zonedNow(utc('2026-08-07T06:00:00Z'), 'Europe/Belgrade');
    expect(local.minutes).toBe(8 * 60);
    expect(local.date).toBe('2026-08-07');
    expect(local.dayIndex).toBe(4); // Friday
  });

  it('follows DST — the same UTC hour is one hour earlier in winter', () => {
    const summer = zonedNow(utc('2026-08-07T06:00:00Z'), 'Europe/Belgrade');
    const winter = zonedNow(utc('2026-01-09T06:00:00Z'), 'Europe/Belgrade');
    expect(summer.minutes).toBe(8 * 60);
    expect(winter.minutes).toBe(7 * 60);
  });

  it('rolls the day over when the zone is ahead of UTC', () => {
    const local = zonedNow(utc('2026-08-07T23:30:00Z'), 'Europe/Belgrade');
    expect(local.date).toBe('2026-08-08');
    expect(local.dayIndex).toBe(5); // Saturday
  });

  it('falls back to the default zone for a garbage IANA id', () => {
    const local = zonedNow(utc('2026-08-07T06:00:00Z'), 'Not/AZone');
    expect(local.minutes).toBe(8 * 60);
  });
});

describe('sendScheduledPush', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('fires a meal reminder 30 min before the plan time, in local time', async () => {
    // Breakfast 07:30 local -> remind 07:00 local -> 05:00Z in August
    await sendScheduledPush(makeKv(seedUser()), utc('2026-08-07T05:00:00Z'), VAPID);

    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('meal-dorucak');
    expect(sent[0].title).toBe('Doručak za 30 min (07:30)');
    expect(sent[0].body).toContain('Jaja 4kom');
  });

  it('does not fire at the UTC-equivalent hour (the old off-by-DST bug)', async () => {
    // 07:00 UTC would have been the old trigger; locally that is already 09:00
    await sendScheduledPush(makeKv(seedUser()), utc('2026-08-07T07:00:00Z'), VAPID);
    expect(sent).toHaveLength(0);
  });

  it('prefers the user override over the plan time', async () => {
    const kv = makeKv(seedUser({ mealTimes: { dorucak: '06:45' } }));
    // 06:45 local -> remind 06:15 local -> 04:15Z
    await sendScheduledPush(kv, utc('2026-08-07T04:15:00Z'), VAPID);

    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('Doručak za 30 min (06:45)');
  });

  it('ignores a malformed override and keeps the plan time', async () => {
    const kv = makeKv(seedUser({ mealTimes: { dorucak: '25:99' } }));
    await sendScheduledPush(kv, utc('2026-08-07T05:00:00Z'), VAPID);
    expect(sent[0]?.title).toBe('Doručak za 30 min (07:30)');
  });

  it(`matches anywhere inside the ${TICK_MINUTES}-minute tick window`, async () => {
    await sendScheduledPush(makeKv(seedUser()), utc('2026-08-07T05:04:00Z'), VAPID);
    expect(sent).toHaveLength(1);
  });

  it('does not fire once the window has passed', async () => {
    await sendScheduledPush(makeKv(seedUser()), utc('2026-08-07T05:05:00Z'), VAPID);
    expect(sent).toHaveLength(0);
  });

  it('sends each reminder only once per local day', async () => {
    const kv = makeKv(seedUser());
    await sendScheduledPush(kv, utc('2026-08-07T05:00:00Z'), VAPID);
    await sendScheduledPush(kv, utc('2026-08-07T05:01:00Z'), VAPID);
    expect(sent).toHaveLength(1);
  });

  it('sends again the next day', async () => {
    const kv = makeKv(seedUser());
    await sendScheduledPush(kv, utc('2026-08-07T05:00:00Z'), VAPID);
    sent.length = 0;
    // Next Friday, same wall clock
    await sendScheduledPush(kv, utc('2026-08-14T05:00:00Z'), VAPID);
    expect(sent).toHaveLength(1);
  });

  it('honours a non-Belgrade time zone', async () => {
    const kv = makeKv(seedUser({ timeZone: 'America/New_York' }));
    // 07:00 in New York (EDT, UTC-4) is 11:00Z
    await sendScheduledPush(kv, utc('2026-08-07T11:00:00Z'), VAPID);
    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('meal-dorucak');
  });

  it('respects the mealReminders toggle', async () => {
    const kv = makeKv(seedUser({ mealReminders: false }));
    await sendScheduledPush(kv, utc('2026-08-07T05:00:00Z'), VAPID);
    expect(sent).toHaveLength(0);
  });

  it('sends nothing when notifications are disabled', async () => {
    const kv = makeKv(seedUser({ enabled: false }));
    await sendScheduledPush(kv, utc('2026-08-07T05:00:00Z'), VAPID);
    expect(sent).toHaveLength(0);
  });

  it('skips a member with no subscription', async () => {
    const seed = seedUser();
    delete (seed as any)['subscription:u1'];
    await sendScheduledPush(makeKv(seed), utc('2026-08-07T05:00:00Z'), VAPID);
    expect(sent).toHaveLength(0);
  });

  it('skips a member whose plan was never synced to KV', async () => {
    const seed = seedUser();
    delete (seed as any)['plan:u1'];
    await sendScheduledPush(makeKv(seed), utc('2026-08-07T05:00:00Z'), VAPID);
    expect(sent).toHaveLength(0);
  });

  it('sends the daily summary at the configured local time', async () => {
    const kv = makeKv(seedUser({ dailySummary: true, mealReminders: false }));
    // default 07:00 local -> 05:00Z
    await sendScheduledPush(kv, utc('2026-08-07T05:00:00Z'), VAPID);

    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('daily-summary');
    expect(sent[0].title).toBe('Priprema za danas — Petak');
    expect(sent[0].body).toContain('Pasulj 90g');
  });

  it('reads the plan day from the user local date, not UTC', async () => {
    // 22:35Z Thursday is already 00:35 Friday in Belgrade. A meal at 01:00
    // Friday reminds at 00:30 Friday local.
    const plan = structuredClone(FRIDAY_PLAN);
    plan.days[4].meals = [
      { type: 'dorucak', time: '01:00', name: 'Noćni', ingredients: [{ name: 'X', quantity: 1, unit: 'kom' }] },
    ];
    const kv = makeKv({ ...seedUser(), 'plan:u1': plan });

    await sendScheduledPush(kv, utc('2026-08-06T22:30:00Z'), VAPID);
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('Doručak za 30 min (01:00)');
  });

  it('clamps rather than wraps a reminder that would land before midnight', async () => {
    const plan = structuredClone(FRIDAY_PLAN);
    plan.days[4].meals = [
      { type: 'dorucak', time: '00:10', name: 'Rani', ingredients: [{ name: 'X', quantity: 1, unit: 'kom' }] },
    ];
    const kv = makeKv({ ...seedUser(), 'plan:u1': plan });

    // Midnight local on Friday = 22:00Z Thursday
    await sendScheduledPush(kv, utc('2026-08-06T22:00:00Z'), VAPID);
    expect(sent).toHaveLength(1);
  });
});
