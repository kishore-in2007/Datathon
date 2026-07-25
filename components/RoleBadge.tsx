import type { Role } from "@/lib/auth";

export default function RoleBadge({ role }: { role: Role }) {
  return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-police">{role}</span>;
}
