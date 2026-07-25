"use client";

import { useState } from "react";
import type { Role } from "@/lib/auth";

const roles: { role: Role; title: string; access: string }[] = [
  { role: "analyst", title: "Analyst", access: "Read-only record queries" },
  { role: "sho", title: "SHO", access: "Records + criminal networks" },
  { role: "sp", title: "SP", access: "Full access + predictions and alerts" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState("");
  async function login(role: Role) {
    setLoading(role);
    setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      if (!response.ok) throw new Error();
      window.location.href = "/";
    } catch {
      setError("Could not start a session. Check the server configuration.");
      setLoading(null);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-police px-4">
      <section className="w-full max-w-3xl rounded-3xl bg-white p-7 shadow-2xl md:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-police font-black text-white">KSP</div>
        <h1 className="mt-5 text-center text-2xl font-bold text-ink">Crime Intelligence Assistant</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Select a demo role to begin an authenticated session.</p>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {roles.map((item) => (
            <button key={item.role} onClick={() => void login(item.role)} disabled={Boolean(loading)}
              className="rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-1 hover:border-saffron hover:shadow-lg disabled:opacity-50">
              <div className="text-lg font-bold text-police">{item.title}</div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{item.access}</div>
              <div className="mt-5 text-xs font-bold text-saffron">{loading === item.role ? "Signing in…" : "Continue →"}</div>
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        <p className="mt-7 text-center text-[11px] text-slate-400">Hackathon role simulation · no production credentials</p>
      </section>
    </main>
  );
}
