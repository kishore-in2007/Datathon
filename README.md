# KSP Crime Intelligence Assistant

Full-feature, voice-enabled crime intelligence MVP for synthetic State Crime Records Bureau demonstrations. The app supports conversational record search, criminal-network analysis, hotspot and trend prediction, explainable factors, proactive alerts, role-based access, tamper-evident audit logs, and PDF conversation export.

> Synthetic demo records only. AI-assisted findings must be verified before operational use.

## Stack

- Next.js 14 App Router, React, TypeScript, and Tailwind CSS
- Turso/libSQL remote SQLite-compatible database
- Gemini 2.5 Flash through server-side plain `fetch`
- Graphology Louvain communities and betweenness centrality
- Manual TypeScript linear regression and recency-weighted hotspot scoring
- Leaflet with OpenStreetMap tiles
- Browser Web Speech recognition and synthesis
- `jose` JWTs in HTTP-only cookies
- `@react-pdf/renderer` without Chromium

There is no Python, Docker, Puppeteer, local database, downloaded model, or paid add-on.

## 1. Create the free services

### Turso

1. Sign up free at [turso.tech](https://turso.tech).
2. Install the Turso CLI or use its web dashboard.
3. Create a database.
4. Copy its `libsql://...` URL and create/copy an auth token.

The `/api/seed` route creates the schema and 955 deterministic synthetic cases. It plants an eight-week Bengaluru North chain-snatching increase, a recent Mysuru vehicle-theft hotspot, and a repeated nine-person Bengaluru network.

### Gemini

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey). It requires no credit card. Gemini is called only from the server, and the in-memory usage monitor warns after 1,000 calls in a day.

### JWT secret

Generate a long random string of at least 16 characters. For example, use a password manager’s random generator. Do not reuse a real password.

## 2. Configure and run locally

Requirements: Node.js 20 or newer.

```bash
npm install
copy .env.local.example .env.local
```

Fill `.env.local`:

```dotenv
GEMINI_API_KEY=your_gemini_key_here
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your_turso_token_here
JWT_SECRET=any_random_long_string_here
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose the **SP** demo role, and visit [http://localhost:3000/api/seed](http://localhost:3000/api/seed) once.

## Roles

| Role | SQL search | Network | Prediction, hotspots, alerts |
|---|---:|---:|---:|
| Analyst | Yes | No | No |
| SHO | Yes | Yes | No |
| SP | Yes | Yes | Yes |

The selected role is signed into an eight-hour JWT stored in an HTTP-only cookie. The role supplied by the browser in chat data is never trusted for authorization.

## Demo flow

1. Sign in as **SP** and seed once.
2. Ask: “How many chain-snatching cases in Bengaluru North this month?”
3. Expand **Reasoning · view SQL** under the answer.
4. Ask: “Show repeat persons linked across multiple cases,” then open **Network**.
5. Ask: “Predict chain-snatching in Bengaluru North,” then open **Hotspots**.
6. Open **Alerts** to see combinations projected above their eight-week baseline.
7. Export the conversation as PDF.
8. Switch to Analyst to demonstrate server-enforced restrictions.

The Network tab sizes nodes by betweenness centrality, colors Louvain communities, and weights links by shared cases. Hotspot scores use `1 / (weeksAgo + 1)`, and the prediction panel shows three normalized factors that total 100%.

## Trust and safety controls

- SQL is restricted to a single read-only `SELECT`/CTE over allow-listed tables and columns, with a maximum of 50 rows.
- `audit_log` cannot be queried by Gemini-generated SQL.
- Every executed analysis is appended to the Turso audit table with `sha256(previousHash + query + SQL/action + timestamp)`.
- API routes verify the JWT server-side and return graceful errors.
- The API key and Turso credentials exist only in environment variables.
- Voice input is hidden when unsupported; text input always remains available.

## GitHub + Vercel deployment

1. `git init && git add . && git commit -m "Initial full-feature MVP commit"`
2. Create a GitHub repo: `gh repo create ksp-crime-ai --public --source=. --push` (or create manually on github.com, then `git remote add origin <url> && git push -u origin main`).
3. Go to vercel.com → "Add New Project" → import the GitHub repo.
4. In Vercel → Project Settings → Environment Variables, add all four variables from `.env.local.example` with real values.
5. Deploy. Vercel gives a live URL like `https://ksp-crime-ai.vercel.app` — this is the MVP link to submit.
6. Visit `https://<your-app>.vercel.app/api/seed` once after first deploy to populate Turso with synthetic data.
7. Every future `git push` to `main` auto-redeploys.

For the supplied repository:

```bash
git remote add origin https://github.com/kishore-in2007/Datathon.git
git branch -M main
git push -u origin main
```

## Environment and storage

`.env.local`, `node_modules`, `.next`, logs, and Vercel metadata are ignored. No database file is created in the repository. Source remains below the requested 8 MB budget.

## API summary

- `POST /api/auth` — issue a role JWT
- `GET /api/seed` — idempotent schema/data seed, SP only
- `POST /api/chat` — Gemini query planner and role-aware router
- `GET /api/network` — repeated-person graph, SHO/SP
- `GET /api/predict` — trends and hotspots, SP
- `GET /api/alerts` — on-demand alerts, SP; UI polls every 60 seconds
- `POST /api/export-pdf` — authenticated conversation export

Run the production verification with:

```bash
npm run build
```
