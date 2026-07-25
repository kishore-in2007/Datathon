# CODEX BUILD PROMPT — KSP Crime AI: FULL-FEATURE MVP (Voice, Low-Storage, GitHub+Vercel Hosted)

> Paste everything below this line into Codex as one instruction. This version includes ALL key features from the original brief, fixes the Vercel/SQLite persistence problem, and keeps local disk usage near zero.

---

Build a complete, deployable web application called **"KSP Crime Intelligence Assistant"** — a voice-and-text conversational AI for the State Crime Records Bureau (SCRB) that supports natural-language querying, criminal network analysis, hotspot/trend prediction, explainable answers, proactive alerts, role-based access, audit logging, and PDF export. Follow every instruction exactly. Keep local disk usage near zero — no local databases on disk, no Python, no Docker, no downloaded ML models.

## 1. Tech stack (mandatory — do not substitute heavier alternatives)

- **Frontend + Backend**: Single Next.js 14 (App Router) project, TypeScript. Next.js API routes serve as the backend.
- **Database: Turso (libSQL)** — a free, hosted, SQLite-compatible database accessed over the network via `@libsql/client`. This is the fix for the earlier plan: a plain SQLite file does NOT reliably persist on Vercel's serverless filesystem, but Turso is remote, free (generous tier, no card required for the free plan), and uses **zero storage on your laptop** since nothing is stored locally — only a connection URL + auth token in env vars.
- **Speech-to-Text**: Browser's native `webkitSpeechRecognition` / `SpeechRecognition` Web API. Zero downloads.
- **Text-to-Speech**: Browser's native `speechSynthesis` API. Zero downloads.
- **LLM reasoning**: Google Gemini API, free tier, model `gemini-2.5-flash`, called via plain `fetch` (no SDK). API key in `GEMINI_API_KEY` env var. Get a free key at https://aistudio.google.com/apikey — no credit card required.
- **Graph analysis (criminal networks)**: Pure JavaScript using the `graphology` npm package (small, ~200KB, no native binaries) plus `graphology-communities-louvain` for cluster detection and `graphology-metrics` for centrality. No Python/NetworkX needed.
- **Predictive analytics (hotspot + trend)**: Plain JavaScript statistics — no XGBoost/Prophet/scikit-learn. Implement:
  - Trend forecasting via simple linear regression over weekly counts (a ~15-line function, no library needed).
  - Hotspot scoring via a lightweight kernel-density-style weighted count per area (recent weeks weighted higher than older weeks).
  - "Explainability" via a manual factor breakdown (e.g., % contribution of recent-count vs. historical-average vs. day-of-week pattern) computed directly from the same numbers used in the prediction — this is a lightweight stand-in for SHAP, fully sufficient for demo credibility, with zero extra dependencies.
- **PDF export**: `@react-pdf/renderer` (pure JS, no headless browser, no Puppeteer — Puppeteer would download a full Chromium binary and blow up your storage budget).
- **Hosting**: Vercel, connected to GitHub, auto-deploys on push.
- **Styling**: Tailwind CSS.

This stack means: no Python, no Docker, no ML model weights, no Puppeteer/Chromium download, no local database file. Total repo size (excluding node_modules) should stay under ~8MB.

## 2. Project structure to generate

```
ksp-crime-ai/
├── app/
│   ├── page.tsx                     # Main app shell (chat + tabs for map/network/alerts)
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/page.tsx               # Simple role-select login (Analyst / SHO / SP)
│   └── api/
│       ├── chat/route.ts            # Main conversational endpoint (query planner)
│       ├── seed/route.ts            # One-time endpoint to seed synthetic data
│       ├── network/route.ts         # Returns graph nodes/edges + community detection + centrality
│       ├── predict/route.ts         # Returns hotspot scores + trend forecast + factor breakdown
│       ├── alerts/route.ts          # Returns current proactive alerts (computed on request for MVP)
│       ├── export-pdf/route.ts      # Generates a PDF of a conversation
│       └── auth/route.ts            # Minimal JWT issuance based on selected role
├── lib/
│   ├── db.ts                        # Turso client connection + schema init (idempotent CREATE TABLE IF NOT EXISTS)
│   ├── seedData.ts                  # Synthetic data generator (pure JS, no external Faker dependency)
│   ├── sqlGuard.ts                  # Validates LLM-generated SQL before execution (allow-list only)
│   ├── llm.ts                       # Gemini API wrapper (fetch-based, JSON mode)
│   ├── graphAnalysis.ts             # graphology-based community detection + centrality
│   ├── predictiveAnalysis.ts        # Linear regression trend + weighted hotspot scoring + factor breakdown
│   ├── auth.ts                      # JWT sign/verify + role-check middleware helper
│   └── auditLog.ts                  # Hash-chained audit log writer/reader
├── components/
│   ├── ChatWindow.tsx
│   ├── VoiceButton.tsx              # Mic button using Web Speech API
│   ├── MessageBubble.tsx            # Includes expandable "Reasoning" (SQL + source trail)
│   ├── NetworkGraphView.tsx         # react-force-graph-2d rendering of nodes/edges
│   ├── HotspotMap.tsx               # Leaflet map with weighted markers
│   ├── AlertsPanel.tsx              # List of proactive alerts with severity badges
│   └── RoleBadge.tsx
├── .env.local.example
├── .gitignore
├── package.json
├── tailwind.config.ts
└── README.md
```

## 3. Database schema (Turso/libSQL — well-defined, run via `lib/db.ts` init function)

```sql
CREATE TABLE IF NOT EXISTS cases (
  case_id INTEGER PRIMARY KEY AUTOINCREMENT,
  fir_no TEXT NOT NULL,
  district TEXT NOT NULL,
  station TEXT NOT NULL,
  date_reported TEXT NOT NULL,       -- ISO date string
  crime_type TEXT NOT NULL,
  status TEXT NOT NULL,              -- open / under_investigation / closed
  narrative TEXT
);

CREATE TABLE IF NOT EXISTS persons (
  person_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  address_area TEXT
);

CREATE TABLE IF NOT EXISTS case_persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(case_id),
  person_id INTEGER NOT NULL REFERENCES persons(person_id),
  role TEXT NOT NULL                 -- accused / victim / witness
);

CREATE TABLE IF NOT EXISTS locations (
  location_id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(case_id),
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  area_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS network_edges (
  edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_a INTEGER NOT NULL REFERENCES persons(person_id),
  person_b INTEGER NOT NULL REFERENCES persons(person_id),
  shared_case_id INTEGER NOT NULL REFERENCES cases(case_id),
  weight INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_role TEXT,
  query_text TEXT,
  sql_executed TEXT,
  timestamp TEXT NOT NULL,
  prev_hash TEXT,
  row_hash TEXT NOT NULL             -- sha256(prev_hash + query_text + sql_executed + timestamp)
);
```

Notes for Codex to follow exactly:
- `network_edges` should be populated by a derivation step in the seed script: for every pair of persons who appear together in `case_persons` for the same `case_id`, insert one edge (increment `weight` if the pair already shares another case).
- `audit_log.row_hash` implements simple tamper-evidence: each new row's hash includes the previous row's hash (Node's built-in `crypto.createHash('sha256')`, no extra dependency).

## 4. Synthetic data generator (`lib/seedData.ts`)

Pure TypeScript, no external Faker dependency (hardcode name/area arrays and randomly combine them). Requirements:

- Generate **800–1200 synthetic cases** across districts: Bengaluru North, Bengaluru South, Mysuru, Mangaluru, Hubballi.
- Crime types: chain-snatching, cyber fraud, theft, narcotics, assault, vehicle theft.
- Deliberately plant, so the demo features have something real to surface:
  - **One rising trend**: pick one district+crime_type pair and generate a clear week-over-week increase over the last 8 weeks (for the predictive/trend feature).
  - **One geographic hotspot cluster**: concentrate ~40 cases in a small set of lat/lon coordinates within one area over the last 3 weeks (for the hotspot map).
  - **A criminal network**: create 8–10 persons who co-appear across 4–5 cases together in varying combinations, so community detection finds a clear cluster and centrality scoring flags a "hub" person.
  - Realistic one-paragraph templated narrative text per case.
- Populate `locations` with real-ish lat/lon values roughly within Karnataka's bounding box for each district.
- Derive and insert `network_edges` from `case_persons` co-occurrence as described above.
- Expose a single `seedDatabase()` function called from `app/api/seed/route.ts`. Make it idempotent-safe: check if `cases` already has rows before inserting again, to avoid duplicate seeding on repeated calls.

## 5. Core chat API (`app/api/chat/route.ts`) — the query planner

1. Receive `{ message: string, history: {role, content}[], role: 'analyst'|'sho'|'sp' }` from the frontend (role comes from the JWT, verified server-side via `lib/auth.ts`).
2. Call Gemini (`lib/llm.ts`) with a system prompt that:
   - Describes the full schema above.
   - Instructs the model to decide the query type and respond ONLY with JSON in one of these shapes:
     - `{ "type": "sql", "sql": "SELECT ...", "explanation": "..." }`
     - `{ "type": "network", "personName": "..." }` (route to network module)
     - `{ "type": "predictive", "district": "...", "crimeType": "..." }` (route to predictive module)
     - `{ "type": "conversational", "answer": "..." }`
   - Enforce SELECT-only SQL, restricted to the schema's tables/columns.
   - In `lib/llm.ts`, set `generationConfig: { responseMimeType: "application/json", temperature: 0.2 }` in the Gemini request body so output is guaranteed parseable JSON — no markdown-fence stripping needed. Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`.
3. Branch on `type`:
   - `sql` → validate via `lib/sqlGuard.ts` (reject non-SELECT, unknown tables/columns, multiple statements; enforce `LIMIT 50`), execute via the Turso client, log to `audit_log` with hash chaining, then send results back to Gemini in a second call to produce a natural-language summary for an investigator.
   - `network` → call `lib/graphAnalysis.ts` to build the graph from `network_edges`, run Louvain community detection and betweenness centrality, return the relevant subgraph plus a plain-language summary (e.g., "This person is a likely network hub, connected to 4 others across 3 cases").
   - `predictive` → call `lib/predictiveAnalysis.ts` for trend/hotspot scoring, return the forecast plus the factor breakdown.
   - `conversational` → return the answer directly.
4. Enforce role restrictions before executing: Analyst = SQL queries only (read-only, own-district filter optional for MVP); SHO = SQL + network; SP = SQL + network + predictive. If a lower role requests a restricted type, return a polite "this requires SP-level access" message instead of executing.
5. Return `{ answer, sql, rows, networkData, predictionData }` (only relevant fields populated) to the frontend.
6. Wrap every Gemini/Turso call in try/catch; never let the route crash — always return a graceful fallback message.

## 6. Network analysis (`lib/graphAnalysis.ts`)

- Load all rows from `network_edges` (joined with `persons` for names) via Turso.
- Build a `graphology` `Graph()`, add nodes (persons) and edges (with weight).
- Run `graphology-communities-louvain` for cluster assignment.
- Run `graphology-metrics`'s betweenness centrality; flag the top-scoring node(s) as "likely hub."
- Return `{ nodes: [{id, name, community, centrality}], edges: [{source, target, weight}] }` for the frontend's `NetworkGraphView.tsx` (use `react-force-graph-2d`, a lightweight canvas-based renderer — avoid 3D renderer to save bundle size).

## 7. Predictive analytics (`lib/predictiveAnalysis.ts`)

- **Trend forecast**: group matching cases by ISO week for the requested district+crime_type, run ordinary least-squares linear regression (implement manually — slope/intercept from sums, no library needed) over the last 8 weeks, project the next week's expected count.
- **Hotspot scoring**: group case locations into small rounded lat/lon grid cells; compute a weighted count per cell where more recent weeks get higher weight (e.g., weight = `1 / (weeksAgo + 1)`); return top cells sorted by score for map overlay.
- **Factor breakdown ("explainability")**: for a given prediction, compute and return three percentages that sum to 100 — e.g., contribution from recent 2-week count, contribution from the historical (8-week) baseline, and contribution from the linear trend slope — normalized so they're a sensible breakdown. Label this in the UI as "Why this prediction" so it reads as genuine explainability without needing SHAP or any Python dependency.

## 8. Proactive alerts (`app/api/alerts/route.ts`)

For the MVP (no background job infrastructure needed — keeps things simple and storage-light): compute alerts **on-demand** when this endpoint is called (e.g., when the user opens the Alerts tab, or on a `setInterval` poll from the frontend every 60 seconds). Logic:
- Re-run the trend forecast for every district+crime_type combination with enough data.
- If projected next-week count is >30% above the 8-week average, generate an alert object `{ severity: 'high'|'medium', message: '...', district, crimeType }`.
- Return the list of current alerts; frontend renders them in `AlertsPanel.tsx` with severity color coding.

## 9. Auth & RBAC (`lib/auth.ts`, `app/api/auth/route.ts`, `app/login/page.tsx`)

- MVP-appropriate simplification: a login page lets the user pick a role (Analyst / SHO / SP) from three buttons — no password system needed for a hackathon demo, but structure the code so a real login could be dropped in later.
- On role selection, `app/api/auth/route.ts` issues a signed JWT (use the `jose` npm package, lightweight, no native binaries) containing `{ role }`, stored in an HTTP-only cookie.
- Every API route reads and verifies this JWT server-side before executing role-gated logic (see Section 5, step 4).

## 10. Audit log (`lib/auditLog.ts`)

- `appendAuditLog({ role, queryText, sqlExecuted })`: fetch the last row's `row_hash` from Turso, compute `sha256(prevHash + queryText + sqlExecuted + timestamp)` using Node's built-in `crypto` module, insert the new row.
- Expose a simple read endpoint or admin view (optional stretch) so SP-role users can see the recent audit trail — this is a strong trust-building demo feature, mention it explicitly when the SP role is active.

## 11. PDF export (`app/api/export-pdf/route.ts`)

- Use `@react-pdf/renderer` to generate a simple PDF: header with "KSP Crime Intelligence Assistant — Conversation Export", timestamp, then each message (role + content) in sequence, and the SQL/source-trail for any data-backed answers.
- Return the PDF as a `Blob`/stream response; frontend triggers a download via a button in the chat header.

## 12. Voice integration (`components/VoiceButton.tsx`)

- Use `window.SpeechRecognition || window.webkitSpeechRecognition`; feature-detect and hide the mic button entirely if unsupported (e.g., Firefox).
- `lang = 'en-IN'` by default; add a toggle for `'kn-IN'` for Kannada input where the browser supports it.
- On result: populate the chat input with transcribed text and auto-submit. Handle `onerror`/`onend` gracefully with a toast.
- After the AI answer returns, use `window.speechSynthesis.speak()` to read it aloud, with a UI toggle to turn voice-reply off (default on).
- Always keep a text input fallback visible — never require voice only.

## 13. Frontend UI (`app/page.tsx` + components)

- Tabbed shell: **Chat** (default), **Network**, **Hotspots**, **Alerts** — all four features visible and demoable, not just buried in chat responses.
- Chat tab: message bubbles, mic + text input + send, expandable "Reasoning" section per AI message showing SQL/source trail, a "Export PDF" button in the header, 3 suggested-question chips.
- Network tab: renders `NetworkGraphView.tsx` for the most recently referenced person or a default "show me the most connected persons" view; color nodes by community, size by centrality.
- Hotspots tab: `HotspotMap.tsx` using Leaflet + OpenStreetMap tiles (free, no API key), circle markers sized/colored by hotspot score.
- Alerts tab: `AlertsPanel.tsx` polling `/api/alerts` every 60s, severity-coded list.
- Show the active role (`RoleBadge.tsx`) in the header at all times.
- Tailwind only, no heavy UI kit.

## 14. Environment & secrets

- `.env.local.example`:
  ```
  GEMINI_API_KEY=your_gemini_key_here
  TURSO_DATABASE_URL=libsql://your-db-name.turso.io
  TURSO_AUTH_TOKEN=your_turso_token_here
  JWT_SECRET=any_random_long_string_here
  ```
- Add `.env.local`, `node_modules`, `.next` to `.gitignore`. Note: there is no local DB file to gitignore anymore since Turso is remote.
- README.md must explain, step by step: (a) sign up free at https://turso.tech, install the Turso CLI or use the web dashboard to create a database, copy the URL + auth token; (b) get a free Gemini key at https://aistudio.google.com/apikey; (c) generate a random string for `JWT_SECRET`.

## 15. GitHub + Vercel deployment steps (include exactly in README.md)

1. `git init && git add . && git commit -m "Initial full-feature MVP commit"`
2. Create a GitHub repo: `gh repo create ksp-crime-ai --public --source=. --push` (or create manually on github.com, then `git remote add origin <url> && git push -u origin main`).
3. Go to vercel.com → "Add New Project" → import the GitHub repo.
4. In Vercel → Project Settings → Environment Variables, add all four variables from `.env.local.example` with real values.
5. Deploy. Vercel gives a live URL like `https://ksp-crime-ai.vercel.app` — this is the MVP link to submit.
6. Visit `https://<your-app>.vercel.app/api/seed` once after first deploy to populate Turso with synthetic data.
7. Every future `git push` to `main` auto-redeploys.

## 16. Non-negotiable constraints (repeat back before coding)

- No Python, no pip, no Docker, no Puppeteer/Chromium, no local database file, no downloaded ML model weights.
- Database is Turso (remote, free, SQLite-compatible) — nothing stored on the local disk beyond source code.
- All "AI/ML" beyond the LLM call (network analysis, trend prediction, hotspot scoring, explainability) is implemented in plain JavaScript/TypeScript with small npm packages (`graphology` family) — no scientific Python stack.
- LLM calls go exclusively through the free Google Gemini API — no paid usage.
- Must run locally with `npm install && npm run dev` (after `.env.local` is filled in) and deploy successfully on Vercel's free tier with zero paid add-ons.
- Voice must degrade gracefully to text-only if unsupported by the browser.
- Every one of the four tabs (Chat, Network, Hotspots, Alerts) must be genuinely functional against the seeded synthetic data — not placeholder UI.

Now generate the complete file contents for every file in the project structure above, in order, ready to copy into a new folder. After generating all files, output a final checklist confirming each of the 16 sections above has been implemented.

---
