import ChatWindow from "@/components/ChatWindow";
import { getSessionRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const role = await getSessionRole();
  if (!role) redirect("/login");
  return <ChatWindow role={role} />;
}
