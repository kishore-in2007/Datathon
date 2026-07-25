# CODEX BUILD PROMPT — KSP Crime AI MVP (Voice-Enabled, Low-Storage, GitHub-Hosted)

> Paste everything below this line into Codex as one instruction.

---

Build a complete, deployable MVP web application called **"KSP Crime Intelligence Assistant"** — a voice-and-text conversational AI for querying a crime records database. Follow every instruction exactly. Prioritize minimal local disk usage: no local LLMs, no local vector databases, no heavy Python ML stack. Use browser-native APIs and cloud API calls wherever possible.

## 1. Tech stack (mandatory — do not substitute heavier alternatives)

- **Frontend + Backend**: Single Next.js 14 (App Router) project, TypeScript. Next.js API routes serve as the backend — no separate FastAPI server, no Docker.
- **Database**: SQLite via `better-sqlite3`, single file `data/crime.db` (a few MB max). Do NOT use Postgres, Docker, or any external DB service.
- **Speech-to-Text**: Browser's native `webkitSpeechRecognition` / `SpeechRecognition` Web API. Zero downloads, zero storage, works instantly in Chrome/Edge.
- **Text-to-Speech**: Browser's native `speechSynthesis` API. Zero downloads.
- **LLM reasoning**: Use the **Google Gemini API (free tier, no credit card required)** — specifically the `gemini-2.5-flash` model — via a server-side API route using plain `fetch`, no SDK install needed. Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_KEY`. API key read from environment variable `GEMINI_API_KEY`, never hardcoded. This keeps the whole MVP at $0 cost with generous daily quota, which matters since you'll be calling it repeatedly while building and rehearsing the demo.
- **Hosting**: Vercel, connected directly to a GitHub repo, auto-deploys on every push. No self-hosting, no VPS.
- **Styling**: Tailwind CSS (already minimal, no extra libraries needed).

This stack means: no Python installed, no pip packages, no model weights on disk, no Docker images. Total repo size should stay under ~5MB excluding node_modules.

## 2. Project structure to generate

```
ksp-crime-ai/
├── app/
│   ├── page.tsx                 # Main chat UI with mic button
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts        # Main endpoint: receives text, queries DB, calls LLM, returns answer
│       └── seed/route.ts        # One-time endpoint to seed synthetic data (dev only)
├── lib/
│   ├── db.ts                    # SQLite connection + schema init
│   ├── seedData.ts              # Synthetic data generator (Faker-style, pure JS, no Python)
│   ├── sqlGuard.ts              # Validates LLM-generated SQL before execution (allow-list only)
│   └── llm.ts                   # Wrapper for Google Gemini API calls (fetch-based, JSON mode)
├── components/
│   ├── ChatWindow.tsx
│   ├── VoiceButton.tsx          # Mic button using Web Speech API
│   └── MessageBubble.tsx
├── data/
│   └── crime.db                 # SQLite file (generated on first run, gitignored)
├── .env.local.example
├── .gitignore
├── package.json
├── tailwind.config.ts
└── README.md
```

## 3. Database schema (SQLite, keep it small)

Create these tables in `lib/db.ts` using `better-sqlite3`, with an init function that creates tables if they don't exist:

```sql
CREATE TABLE IF NOT EXISTS cases (
  case_id INTEGER PRIMARY KEY AUTOINCREMENT,
  fir_no TEXT,
  district TEXT,
  station TEXT,
  date_reported TEXT,
  crime_type TEXT,
  status TEXT,
  narrative TEXT
);

CREATE TABLE IF NOT EXISTS persons (
  person_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  age INTEGER,
  gender TEXT,
  role TEXT,          -- accused / victim / witness
  case_id INTEGER REFERENCES cases(case_id)
);

CREATE TABLE IF NOT EXISTS locations (
  location_id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES cases(case_id),
  lat REAL,
  lon REAL,
  area_name TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_text TEXT,
  sql_executed TEXT,
  timestamp TEXT
);
```

## 4. Synthetic data generator (`lib/seedData.ts`)

Write a pure-TypeScript generator (no external Faker dependency needed — hardcode arrays of sample first names, last names, districts, crime types, and area names, then randomly combine them). Requirements:

- Generate **800–1200 synthetic cases** (small enough to stay lightweight, large enough to show patterns).
- Districts: Bengaluru North, Bengaluru South, Mysuru, Mangaluru, Hubballi.
- Crime types: chain-snatching, cyber fraud, theft, narcotics, assault, vehicle theft.
- Deliberately plant: (a) one district+crime_type combo with a clear rising trend over the last 8 weeks, (b) a small set of 6–8 persons who reappear across 3–4 different cases together (for network query demo), (c) realistic-sounding one-paragraph narrative text per case (can be templated, doesn't need to be LLM-generated for MVP).
- Insert everything via a single seed function callable from `app/api/seed/route.ts`, run once after deploy.

## 5. Core chat API (`app/api/chat/route.ts`)

Implement this flow:

1. Receive `{ message: string, history: {role, content}[] }` from the frontend.
2. Call the LLM (`lib/llm.ts`) with a system prompt that:
   - Describes the DB schema above.
   - Instructs the model to respond ONLY with a JSON object: `{ "sql": "SELECT ...", "explanation": "..." }` when the question needs data, or `{ "answer": "..." }` when it's conversational.
   - Restricts SQL to `SELECT` statements only, on the tables above.
   - In `lib/llm.ts`, build the Gemini request body with `generationConfig: { responseMimeType: "application/json" }` so Gemini is forced to return valid JSON directly (no markdown fences to strip). POST to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}` with body:
     ```json
     {
       "contents": [{ "role": "user", "parts": [{ "text": "<system prompt + schema + conversation history + user message>" }] }],
       "generationConfig": { "responseMimeType": "application/json", "temperature": 0.2 }
     }
     ```
   - Parse the response from `data.candidates[0].content.parts[0].text` (this is a JSON string — `JSON.parse` it).
   - Wrap every Gemini call in try/catch; on quota/rate-limit errors (HTTP 429), return a friendly "please wait a moment and try again" message instead of crashing.
3. If `sql` is returned, pass it through `lib/sqlGuard.ts`:
   - Reject if it contains `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ATTACH`, `;--`, or multiple statements.
   - Reject if it references any table/column not in the schema.
   - Enforce `LIMIT 50` if no limit is present.
4. Execute the validated SQL against `data/crime.db`.
5. Log the query + SQL to `audit_log`.
6. Send the SQL results back to the LLM in a second call, asking it to produce a natural-language answer summarizing the results for a police investigator.
7. Return `{ answer: string, sql: string | null, rows: any[] }` to the frontend.

If the LLM's SQL execution throws an error, catch it, return a friendly fallback answer, and log the error — never crash the route.

## 6. Voice integration (`components/VoiceButton.tsx`)

- Use `window.SpeechRecognition || window.webkitSpeechRecognition`.
- On mic button click: start listening, show a pulsing animation, set `lang = 'en-IN'` (supports Indian English well; mention in code comments that `'kn-IN'` can be swapped in for Kannada if the browser supports it).
- On result: populate the chat input with the transcribed text and auto-submit.
- Handle `onerror` and `onend` gracefully (stop animation, show a toast if no speech detected).
- After receiving the AI's answer, use `window.speechSynthesis.speak()` to read the response aloud. Let the user toggle voice-reply on/off with a small switch in the UI (default ON).
- Add a text input fallback at all times — never require voice only.

## 7. Frontend UI (`app/page.tsx` + components)

- Clean chat interface: message bubbles (user right-aligned, AI left-aligned), a mic button + text input + send button in a fixed bottom bar.
- Show a small "Reasoning" expandable section under AI messages that displays the SQL query that was run (builds trust/explainability, and is an easy visual "wow" feature for judges).
- Add 3 suggested-question chips above the input for first-time users, e.g.: "How many chain-snatching cases in Bengaluru North this month?", "Show repeat persons linked across multiple cases", "Which crime type is rising fastest?"
- Add a simple header: "KSP Crime Intelligence Assistant" with a status dot showing "Connected".
- Keep all styling in Tailwind utility classes, no external UI kit, to keep bundle size small.

## 8. Environment & secrets

- Create `.env.local.example` with: `GEMINI_API_KEY=your_key_here`
- Add `.env.local`, `node_modules`, `data/crime.db`, and `.next` to `.gitignore`.
- In `lib/llm.ts`, read the key via `process.env.GEMINI_API_KEY` — never commit real keys.
- Mention in README.md: get a free key at https://aistudio.google.com/apikey — no credit card required, takes under a minute.

## 9. GitHub + Vercel deployment steps (include these exact steps in the README.md)

1. `git init && git add . && git commit -m "Initial MVP commit"`
2. Create a new GitHub repo (via GitHub CLI: `gh repo create ksp-crime-ai --public --source=. --push`, or manually on github.com and then `git remote add origin <url> && git push -u origin main`).
3. Go to vercel.com → "Add New Project" → Import the GitHub repo.
4. In Vercel project settings → Environment Variables → add `GEMINI_API_KEY` with the real key (get it free at https://aistudio.google.com/apikey).
5. Deploy. Vercel gives a live URL like `https://ksp-crime-ai.vercel.app` — this is the MVP link to submit.
6. After first deploy, visit `https://<your-app>.vercel.app/api/seed` once to populate the database.
7. Every future `git push` to `main` auto-redeploys.

## 10. Non-negotiable constraints (repeat back before coding)

- No Python, no pip, no Docker, no local model weights, no Postgres — SQLite + Next.js + browser APIs only.
- LLM calls go exclusively through the free Google Gemini API (`gemini-2.5-flash`) — no Anthropic/OpenAI keys, no paid usage. Since the free tier has a daily request ceiling, add a simple in-memory counter in `lib/llm.ts` that logs a console warning past ~1000 calls/day as an early heads-up before the demo.
- Total local disk footprint (excluding node_modules) under 5MB.
- Must run with a single `npm install && npm run dev` locally.
- Must deploy successfully on Vercel's free tier with zero paid add-ons.
- Voice must degrade gracefully to text-only if the browser doesn't support Speech APIs (e.g., Firefox has partial support) — feature-detect and hide the mic button if unsupported.

Now generate the complete file contents for every file in the project structure above, in order, ready to copy into a new folder.

---
