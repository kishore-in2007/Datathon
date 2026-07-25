"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PredictionData } from "@/lib/predictiveAnalysis";
import { AccessMessage, Loading } from "./NetworkGraphView";

const Map = dynamic(() => import("./LeafletMap"), { ssr: false });

export default function HotspotMap({ initialData }: { initialData?: PredictionData | null }) {
  const [data, setData] = useState<PredictionData | null>(initialData || null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialData) { setData(initialData); return; }
    fetch("/api/predict").then(async (response) => {
      const value = await response.json(); if (!response.ok) throw new Error(value.message); setData(value);
    }).catch((reason) => setError(reason.message || "Hotspots unavailable."));
  }, [initialData]);
  if (error) return <AccessMessage text={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
      <Map hotspots={data.hotspots} />
      <aside className="rounded-2xl border bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wider text-saffron">Next-week forecast</p>
        <div className="mt-2 text-4xl font-black text-police">{data.projectedNextWeek}</div>
        <p className="mt-1 text-xs text-slate-500">{data.crimeType} · {data.district}</p>
        <h3 className="mt-6 text-sm font-bold">Why this prediction</h3>
        <div className="mt-3 space-y-3">{data.factors.map((factor) => (
          <div key={factor.label}><div className="flex justify-between text-xs"><span>{factor.label}</span><b>{factor.percent}%</b></div>
            <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-police" style={{ width: `${factor.percent}%` }} /></div></div>
        ))}</div>
      </aside>
    </div>
  );
}
