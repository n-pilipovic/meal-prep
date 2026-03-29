import { type MealPlanPreferences, SYSTEM_PROMPT, buildUserPrompt } from './ai-prompt';

export async function generateMealPlan(
  apiKey: string,
  prefs: MealPlanPreferences,
): Promise<unknown | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: buildUserPrompt(prefs) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
          },
        }),
      },
    );

    if (!response.ok) return null;

    const result = (await response.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text);
  } catch {
    return null;
  }
}
