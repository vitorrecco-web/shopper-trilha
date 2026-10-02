import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { RecrutamentoConfigPanel } from "./RecrutamentoConfigPanel";

export default async function RecrutamentoConfigPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={920}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Recrutamento: vagas e áreas" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Recrutamento: vagas e áreas</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Configure como o desempenho dos candidatos vira direcionamento de vaga: qual Programa é o de Recrutamento,
          a <b>área</b> de cada fase (o teste de lógica ou uma área como RC/Logística) e as <b>vagas</b> com suas
          notas de corte. A trilha pode mudar com o tempo (novos módulos conforme as vagas abertas): basta etiquetar
          a fase nova com a área — o histórico dos candidatos e as vagas continuam valendo. Vaga encerrada é
          desativada, nunca apagada.
        </p>
        <RecrutamentoConfigPanel />
      </Container>
    </PageShell>
  );
}
