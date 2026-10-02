import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getCandidateSummaryFor } from "@/lib/services/recruitmentReportService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

const cardStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(3),
};
const h2Style: React.CSSProperties = { fontSize: theme.font.size.md, margin: "0 0 8px", color: theme.color.text };

/**
 * Resumo do candidato ao concluir o teste de lógica: melhores possibilidades,
 * pontos fortes e o que treinar. Tom positivo e SEM notas de corte.
 */
export default async function ResumoRecrutamentoPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");
  if (user.role !== "student") redirect("/app");

  const summary = await getCandidateSummaryFor(user.id).catch(() => null);
  if (!summary) redirect("/app");

  return (
    <PageShell>
      <Header homeHref="/app" />
      <Container maxWidth={600}>
        <Breadcrumb items={[{ label: "Minha Trilha", href: "/app" }, { label: "Meu resumo de vagas" }]} />

        {!summary.available ? (
          <div style={cardStyle}>
            <h1 style={{ fontSize: theme.font.size.xl, margin: "0 0 8px" }}>{summary.headline}</h1>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: "0 0 12px" }}>
              Seu resumo aparece quando você faz todos os módulos do teste de lógica
              {summary.modulesMissing > 0
                ? ` — ${summary.modulesMissing === 1 ? "falta 1 módulo" : `faltam ${summary.modulesMissing} módulos`}.`
                : "."}
            </p>
            <Link href="/app" style={{ color: theme.color.primaryDark, fontWeight: 600 }}>
              ← Voltar para Minha Trilha
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: theme.font.size.xl, margin: "0 0 4px", color: theme.color.text }}>{summary.headline}</h1>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: `0 0 ${theme.space(5)}` }}>
              Olá, {user.nome_completo}. Veja como foi o seu desempenho.
            </p>

            {summary.possibilities.length > 0 && (
              <div style={cardStyle}>
                <h2 style={h2Style}>Melhores possibilidades para você</h2>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: theme.font.size.sm, color: theme.color.text }}>
                  {summary.possibilities.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={cardStyle}>
              <h2 style={h2Style}>Seus pontos fortes</h2>
              {summary.strengths.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: theme.font.size.sm, color: theme.color.text }}>
                  {summary.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
                  Você tem espaço para crescer em todas as áreas — continue treinando, os testes podem ser refeitos.
                </p>
              )}
            </div>

            {(summary.toTrain.length > 0 || summary.growth.length > 0) && (
              <div style={cardStyle}>
                <h2 style={h2Style}>Para ampliar suas opções</h2>
                {summary.toTrain.length > 0 && (
                  <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, margin: "0 0 8px" }}>
                    Vale treinar mais: <b>{summary.toTrain.join(", ")}</b>. Você pode refazer os módulos quando quiser.
                  </p>
                )}
                {summary.growth.map((g) => (
                  <p key={g.vacancy} style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: "0 0 6px" }}>
                    Para chegar mais perto da vaga <b>{g.vacancy}</b>, reforce o treino acima.
                  </p>
                ))}
              </div>
            )}

            <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, margin: `${theme.space(2)} 0 ${theme.space(4)}` }}>
              {summary.disclaimer}
            </p>
            <Link href="/app" style={{ color: theme.color.primaryDark, fontWeight: 600 }}>
              ← Voltar para Minha Trilha
            </Link>
          </>
        )}
      </Container>
    </PageShell>
  );
}
