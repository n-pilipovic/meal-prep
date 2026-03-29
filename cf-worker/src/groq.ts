import { type MealPlanPreferences, SYSTEM_PROMPT, buildUserPrompt } from './ai-prompt';

export async function generateMealPlanGroq(
  apiKey: string,
  prefs: MealPlanPreferences,
): Promise<unknown> {
  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(prefs) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 16000,
      }),
    },
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
