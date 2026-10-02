import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canViewIndicadores } from "@/lib/auth/roles";
import { getModuleUserBreakdown, getAllWrongQuestions } from "@/lib/services/dashboardService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";

function errorRateTone(errorRate: number): "danger" | "warning" | "neutral" {
  if (errorRate >= 60) return "danger";
  if (errorRate >= 30) return "warning";
  return "neutral";
}

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ModuloIndicadorPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!canViewIndicadores(session.role)) redirect("/app");

  const [data, wrongQuestions] = await Promise.all([
    getModuleUserBreakdown(params.id),
    getAllWrongQuestions(params.id),
  ]);
  if (!data) notFound();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={900}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Módulos", href: "/admin/indicadores/modulos" },
            { label: data.moduleNome },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>{data.moduleNome}</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Desempenho por colaborador neste módulo — quem ainda não passou aparece primeiro.
        </p>

        <div style={boxStyle}>
          {data.rows.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Nenhuma tentativa registrada neste módulo ainda.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: theme.color.textFaint, fontSize: theme.font.size.xs }}>
                    <th style={{ padding: "6px 8px" }}>Colaborador</th>
                    <th style={{ padding: "6px 8px" }}>Trilha</th>
                    <th style={{ padding: "6px 8px" }}>Tentativas</th>
                    <th style={{ padding: "6px 8px" }}>Melhor nota</th>
                    <th style={{ padding: "6px 8px" }}>Última nota</th>
                    <th style={{ padding: "6px 8px" }}>Situação</th>
                    <th style={{ padding: "6px 8px" }}>Última tentativa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.userId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>
                        <Link
                          href={`/admin/indicadores/colaborador/${row.userId}`}
                          style={{ color: theme.color.primaryDark, textDecoration: "none" }}
                        >
                          {row.nomeCompleto}
                        </Link>
                      </td>
                      <td style={{ padding: "8px" }}>{row.trackNome ?? "—"}</td>
                      <td style={{ padding: "8px" }}>{row.attempts}</td>
                      <td style={{ padding: "8px" }}>{row.bestScore}%</td>
                      <td style={{ padding: "8px" }}>{row.lastScore}%</td>
                      <td style={{ padding: "8px" }}>
                        <Badge tone={row.passed ? "primary" : "danger"}>
                          {row.passed ? "Aprovado" : "Não aprovado"}
                        </Badge>
                      </td>
                      <td style={{ padding: "8px", color: theme.color.textMuted }}>
                        {formatDate(row.lastAttemptAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <h2 style={{ fontSize: theme.font.size.md, marginTop: theme.space(5), marginBottom: 12, color: theme.color.text }}>
          Perguntas mais erradas deste módulo
        </h2>
        <div style={boxStyle}>
          {wrongQuestions.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Nenhum erro registrado neste módulo ainda.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wrongQuestions.map((q) => (
                <div key={q.questionId} style={{ borderTop: `1px solid ${theme.color.border}`, paddingTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: theme.color.text, fontWeight: 600 }}>
                      {q.pergunta || `Pergunta ${q.questionId}`}
                    </span>
                    <Badge tone={errorRateTone(q.errorRate)}>{q.errorRate}% de erro</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: theme.color.textFaint, marginTop: 2 }}>
                    {q.totalWrong} de {q.totalAnswered} respostas erradas
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
