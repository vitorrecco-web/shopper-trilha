import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { DriveSyncPanel } from "./DriveSyncPanel";

export default async function AdminDrivePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/admin" style={{ color: "#9aa0a6" }}>
          ← Painel do Gestor
        </Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Drive e sincronização</h1>
      <p style={{ color: "#9aa0a6", fontSize: 13, marginBottom: 20 }}>
        Analisar mostra a estrutura lida do Drive e as mudanças em relação ao banco — nada é
        gravado ainda. Só depois de conferir e clicar em Confirmar as trilhas, fases e módulos
        são criados/atualizados/desativados de verdade.
      </p>
      <DriveSyncPanel />
    </main>
  );
}
