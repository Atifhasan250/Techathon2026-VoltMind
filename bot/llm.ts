import { GoogleGenAI } from "@google/genai";

const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY,
].filter((key): key is string => Boolean(key?.trim()));

const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const cache = new Map<string, { value: string; expiresAt: number }>();
let nextKeyIndex = 0;

export async function humanize(facts: string, context: string): Promise<string> {
  const cacheKey = `${context}:${facts}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (apiKeys.length === 0) return facts;

  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const keyIndex = (nextKeyIndex + attempt) % apiKeys.length;
    try {
      const ai = new GoogleGenAI({ apiKey: apiKeys[keyIndex] });
      const response = await ai.models.generateContent({
        model,
        contents: `Context: ${context}\nVerified facts: ${facts}`,
        config: {
          systemInstruction: "You are VoltMind, a concise and friendly office energy assistant replying in Discord. Preserve every number, device state, room name, and unit exactly as supplied. Never invent facts or claim to control devices. Use at most one emoji and stay under 900 characters.",
          temperature: 0.2,
        },
      });
      const text = response.text?.trim();
      if (!text) throw new Error("Gemini returned an empty response");
      nextKeyIndex = (keyIndex + 1) % apiKeys.length;
      cache.set(cacheKey, { value: text, expiresAt: Date.now() + 10_000 });
      return text;
    } catch (error) {
      console.warn(`[Gemini] Key ${keyIndex + 1} failed:`, error instanceof Error ? error.message : error);
    }
  }

  return facts;
}
