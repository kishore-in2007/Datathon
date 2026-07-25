import { createClient, type Client } from "@libsql/client";

let client: Client | undefined;
let initialized = false;

export function getDb(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Turso database environment variables are not configured.");
  client = createClient({ url, authToken });
  return client;
}

export async function initDb() {
  if (initialized) return getDb();
  const db = getDb();
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS cases (
        case_id INTEGER PRIMARY KEY AUTOINCREMENT, fir_no TEXT NOT NULL, district TEXT NOT NULL,
        station TEXT NOT NULL, date_reported TEXT NOT NULL, crime_type TEXT NOT NULL,
        status TEXT NOT NULL, narrative TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS persons (
        person_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER,
        gender TEXT, address_area TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS case_persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(case_id),
        person_id INTEGER NOT NULL REFERENCES persons(person_id), role TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS locations (
        location_id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(case_id),
        lat REAL NOT NULL, lon REAL NOT NULL, area_name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS network_edges (
        edge_id INTEGER PRIMARY KEY AUTOINCREMENT, person_a INTEGER NOT NULL REFERENCES persons(person_id),
        person_b INTEGER NOT NULL REFERENCES persons(person_id), shared_case_id INTEGER NOT NULL REFERENCES cases(case_id),
        weight INTEGER DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT, user_role TEXT, query_text TEXT, sql_executed TEXT,
        timestamp TEXT NOT NULL, prev_hash TEXT, row_hash TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS idx_cases_date ON cases(date_reported)",
      "CREATE INDEX IF NOT EXISTS idx_cases_district_crime ON cases(district, crime_type)",
      "CREATE INDEX IF NOT EXISTS idx_case_persons_case ON case_persons(case_id)",
      "CREATE INDEX IF NOT EXISTS idx_network_people ON network_edges(person_a, person_b)",
    ],
    "write",
  );
  initialized = true;
  return db;
}
