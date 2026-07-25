import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { getSessionRole } from "@/lib/auth";

export const runtime = "nodejs";
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#102a43" },
  title: { fontSize: 18, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  meta: { color: "#64748b", marginBottom: 18 },
  message: { marginBottom: 12, padding: 10, backgroundColor: "#f1f5f9" },
  role: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#163b65", marginBottom: 4 },
  sql: { marginTop: 6, fontSize: 8, color: "#166534" },
  footer: { marginTop: 18, fontSize: 8, color: "#64748b" },
});

type ExportMessage = { role: string; content: string; sql?: string | null };

export async function POST(request: NextRequest) {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const messages: ExportMessage[] = Array.isArray(body.messages) ? body.messages.slice(0, 100) : [];
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "KSP Crime Intelligence Assistant — Conversation Export"),
      React.createElement(Text, { style: styles.meta }, `${new Date().toLocaleString("en-IN")} · Role: ${role.toUpperCase()}`),
      ...messages.map((message, index) =>
        React.createElement(
          View,
          { key: index, style: styles.message },
          React.createElement(Text, { style: styles.role }, String(message.role).toUpperCase()),
          React.createElement(Text, null, String(message.content).slice(0, 5000)),
          message.sql ? React.createElement(Text, { style: styles.sql }, `Source SQL: ${message.sql}`) : null,
        ),
      ),
      React.createElement(Text, { style: styles.footer }, "Synthetic demo data · Verify AI-assisted findings before operational use."),
    ),
  );
  const pdf = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ksp-conversation.pdf"' },
  });
}
