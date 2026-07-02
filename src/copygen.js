const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export async function generateCopy(estimatedCount, utcHour) {
  const formattedCount = estimatedCount.toLocaleString('en-US');

  const prompt = `You write one sentence for a parent who just opened an app while feeding their newborn.

The estimated number of parents holding their baby right now worldwide is ${formattedCount}.

Rules — follow these exactly:
- Write EXACTLY one sentence. Nothing else. No quotes around it.
- The sentence must convey presence only. State who is here, right now, in this moment.
- NEVER use comparison, negation, or motivation. No "you're not alone," no "powering through," no "you've got this," no "struggling."
- NEVER frame the experience as hard, tough, or a challenge. Don't name the difficulty.
- NEVER reference nighttime, time of day, being awake, or darkness. No time references at all.
- Be specific — use the actual number. Say "around ${formattedCount}" not "thousands" or "so many."
- Tone: warm, quiet, specific. Like a whisper from someone sitting next to you.
- Keep it under 20 words.

Template to follow closely:
"Around ${formattedCount} parents are holding their baby in this exact moment, just like you."

Examples of CORRECT tone and structure:
- "Around ${formattedCount} parents are holding their baby in this exact moment, just like you."
- "Right now, about ${formattedCount} other parents are holding someone small, just like you."
- "Around ${formattedCount} parents are in this moment with you, each holding someone tiny."`;

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
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}
