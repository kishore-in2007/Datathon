type GeminiJson = {
  type?: "sql" | "network" | "predictive" | "conversational";
  sql?: string; explanation?: string; answer?: string; personName?: string;
  district?: string; crimeType?: string;
  action?: "switchTab";
  tab?: "network" | "hotspots" | "alerts" | "chat";
};

let callDay = new Date().toISOString().slice(0, 10);
let callCount = 0;

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function trackCall() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== callDay) {
    callDay = today;
    callCount = 0;
  }
  callCount += 1;
  if (callCount > 1000) console.warn(`Gemini daily call count is ${callCount}; check free-tier quota before the demo.`);
}

export async function callGemini(prompt: string): Promise<GeminiJson> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured.");
  const retryDelays = [0, 2000, 4000];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt]) await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    trackCall();
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
    } catch (error) {
      console.error(`Gemini request failure attempt=${attempt + 1}:`, error);
      throw new GeminiError(error instanceof Error ? error.message : "Gemini request failed.");
    }
    if (!response.ok) {
      const body = await response.text();
      console.error(`Gemini API failure attempt=${attempt + 1} status=${response.status}:`, body.slice(0, 500));
      if (response.status === 429 && attempt < retryDelays.length - 1) continue;
      if (response.status === 429) {
        return { type: "conversational", answer: "Still processing — please ask again in a few seconds." };
      }
      throw new GeminiError("Gemini API request failed.", response.status);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new GeminiError("Gemini returned an empty response.");
    try {
      return JSON.parse(text) as GeminiJson;
    } catch {
      throw new GeminiError("Gemini returned invalid JSON.");
    }
  }
  return { type: "conversational", answer: "Still processing — please ask again in a few seconds." };
}
