import { NextResponse } from "next/server";
import { canUse, getSessionRole } from "@/lib/auth";
import { getPrediction } from "@/lib/predictiveAnalysis";

const districts = ["Bengaluru North", "Bengaluru South", "Mysuru", "Mangaluru", "Hubballi"];
const crimes = ["chain-snatching", "cyber fraud", "theft", "narcotics", "assault", "vehicle theft"];

export const runtime = "nodejs";
export async function GET() {
  const role = await getSessionRole();
  if (!role) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canUse(role, "predictive")) return NextResponse.json({ message: "SP-level access is required." }, { status: 403 });
  try {
    const predictions = await Promise.all(districts.flatMap((district) => crimes.map((crime) => getPrediction(district, crime))));
    const alerts = predictions.filter((item) => item.average >= 2 && item.projectedNextWeek > item.average * 1.3)
      .map((item) => ({
        severity: item.projectedNextWeek > item.average * 1.7 ? "high" : "medium",
        district: item.district, crimeType: item.crimeType,
        message: `${item.crimeType} is projected ${Math.round((item.projectedNextWeek / item.average - 1) * 100)}% above its 8-week average.`,
      }));
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Alerts error:", error);
    return NextResponse.json({ message: "Alerts are temporarily unavailable." }, { status: 500 });
  }
}
