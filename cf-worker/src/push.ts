import { getJSON, type KVNamespace } from './kv-helpers';
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
      name: string;
      ingredients: { name: string; quantity: number | null; unit: string }[];
    }[];
  }[];
}

interface NotificationPreferences {
  enabled: boolean;
  dailySummary: boolean;
  mealReminders: boolean;
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export async function sendScheduledPush(
  kv: KVNamespace,
  cronType: 'daily' | 'dorucak' | 'uzina' | 'rucak' | 'uzina2' | 'vecera',
  vapid: VapidConfig,
): Promise<void> {
  const householdKeys = await kv.list({ prefix: 'household:' });

  for (const key of householdKeys.keys) {
    const household = await getJSON<Household>(kv, key.name);
    if (!household) continue;

    for (const member of household.members) {
      const sub = await getJSON<PushSubscription>(kv, `subscription:${member.id}`);
      if (!sub) continue;

      // Check user's notification preferences
      const notifPrefs = await getJSON<NotificationPreferences>(kv, `notif-prefs:${member.id}`);
      if (notifPrefs && !notifPrefs.enabled) continue;
      if (cronType === 'daily' && notifPrefs && !notifPrefs.dailySummary) continue;
      if (cronType !== 'daily' && notifPrefs && !notifPrefs.mealReminders) continue;

      const plan = await getJSON<MealPlan>(kv, `plan:${member.id}`);
      if (!plan) continue;

      const today = getTodayIndex();
      const day = plan.days[today];
      if (!day) continue;

      let title: string;
      let body: string;
      let tag: string;

      let dataUrl: string;

      if (cronType === 'daily') {
        title = `Priprema za danas — ${day.dayName}`;
        const allIngredients = day.meals
          .flatMap(m => m.ingredients)
          .map(i => i.quantity != null ? `☐ ${i.name} ${i.quantity}${i.unit}` : `☐ ${i.name}`);
        body = allIngredients.join('\n');
        tag = 'daily-summary';
        dataUrl = '/meal-prep/today';
      } else {
        const meal = day.meals.find(m => m.type === cronType);
        if (!meal) continue;

        const mealLabels: Record<string, string> = {
          dorucak: 'Doručak',
          uzina: 'Užina',
          rucak: 'Ručak',
          uzina2: 'Užina 2',
          vecera: 'Večera',
        };
        const mealTimes: Record<string, string> = {
          dorucak: '09:00',
          uzina: '11:00',
          rucak: '14:00',
          uzina2: '16:00',
          vecera: '18:00',
        };

        title = `${mealLabels[cronType]} za 30 min (${mealTimes[cronType]})`;
        body = meal.ingredients
          .map(i => i.quantity != null ? `☐ ${i.name} ${i.quantity}${i.unit}` : `☐ ${i.name}`)
          .join('\n');
        tag = `meal-${cronType}`;
        dataUrl = `/meal-prep/day/${today}/meal/${cronType}`;
      }

      await sendPushNotification(
        sub,
        {
          title,
          body,
          icon: '/meal-prep/icons/icon-192x192.png',
          badge: '/meal-prep/icons/icon-72x72.png',
          tag,
          data: { url: dataUrl },
          actions: [{ action: 'view', title: 'Pogledaj' }],
        },
        { publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        vapid.subject,
      );
    }
  }
}

function getTodayIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
