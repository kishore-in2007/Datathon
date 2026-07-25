import { NextResponse } from "next/server";
import { canUse, getSessionRole } from "@/lib/auth";
import { getPrediction } from "@/lib/predictiveAnalysis";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canUse(role, "predictive")) return NextResponse.json({ message: "SP-level access is required." }, { status: 403 });
  const url = new URL(request.url);
  try {
    return NextResponse.json(await getPrediction(url.searchParams.get("district") || undefined, url.searchParams.get("crimeType") || undefined));
  } catch (error) {
    console.error("Prediction error:", error);
    return NextResponse.json({ message: "Prediction analysis is temporarily unavailable." }, { status: 500 });
  }
}
