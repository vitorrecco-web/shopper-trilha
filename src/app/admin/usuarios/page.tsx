import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { listUsersWithTrack } from "@/lib/repositories/usersRepository";
import { listActiveTracks } from "@/lib/repositories/tracksRepository";
import { computeUsersProgressBatch, computeTrackStatus } from "@/lib/services/userProgress";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { buttonStyle } from "@/components/ui/Button";
import Link from "next/link";
import { UsersTable, type UserRow } from "./UsersTable";

export default async function UsuariosPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const [users, tracks] = await Promise.all([listUsersWithTrack(), listActiveTracks()]);

  // Antes: 1 chamada de computeUserProgress (2 consultas cada) POR
  // usuário, via Promise.all — 2×N consultas simultâneas ao Supabase.
  // Sob a base real de produção isso é candidato a estourar limite de
  // conexão/timeout. Agora: 2 consultas no total, para qualquer N.
  const progressByUserId = await computeUsersProgressBatch(
    users.map((u) => ({ id: u.id, track_id: u.track_id }))
  );

  const rows: UserRow[] = users.map((u) => {
    const progress = progressByUserId.get(u.id) ?? { totalModules: 0, completedModules: 0, percent: null };
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
  });

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1140}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Usuários" }]} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: theme.space(5),
            gap: theme.space(3),
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ fontSize: theme.font.size.xxl, margin: 0 }}>Usuários</h1>
          <Link href="/admin/usuarios/novo" style={buttonStyle("primary")}>
            + Novo usuário
          </Link>
        </div>

        <UsersTable initialUsers={rows} tracks={tracks.map((t) => ({ id: t.id, nome: t.nome }))} />
      </Container>
    </PageShell>
  );
}
