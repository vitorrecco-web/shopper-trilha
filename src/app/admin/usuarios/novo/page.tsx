import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { listActiveTracks } from "@/lib/repositories/tracksRepository";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NewUserForm } from "./NewUserForm";

export default async function NovoUsuarioPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const tracks = await listActiveTracks();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={520}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Usuários", href: "/admin/usuarios" },
            { label: "Novo usuário" },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: theme.space(4) }}>Novo usuário</h1>

        {tracks.length === 0 && (
          <p
            style={{
              fontSize: theme.font.size.sm,
              color: theme.color.warning,
              background: theme.color.warningBg,
              borderRadius: theme.radius.md,
              padding: theme.space(3),
              marginBottom: theme.space(4),
            }}
          >
            Nenhuma trilha ativa cadastrada ainda — isso é populado pela sincronização com o
            Drive. Sem uma trilha, não é possível criar um usuário aqui.
          </p>
        )}

        <NewUserForm tracks={tracks} />
      </Container>
    </PageShell>
  );
}
