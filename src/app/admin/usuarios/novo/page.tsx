import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { listActiveTracks } from "@/lib/repositories/tracksRepository";
import { NewUserForm } from "./NewUserForm";

export default async function NovoUsuarioPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const tracks = await listActiveTracks();

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/admin/usuarios" style={{ color: "#9aa0a6" }}>
          ← Usuários
        </Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Novo usuário</h1>

      {tracks.length === 0 && (
        <p
          style={{
            fontSize: 13,
            color: "#e0b34d",
            background: "#2a2417",
            border: "1px solid #4a3f24",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          Nenhuma trilha ativa cadastrada ainda — isso é populado pela sincronização com o
          Drive (Fase 4/5 do EXECUTION_PLAN.md). Sem uma trilha, não é possível criar um usuário
          aqui.
        </p>
      )}

      <NewUserForm tracks={tracks} />
    </main>
  );
}
