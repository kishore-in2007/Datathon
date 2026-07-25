import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "analyst" | "sho" | "sp";
const roles: Role[] = ["analyst", "sho", "sp"];

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) throw new Error("JWT_SECRET must be at least 16 characters.");
  return new TextEncoder().encode(value);
}

export function isRole(value: unknown): value is Role {
  return roles.includes(value as Role);
}

export async function issueToken(role: Role) {
  return new SignJWT({ role }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret());
}

export async function getSessionRole(): Promise<Role | null> {
  const token = cookies().get("ksp_session")?.value;
  if (!token) return null;
  try {
    const result = await jwtVerify(token, secret());
    return isRole(result.payload.role) ? result.payload.role : null;
  } catch {
    return null;
  }
}

export function canUse(role: Role, feature: "sql" | "network" | "predictive") {
  if (feature === "sql") return true;
  if (feature === "network") return role === "sho" || role === "sp";
  return role === "sp";
}
