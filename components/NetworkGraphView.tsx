"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { NetworkData } from "@/lib/graphAnalysis";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });
const colors = ["#2563eb", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];
type NetworkNode = NetworkData["nodes"][number];

export default function NetworkGraphView({ initialData }: { initialData?: NetworkData | null }) {
  const [data, setData] = useState<NetworkData | null>(initialData || null);
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();
  const [width, setWidth] = useState(700);

  useEffect(() => {
    const update = () => setWidth(container.current?.clientWidth || 700);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    if (initialData) { setData(initialData); return; }
    fetch("/api/network").then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || value.message);
      setData(value);
    }).catch((reason) => setError(reason.message || "Network unavailable."));
  }, [initialData]);
  useEffect(() => {
    if (!data?.nodes.length || !graphRef.current) return;
    const timer = window.setTimeout(() => graphRef.current?.zoomToFit(400, 40), 250);
    return () => window.clearTimeout(timer);
  }, [data, width]);

  if (error) return <AccessMessage text={error} />;
  if (!data) return <Loading />;
  if (!data.nodes.length) return <AccessMessage text="No repeated-person relationships are available. Seed the database first." />;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
        Node size reflects centrality · colors show Louvain communities · thicker links indicate more shared cases. Click a person for evidence.
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div ref={container} className="h-[480px] w-full overflow-hidden bg-slate-50">
          <ForceGraph2D
            ref={graphRef}
            width={width} height={480} graphData={{ nodes: data.nodes, links: data.edges }}
            nodeLabel={(node) => `${node.name}${node.isHub ? " · likely hub" : ""}`}
            nodeColor={(node) => colors[Number(node.community) % colors.length]}
            nodeVal={(node) => 6 + Number(node.centrality) * 100}
            linkWidth={(link) => Math.min(1 + Number(link.weight), 7)}
            linkColor={() => "#94a3b8"}
            backgroundColor="#f8fafc"
            onNodeClick={(node) => setSelected(node as NetworkNode)}
          />
        </div>
        <aside className="min-h-[220px] border-t border-slate-200 bg-white p-5 lg:h-[480px] lg:border-l lg:border-t-0">
          {selected ? <>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-ink">{selected.name}</h3>
              {selected.isHub && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">Likely hub</span>}
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-xs text-slate-400">Community</dt><dd className="font-semibold">Cluster {selected.community + 1}</dd></div>
              <div><dt className="text-xs text-slate-400">Centrality score</dt><dd className="font-semibold">{selected.centrality.toFixed(4)}</dd></div>
              <div><dt className="text-xs text-slate-400">Connected case IDs</dt>
                <dd className="mt-2 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
                  {selected.caseIds.length ? selected.caseIds.map((id) => <span key={id} className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-police">#{id}</span>) : <span className="text-xs text-slate-400">None found</span>}
                </dd></div>
            </dl>
          </> : <div className="grid h-full place-items-center text-center text-sm text-slate-400">Select a node to inspect its community, centrality, and real connected cases.</div>}
        </aside>
      </div>
    </section>
  );
}

export function Loading() { return <div className="grid h-64 place-items-center rounded-2xl border bg-white text-sm text-slate-500">Loading analysis…</div>; }
export function AccessMessage({ text }: { text: string }) { return <div className="grid h-64 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">{text}</div>; }
