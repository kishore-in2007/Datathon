"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { NetworkData } from "@/lib/graphAnalysis";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });
const colors = ["#163b65", "#f5a623", "#0f9d76", "#7c3aed", "#dc2626"];

export default function NetworkGraphView({ initialData }: { initialData?: NetworkData | null }) {
  const [data, setData] = useState<NetworkData | null>(initialData || null);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const update = () => setWidth(Math.min(container.current?.clientWidth || 700, 900));
    update(); window.addEventListener("resize", update); return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    if (initialData) { setData(initialData); return; }
    fetch("/api/network").then(async (response) => {
      const value = await response.json(); if (!response.ok) throw new Error(value.message); setData(value);
    }).catch((reason) => setError(reason.message || "Network unavailable."));
  }, [initialData]);
  if (error) return <AccessMessage text={error} />;
  if (!data) return <Loading />;
  if (!data.nodes.length) return <AccessMessage text="No repeated-person relationships are available. Seed the database first." />;
  return (
    <div ref={container} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
      <ForceGraph2D
        width={width} height={520} graphData={{ nodes: data.nodes, links: data.edges }}
        nodeLabel={(node) => `${node.name}${node.isHub ? " · likely hub" : ""}`}
        nodeColor={(node) => colors[Number(node.community) % colors.length]}
        nodeVal={(node) => 5 + Number(node.centrality) * 80}
        linkWidth={(link) => Math.min(1 + Number(link.weight), 7)}
        linkColor={() => "#64748b"}
        backgroundColor="#071525"
      />
      <p className="bg-white px-4 py-3 text-xs text-slate-500">Node size reflects betweenness centrality; color represents Louvain community; edge width reflects shared cases.</p>
    </div>
  );
}

export function Loading() { return <div className="grid h-64 place-items-center rounded-2xl border bg-white text-sm text-slate-500">Loading analysis…</div>; }
export function AccessMessage({ text }: { text: string }) { return <div className="grid h-64 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">{text}</div>; }
