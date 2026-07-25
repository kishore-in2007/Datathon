import { NextRequest, NextResponse } from "next/server";
import { isRole, issueToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!isRole(body.role)) return NextResponse.json({ message: "Invalid role." }, { status: 400 });
  const response = NextResponse.json({ ok: true, role: body.role });
  response.cookies.set("ksp_session", await issueToken(body.role), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8,
  });
  response.cookies.set("ksp_role", body.role, {
    httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8,
  });
  return response;
}
