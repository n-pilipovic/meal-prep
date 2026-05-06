export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

export interface Household {
  code: string;
  members: UserProfile[];
  createdAt: string;
}

export interface PrepAssignments {
  byUserPlan: Record<string, string>;
  byMeal: Record<string, string>;
  byItem: Record<string, string>;
}

export interface SharedState {
  shoppingChecked: Record<string, boolean>;
  shoppingAssignments: Record<string, string>;
  prepChecked: Record<string, boolean>;
  prepAssignments: PrepAssignments;
}

export interface NotificationPreferences {
  enabled: boolean;
  dailySummary: boolean;
  mealReminders: boolean;
  issueUpdates?: boolean;
}

export const USER_COLORS = [
  '#2d6a4f',
  '#e76f51',
  '#264653',
  '#e9c46a',
  '#6a4c93',
];

export function createEmptySharedState(): SharedState {
  return {
    shoppingChecked: {},
    shoppingAssignments: {},
    prepChecked: {},
    prepAssignments: {
      byUserPlan: {},
      byMeal: {},
      byItem: {},
    },
  };
}
