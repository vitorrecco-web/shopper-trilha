import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";

/**
 * "/" é só roteamento — nunca renderiza nada para o usuário (REDESIGN
 * V1, item 2). Os destinos (/login, /app, /admin) já existiam antes;
 * isto só centraliza a decisão em vez de mostrar uma página técnica.
 */
export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  redirect(session.role === "admin" ? "/admin" : "/app");
}
