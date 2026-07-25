"use client";

import { useEffect, useState } from "react";
import { AccessMessage, Loading } from "./NetworkGraphView";

type Alert = { severity: "high" | "medium"; message: string; district: string; crimeType: string };

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/alerts").then(async (response) => {
      const value = await response.json(); if (!response.ok) throw new Error(value.message);
      if (active) { setAlerts(value.alerts); setError(""); }
    }).catch((reason) => active && setError(reason.message || "Alerts unavailable."));
    void load(); const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (error) return <AccessMessage text={error} />;
  if (!alerts) return <Loading />;
  if (!alerts.length) return <AccessMessage text="No combinations currently exceed the 30% alert threshold." />;
  return <div className="grid gap-3">{alerts.map((alert, index) => (
    <article key={`${alert.district}-${alert.crimeType}-${index}`} className="flex gap-4 rounded-2xl border bg-white p-5">
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${alert.severity === "high" ? "bg-red-500" : "bg-amber-500"}`} />
      <div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-ink">{alert.district}</b>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${alert.severity === "high" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{alert.severity}</span></div>
        <p className="mt-1 text-sm text-slate-600">{alert.message}</p></div>
    </article>
  ))}</div>;
}
