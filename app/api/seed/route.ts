import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/auth";
import { seedDatabase } from "@/lib/seedData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await getSessionRole();
  if (role !== "sp") return NextResponse.json({ message: "SP-level access is required to seed data." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await seedDatabase()) });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ ok: false, message: "Turso could not be seeded. Check its environment variables." }, { status: 500 });
  }
}
