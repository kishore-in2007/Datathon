import { createHash } from "node:crypto";
import type { Role } from "./auth";
import { initDb } from "./db";

export async function appendAuditLog({
  role,
  queryText,
  sqlExecuted,
}: {
  role: Role;
  queryText: string;
  sqlExecuted: string;
}) {
  const db = await initDb();
  const latest = await db.execute("SELECT row_hash FROM audit_log ORDER BY log_id DESC LIMIT 1");
  const prevHash = String(latest.rows[0]?.row_hash || "");
  const timestamp = new Date().toISOString();
  const rowHash = createHash("sha256").update(prevHash + queryText + sqlExecuted + timestamp).digest("hex");
  await db.execute({
    sql: "INSERT INTO audit_log (user_role,query_text,sql_executed,timestamp,prev_hash,row_hash) VALUES (?,?,?,?,?,?)",
    args: [role, queryText, sqlExecuted, timestamp, prevHash, rowHash],
  });
}
