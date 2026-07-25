type GeminiJson = {
  type?: "sql" | "network" | "predictive" | "conversational";
  sql?: string; explanation?: string; answer?: string; personName?: string;
  district?: string; crimeType?: string;
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
    throw new GeminiError(error instanceof Error ? error.message : "Gemini request failed.");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error("Gemini API error:", response.status, body.slice(0, 500));
    throw new GeminiError(response.status === 429 ? "Gemini rate limit reached." : "Gemini API request failed.", response.status);
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
