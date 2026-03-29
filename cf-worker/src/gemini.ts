import { type MealPlanPreferences, SYSTEM_PROMPT, buildUserPrompt } from './ai-prompt';

export async function generateMealPlanGemini(
  apiKey: string,
  prefs: MealPlanPreferences,
): Promise<unknown> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${error}`);
  }

  const result = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  return JSON.parse(text);
}
