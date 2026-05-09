import { type MealPlanPreferences, SYSTEM_PROMPT, buildUserPrompt } from './ai-prompt';
import { fetchWithTimeout } from './ai-models';

export async function generateMealPlanGroq(
  apiKey: string,
  prefs: MealPlanPreferences,
  model: string,
): Promise<unknown> {
  const response = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(prefs) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        // llama-3.1-8b-instant caps per-request output at 8192; higher values return 413.
        max_tokens: 8000,
      }),
    },
    'Groq',
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error ${response.status}: ${error}`);
  }

  const result = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const text = result.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Empty response from Groq');
  }

  return JSON.parse(text);
}
