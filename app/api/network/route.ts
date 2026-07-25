import { NextResponse } from "next/server";
import { canUse, getSessionRole } from "@/lib/auth";
import { getNetwork } from "@/lib/graphAnalysis";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canUse(role, "network")) return NextResponse.json({ message: "SHO- or SP-level access is required." }, { status: 403 });
  try {
    return NextResponse.json(await getNetwork(new URL(request.url).searchParams.get("person") || undefined));
  } catch (error) {
    console.error("Network error:", error);
    return NextResponse.json({ message: "Network analysis is temporarily unavailable." }, { status: 500 });
  }
}
