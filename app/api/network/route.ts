import { NextResponse } from "next/server";
import { canUse, getSessionRole } from "@/lib/auth";
import { getNetwork } from "@/lib/graphAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canUse(role, "network")) return NextResponse.json({ message: "SHO- or SP-level access is required." }, { status: 403 });
  try {
    const data = await getNetwork(new URL(req.url).searchParams.get("person") || undefined);
    console.log(`[api/network] nodes=${data.nodes.length} edges=${data.edges.length}`);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Network error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
