import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DriveSyncPanel } from "./DriveSyncPanel";

export default async function AdminDrivePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={760}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Drive e sincronização" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Drive e sincronização</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Analisar mostra a estrutura lida do Drive e as mudanças em relação ao banco — nada é
          gravado ainda. Só depois de conferir e clicar em Confirmar as trilhas, fases e módulos
          são criados/atualizados/desativados de verdade.
        </p>
        <DriveSyncPanel />
      </Container>
    </PageShell>
  );
}
