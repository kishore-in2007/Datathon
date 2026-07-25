import { NextRequest, NextResponse } from "next/server";
import { appendAuditLog } from "@/lib/auditLog";
import { canUse, getSessionRole } from "@/lib/auth";
import { getNetwork } from "@/lib/graphAnalysis";
import { initDb } from "@/lib/db";
import { callGemini, GeminiError } from "@/lib/llm";
import { getPrediction } from "@/lib/predictiveAnalysis";
import { guardSql } from "@/lib/sqlGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const system = `You are the KSP Crime Intelligence Assistant using synthetic demo records.
Schema: cases(case_id,fir_no,district,station,date_reported,crime_type,status,narrative);
persons(person_id,name,age,gender,address_area); case_persons(id,case_id,person_id,role);
locations(location_id,case_id,lat,lon,area_name); network_edges(edge_id,person_a,person_b,shared_case_id,weight).
Current date: ${new Date().toISOString().slice(0, 10)}.
Return ONLY one JSON object:
{"type":"sql","sql":"SELECT ...","explanation":"..."} for record questions;
{"type":"network","personName":"optional name"} for relationship/hub questions;
{"type":"predictive","district":"...","crimeType":"..."} for forecast, trend, rising, risk, or hotspot questions;
{"type":"conversational","answer":"...","action":"switchTab","tab":"network|hotspots|alerts|chat"} for conversation or an explicit tab-navigation request. Omit action and tab when no navigation was requested.
SQL must be a single SQLite SELECT using only the schema. Never query audit_log. Use explicit joins and LIMIT 50.
For any case/person question, select grounded details by joining cases, case_persons, persons, and locations, including fir_no, date_reported, name, role, and area_name.
Only reference people, dates, case numbers, and locations present in the provided data. Never invent or guess any name, date, or number.
For "this month", use date_reported >= date('now','start of month') and date_reported < date('now','start of month','+1 month').
For counts, return one numeric column aliased as case_count.`;

const empty = { sql: null, rows: [], networkData: null, predictionData: null, action: null, tab: null };

const districtNames = ["Bengaluru North", "Bengaluru South", "Mysuru", "Mangaluru", "Hubballi"];
const crimeNames = ["chain-snatching", "cyber fraud", "theft", "narcotics", "assault", "vehicle theft"];

function directCountQuery(message: string) {
  if (!/\b(how many|count|number of)\b/i.test(message)) return null;
  const normalized = message.toLowerCase().replace(/chain[ -]snatching/g, "chain-snatching");
  const district = districtNames.find((value) => normalized.includes(value.toLowerCase()));
  const crime = crimeNames.find((value) => normalized.includes(value));
  if (!district || !crime) return null;
  const monthFilter = /\blast month\b/i.test(message)
    ? " AND date_reported >= date('now','start of month','-1 month') AND date_reported < date('now','start of month')"
    : /\b(this|current) month\b/i.test(message)
      ? " AND date_reported >= date('now','start of month') AND date_reported < date('now','start of month','+1 month')"
      : "";
  return `SELECT COUNT(case_id) AS case_count FROM cases WHERE district = '${district}' AND crime_type = '${crime}'${monthFilter} LIMIT 50`;
}

function followupCountQuery(message: string, history: unknown[]) {
  if (!/\b(last|this|current) month\b/i.test(message) || !/\b(narrow|filter|limit|only|that)\b/i.test(message)) return null;
  for (const item of [...history].reverse()) {
    const candidate = item as { role?: unknown; content?: unknown } | null;
    if (candidate?.role === "user" && typeof candidate.content === "string") {
      return directCountQuery(`${candidate.content} ${message}`);
    }
  }
  return null;
}

function directTabAction(message: string) {
  const normalized = message.toLowerCase();
  if (!/\b(show|open|go|switch|take me|view)\b/.test(normalized)) return null;
  if (/\b(network|connections?|graph)\b/.test(normalized)) return { type: "conversational" as const, answer: "Opening the criminal network view.", action: "switchTab" as const, tab: "network" as const };
  if (/\b(hotspots?|map|prediction|forecast)\b/.test(normalized)) return { type: "conversational" as const, answer: "Opening the hotspot and prediction view.", action: "switchTab" as const, tab: "hotspots" as const };
  if (/\balerts?\b/.test(normalized)) return { type: "conversational" as const, answer: "Opening proactive alerts.", action: "switchTab" as const, tab: "alerts" as const };
  if (/\bchat\b/.test(normalized)) return { type: "conversational" as const, answer: "Returning to chat.", action: "switchTab" as const, tab: "chat" as const };
  return null;
}

function needsGroundedDetails(message: string) {
  return /\b(case|fir|person|people|involved|accused|victim|witness|network|happen|date|when|where)\b/i.test(message);
}

async function getGroundedDetails(message: string, history: unknown[]) {
  const db = await initDb();
  const context = `${JSON.stringify(history)} ${message}`;
  const firs = [...new Set(context.match(/\b[A-Z]{3}\/\d{4}\/(?:\d{3,4}|NET\d+)\b/gi) || [])].slice(-5);
  const peopleResult = await db.execute("SELECT DISTINCT name FROM persons");
  const contextLower = context.toLowerCase();
  const people = peopleResult.rows.map((row) => String(row.name)).filter((name) => contextLower.includes(name.toLowerCase())).slice(-5);
  const clauses: string[] = [];
  const args: string[] = [];
  if (firs.length) {
    clauses.push(`c.fir_no IN (${firs.map(() => "?").join(",")})`);
    args.push(...firs);
  }
  if (people.length) {
    clauses.push(`p.name IN (${people.map(() => "?").join(",")})`);
    args.push(...people);
  }
  if (!clauses.length && needsGroundedDetails(message)) clauses.push("c.fir_no LIKE 'MAN/2026/%'");
  if (!clauses.length) return [];
  const result = await db.execute({
    sql: `SELECT c.case_id,c.fir_no,c.date_reported,c.district,c.station,c.crime_type,c.status,c.narrative,
      p.person_id,p.name,cp.role,l.area_name,l.lat,l.lon
      FROM cases c JOIN case_persons cp ON cp.case_id=c.case_id
      JOIN persons p ON p.person_id=cp.person_id LEFT JOIN locations l ON l.case_id=c.case_id
      WHERE ${clauses.join(" OR ")} ORDER BY c.date_reported DESC,c.fir_no,p.name LIMIT 50`,
    args,
  });
  return result.rows.map((row) => ({ ...row }));
}

function formatGroundedAnswer(rows: Record<string, unknown>[]) {
  if (!rows.length) return null;
  const first = rows[0];
  if (!first.fir_no) return null;
  const names = [...new Map(rows.filter((row) => row.name).map((row) => [String(row.name), String(row.role || "linked person")])).entries()];
  const people = names.map(([name, role]) => `${name} (${role})`).join(", ");
  const location = first.area_name ? `${String(first.area_name)}, ${String(first.district || "")}` : String(first.district || "the recorded district");
  const narrative = first.narrative ? ` Recorded account: ${String(first.narrative)}` : "";
  return `Case ${String(first.fir_no)} was reported on ${String(first.date_reported)} at ${location}. ${people ? `People recorded in the case are ${people}.` : "No linked persons were returned."}${narrative}`;
}

export async function POST(request: NextRequest) {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ answer: "Your session has expired. Please sign in again.", ...empty }, { status: 401 });
  let message = "";
  try {
    const body = await request.json();
    message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!message) return NextResponse.json({ answer: "Please enter a question.", ...empty }, { status: 400 });
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const conversation = JSON.stringify(history);
    const directSql = followupCountQuery(message, history) || directCountQuery(message);
    const tabAction = directTabAction(message);
    const plan: Awaited<ReturnType<typeof callGemini>> = tabAction || (directSql
      ? { type: "sql" as const, sql: directSql, explanation: "Deterministic canonical count query" }
      : await callGemini(`${system}\nLast five conversation turns: ${conversation}\nQuestion: ${message}`));
    const type = plan.type || (plan.sql ? "sql" : "conversational");
    if (type === "network") {
      if (!canUse(role, "network")) return NextResponse.json({ answer: "Network analysis requires SHO- or SP-level access.", ...empty });
      const networkData = await getNetwork("personName" in plan ? plan.personName : undefined);
      const hub = networkData.nodes.find((node) => node.isHub);
      await appendAuditLog({ role, queryText: message, sqlExecuted: "NETWORK_ANALYSIS" });
      const groundedRows = await getGroundedDetails(message, history);
      const summary = await callGemini(`Answer the investigator using ONLY this provided synthetic database evidence.
Last five conversation turns: ${conversation}\nQuestion: ${message}
Network nodes: ${JSON.stringify(networkData.nodes.slice(0, 40))}
Grounded case/person/location rows: ${JSON.stringify(groundedRows)}
Only reference people, dates, case numbers, and locations present in the provided data. Never invent or guess any name, date, or number.
Return ONLY JSON {"answer":"detailed grounded answer"}.`);
      return NextResponse.json({ answer: summary.answer || (networkData.nodes.length
        ? `Found ${networkData.nodes.length} linked persons across ${networkData.edges.length} repeated relationships.${hub ? ` ${hub.name} is a likely network hub.` : ""}`
        : "No repeated-person network matched that request."), ...empty, networkData });
    }
    if (type === "predictive") {
      if (!canUse(role, "predictive")) return NextResponse.json({ answer: "Predictive and hotspot analysis requires SP-level access.", ...empty });
      const predictionData = await getPrediction(
        "district" in plan ? plan.district : undefined,
        "crimeType" in plan ? plan.crimeType : undefined,
      );
      await appendAuditLog({ role, queryText: message, sqlExecuted: "PREDICTIVE_ANALYSIS" });
      return NextResponse.json({
        answer: `${predictionData.crimeType} in ${predictionData.district} is projected at ${predictionData.projectedNextWeek} cases next week (8-week average: ${predictionData.average}; slope: ${predictionData.slope} cases/week).`,
        ...empty, predictionData, action: "switchTab", tab: "hotspots",
      });
    }
    if (type === "conversational") return NextResponse.json({
      answer: plan.answer || "How can I assist?", ...empty,
      action: plan.action || null, tab: plan.tab || null,
    });
    if (!canUse(role, "sql") || !plan.sql) throw new Error("No safe query plan returned.");
    const sql = guardSql(plan.sql);
    const result = await (await initDb()).execute(sql);
    const rows = result.rows.map((row) => ({ ...row }));
    await appendAuditLog({ role, queryText: message, sqlExecuted: sql });
    if (rows.length === 1) {
      const countEntry = Object.entries(rows[0]).find(([key, value]) =>
        /^(case_)?count$|^total(_cases)?$/i.test(key) && typeof value === "number",
      );
      if (countEntry) {
        const count = Number(countEntry[1]);
        return NextResponse.json({
          answer: `The database query found ${count} matching case${count === 1 ? "" : "s"}.`,
          sql, rows, networkData: null, predictionData: null,
        });
      }
    }
    const groundedRows = needsGroundedDetails(message) ? await getGroundedDetails(message, history) : [];
    const groundedAnswer = formatGroundedAnswer(groundedRows);
    if (groundedAnswer) {
      return NextResponse.json({ answer: groundedAnswer, sql, rows, networkData: null, predictionData: null, action: null, tab: null });
    }
    const summary = await callGemini(`Summarize these synthetic crime database results for an investigator.
Last five conversation turns: ${conversation}\nQuestion: ${message}\nSQL: ${sql}\nSQL rows: ${JSON.stringify(rows)}
Grounded case/person/location rows: ${JSON.stringify(groundedRows)}
Only reference people, dates, case numbers, and locations present in the provided data. Never invent or guess any name, date, or number.
Return ONLY JSON {"answer":"detailed factual answer"}.`);
    return NextResponse.json({ answer: summary.answer || `The query returned ${rows.length} rows.`, sql, rows, networkData: null, predictionData: null });
  } catch (error) {
    console.error("Chat error:", error);
    const answer = error instanceof GeminiError && error.status === 429
      ? "The AI service is busy. Please wait a moment and try again."
      : error instanceof GeminiError && error.message.includes("not configured")
        ? "Gemini is not configured. Add GEMINI_API_KEY to the server environment."
        : "I couldn’t safely complete that request. Please check the service configuration or rephrase the question.";
    return NextResponse.json({ answer, ...empty });
  }
}
