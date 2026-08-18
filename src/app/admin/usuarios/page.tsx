import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { listUsersWithTrack } from "@/lib/repositories/usersRepository";
import { listActiveTracks } from "@/lib/repositories/tracksRepository";
import { computeUserProgress, computeTrackStatus } from "@/lib/services/userProgress";
import { LogoutButton } from "@/components/LogoutButton";
import { UsersTable, type UserRow } from "./UsersTable";

export default async function UsuariosPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const [users, tracks] = await Promise.all([listUsersWithTrack(), listActiveTracks()]);
  const rows: UserRow[] = await Promise.all(
    users.map(async (u) => {
      const progress = await computeUserProgress(u.id, u.track_id);
      return {
        id: u.id,
        nome_completo: u.nome_completo,
        matricula: u.matricula,
        login: u.login,
        track_id: u.track_id,
        track_nome: u.track?.nome ?? "—",
        cd: u.cd,
        turno: u.turno,
        status: u.status,
        last_login_at: u.last_login_at,
        progress,
        trackStatus: computeTrackStatus(progress.percent),
      };
    })
  );

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Usuários</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/admin/usuarios/novo"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "#4ECDC4",
              color: "#0f1115",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            + Novo usuário
          </Link>
          <LogoutButton />
        </div>
      </div>

      <p style={{ fontSize: 13 }}>
        <Link href="/admin" style={{ color: "#9aa0a6" }}>
          ← Painel do Gestor
        </Link>
      </p>

      <UsersTable initialUsers={rows} tracks={tracks.map((t) => ({ id: t.id, nome: t.nome }))} />
    </main>
  );
}
