import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canViewIndicadores } from "@/lib/auth/roles";
import { getRecruitmentReport, type RecruitmentReport } from "@/lib/services/recruitmentReportService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { RecrutamentoReport } from "./RecrutamentoReport";

export default async function RecrutamentoIndicadoresPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!canViewIndicadores(session.role)) redirect("/app");

  let report: RecruitmentReport | null = null;
  let failed = false;
  try {
    report = await getRecruitmentReport();
  } catch (err) {
    // Ex: migration 0012 ainda não aplicada.
    console.error("Erro ao montar o relatório de recrutamento:", err instanceof Error ? err.message : err);
    failed = true;
  }

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1180}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Recrutamento Interno" },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Recrutamento Interno</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Aptidão dos candidatos por vaga, a partir do teste de lógica e das fases de área. Duas leituras lado a lado:
          a <b>melhor tentativa</b> de cada módulo e a <b>média de todas as tentativas</b>.
        </p>
        {failed || !report ? (
          <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}>
            Não foi possível carregar o relatório agora. Se a migration 0012 ainda não foi aplicada, aplique-a no
            Supabase.
          </p>
        ) : !report.configured ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
            O Programa de Recrutamento ainda não foi configurado. Um administrador define isso em{" "}
            <b>Painel do Gestor &gt; Recrutamento: vagas e áreas</b>.
          </p>
        ) : (
          <RecrutamentoReport report={report} />
        )}
      </Container>
    </PageShell>
  );
}
