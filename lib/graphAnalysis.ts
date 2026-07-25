import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import { initDb } from "./db";

export type NetworkData = {
  nodes: { id: string; name: string; community: number; centrality: number; isHub: boolean }[];
  edges: { source: string; target: string; weight: number }[];
};

export async function ensureNetworkEdges() {
  const db = await initDb();
  const existing = await db.execute("SELECT COUNT(*) AS count FROM network_edges");
  const count = Number(existing.rows[0]?.count || 0);
  if (count > 0) return count;

  await db.execute(`
    INSERT INTO network_edges (person_a, person_b, shared_case_id, weight)
    SELECT a.person_id, b.person_id, MIN(a.case_id), COUNT(DISTINCT a.case_id)
    FROM case_persons a
    JOIN case_persons b ON a.case_id = b.case_id AND a.person_id < b.person_id
    GROUP BY a.person_id, b.person_id
  `);
  const rebuilt = await db.execute("SELECT COUNT(*) AS count FROM network_edges");
  return Number(rebuilt.rows[0]?.count || 0);
}

export async function getNetwork(personName?: string): Promise<NetworkData> {
  await ensureNetworkEdges();
  const db = await initDb();
  const result = await db.execute(`
    SELECT ne.person_a, pa.name AS name_a, ne.person_b, pb.name AS name_b, ne.weight
    FROM network_edges ne JOIN persons pa ON pa.person_id=ne.person_a
    JOIN persons pb ON pb.person_id=ne.person_b
    WHERE ne.weight>1 ORDER BY ne.weight DESC LIMIT 250
  `);
  const graph = new Graph({ multi: false, type: "undirected" });
  for (const row of result.rows) {
    const a = String(row.person_a), b = String(row.person_b);
    if (!graph.hasNode(a)) graph.addNode(a, { name: String(row.name_a) });
    if (!graph.hasNode(b)) graph.addNode(b, { name: String(row.name_b) });
    if (!graph.hasEdge(a, b)) graph.addEdge(a, b, { weight: Number(row.weight) });
  }
  if (!graph.order) return { nodes: [], edges: [] };
  const communities = louvain(graph, { getEdgeWeight: "weight" });
  const centralities = betweennessCentrality(graph, { normalized: true });
  let keep = new Set(graph.nodes());
  if (personName) {
    const needle = personName.toLowerCase();
    const found = graph.nodes().find((id) => String(graph.getNodeAttribute(id, "name")).toLowerCase().includes(needle));
    if (found) keep = new Set([found, ...graph.neighbors(found), ...graph.neighbors(found).flatMap((id) => graph.neighbors(id))]);
  }
  const max = Math.max(...Object.values(centralities), 0);
  return {
    nodes: graph.nodes().filter((id) => keep.has(id)).map((id) => ({
      id, name: String(graph.getNodeAttribute(id, "name")), community: communities[id],
      centrality: Number((centralities[id] || 0).toFixed(4)), isHub: max > 0 && centralities[id] === max,
    })),
    edges: graph.edges().map((edge) => {
      const [source, target] = graph.extremities(edge);
      return { source, target, weight: Number(graph.getEdgeAttribute(edge, "weight")) };
    }).filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
  };
}
