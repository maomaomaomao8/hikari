const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export async function estimateFeedingCount(utcTime) {
  const prompt = `You are a data analyst. Given the current UTC time of ${utcTime.toISOString()}, estimate how many people are currently feeding a newborn (baby in the first month of life) somewhere in the world right now.

Reason through these factors step by step:
1. Global birth rate is approximately 140,000 births per day (~385,000 newborns alive at any time in their first month).
2. Newborns in month 1 feed 8-12 times per 24 hours, roughly every 2-3 hours. Each feeding session lasts about 20-40 minutes.
3. Consider current time zones — at ${utcTime.toISOString()}, determine which major population centers are in nighttime hours (midnight to 6am local) vs daytime. Nighttime feeds still happen but slightly less frequently as some parents try to stretch intervals.
4. Weight the estimate to reflect that nighttime feeds feel more isolating — the person feeding is often alone, awake while others sleep. This emotional context matters.

After your reasoning, output your final estimate as a single number on the last line, formatted exactly as: ESTIMATE: [number]`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  console.log('[synthesis] Claude reasoning:\n', text);

  const match = text.match(/ESTIMATE:\s*([\d,]+)/);
  if (!match) {
    throw new Error('Could not parse estimate from Claude response');
  }

  return parseInt(match[1].replace(/,/g, ''), 10);
}
