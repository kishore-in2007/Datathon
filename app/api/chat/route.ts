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
{"type":"conversational","answer":"..."} otherwise.
SQL must be a single SQLite SELECT using only the schema. Never query audit_log. Use explicit joins and LIMIT 50.
For "this month", use date_reported >= date('now','start of month') and date_reported < date('now','start of month','+1 month').
For counts, return one numeric column aliased as case_count.`;

const empty = { sql: null, rows: [], networkData: null, predictionData: null };

export async function POST(request: NextRequest) {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ answer: "Your session has expired. Please sign in again.", ...empty }, { status: 401 });
  let message = "";
  try {
    const body = await request.json();
    message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!message) return NextResponse.json({ answer: "Please enter a question.", ...empty }, { status: 400 });
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const plan = await callGemini(`${system}\nConversation: ${JSON.stringify(history)}\nQuestion: ${message}`);
    const type = plan.type || (plan.sql ? "sql" : "conversational");
    if (type === "network") {
      if (!canUse(role, "network")) return NextResponse.json({ answer: "Network analysis requires SHO- or SP-level access.", ...empty });
      const networkData = await getNetwork(plan.personName);
      const hub = networkData.nodes.find((node) => node.isHub);
      await appendAuditLog({ role, queryText: message, sqlExecuted: "NETWORK_ANALYSIS" });
      return NextResponse.json({
        answer: networkData.nodes.length
          ? `Found ${networkData.nodes.length} linked persons across ${networkData.edges.length} repeated relationships.${hub ? ` ${hub.name} has the highest betweenness centrality and is a likely network hub.` : ""}`
          : "No repeated-person network matched that request.",
        ...empty, networkData,
      });
    }
    if (type === "predictive") {
      if (!canUse(role, "predictive")) return NextResponse.json({ answer: "Predictive and hotspot analysis requires SP-level access.", ...empty });
      const predictionData = await getPrediction(plan.district, plan.crimeType);
      await appendAuditLog({ role, queryText: message, sqlExecuted: "PREDICTIVE_ANALYSIS" });
      return NextResponse.json({
        answer: `${predictionData.crimeType} in ${predictionData.district} is projected at ${predictionData.projectedNextWeek} cases next week (8-week average: ${predictionData.average}; slope: ${predictionData.slope} cases/week).`,
        ...empty, predictionData,
      });
    }
    if (type === "conversational") return NextResponse.json({ answer: plan.answer || "How can I assist?", ...empty });
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
    const summary = await callGemini(`Summarize these synthetic crime database results for an investigator.
Question: ${message}\nSQL: ${sql}\nRows: ${JSON.stringify(rows)}
Return ONLY JSON {"answer":"concise factual answer"}. Never invent missing facts.`);
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
