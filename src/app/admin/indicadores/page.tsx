import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getDashboardOverview } from "@/lib/services/dashboardService";
import { trackStatusLabel } from "@/lib/services/trackStatus";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(4),
};

const statCardStyle: React.CSSProperties = {
  ...boxStyle,
  marginBottom: 0,
  textAlign: "center",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const linkStyle: React.CSSProperties = { color: theme.color.primaryDark, textDecoration: "none", fontWeight: 600 };

function passRateTone(passRate: number): "primary" | "warning" | "danger" {
  if (passRate >= 70) return "primary";
  if (passRate >= 40) return "warning";
  return "danger";
}

function errorRateTone(errorRate: number): "danger" | "warning" | "neutral" {
  if (errorRate >= 60) return "danger";
  if (errorRate >= 30) return "warning";
  return "neutral";
}

export default async function IndicadoresPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const data = await getDashboardOverview();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1100}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Indicadores" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Indicadores</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Visão geral. Cada seção abaixo mostra só os 5 que mais precisam de atenção — use "ver todos" para a
          lista completa, com busca e filtros.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: theme.space(4),
            marginBottom: theme.space(5),
          }}
        >
          <div style={statCardStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.primaryDark }}>
              {data.completionRate !== null ? `${data.completionRate}%` : "—"}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Taxa média de conclusão
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.text }}>
              {data.overallPassRate !== null ? `${data.overallPassRate}%` : "—"}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Taxa de aprovação geral (todas as provas)
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.text }}>
              {data.eligibleUsers}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Colaboradores elegíveis
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.text }}>
              {data.totalAttempts}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Tentativas de quiz registradas
            </div>
          </div>
        </div>

        <div style={boxStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>
              Colaboradores que precisam de atenção
            </h2>
            <Link href="/admin/indicadores/colaboradores" style={linkStyle}>
              Ver todos →
            </Link>
          </div>
          {data.attentionColaboradores.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Ninguém travado em nenhum módulo agora — bom sinal.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.attentionColaboradores.map((c) => (
                <div
                  key={c.userId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    borderTop: `1px solid ${theme.color.border}`,
                    paddingTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <Link href={`/admin/indicadores/colaborador/${c.userId}`} style={linkStyle}>
                      {c.nomeCompleto}
                    </Link>
                    <span style={{ fontSize: 12, color: theme.color.textFaint, marginLeft: 8 }}>
                      {c.trackNome ?? "—"} · {trackStatusLabel[c.trackStatus]}
                    </span>
                  </div>
                  <span style={{ display: "flex", gap: 6 }}>
                    {c.modulesFailingOnly > 0 && (
                      <Badge tone="danger">
                        {c.modulesFailingOnly} módulo{c.modulesFailingOnly === 1 ? "" : "s"} sem passar
                      </Badge>
                    )}
                    <Badge tone="neutral">{c.completionPercent !== null ? `${c.completionPercent}% concluído` : "—"}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={boxStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>
              Módulos que precisam de atenção
            </h2>
            <Link href="/admin/indicadores/modulos" style={linkStyle}>
              Ver todos →
            </Link>
          </div>
          {data.attentionModules.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Nenhuma tentativa de quiz registrada ainda.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: theme.color.textFaint, fontSize: theme.font.size.xs }}>
                    <th style={{ padding: "6px 8px" }}>Módulo</th>
                    <th style={{ padding: "6px 8px" }}>Tentativas</th>
                    <th style={{ padding: "6px 8px" }}>Colaboradores</th>
                    <th style={{ padding: "6px 8px" }}>Nota média</th>
                    <th style={{ padding: "6px 8px" }}>Taxa de aprovação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attentionModules.map((m) => (
                    <tr key={m.moduleId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>
                        <Link href={`/admin/indicadores/modulo/${m.moduleId}`} style={linkStyle}>
                          {m.moduleNome}
                        </Link>
                      </td>
                      <td style={{ padding: "8px" }}>{m.attempts}</td>
                      <td style={{ padding: "8px" }}>{m.uniqueUsers}</td>
                      <td style={{ padding: "8px" }}>{m.avgScore}%</td>
                      <td style={{ padding: "8px" }}>
                        <Badge tone={passRateTone(m.passRate)}>{m.passRate}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={boxStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>
              Perguntas mais erradas
            </h2>
            <Link href="/admin/indicadores/perguntas" style={linkStyle}>
              Ver todas →
            </Link>
          </div>
          {data.topWrongQuestions.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Nenhum erro registrado ainda.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.topWrongQuestions.map((q) => (
                <div
                  key={`${q.moduleId}::${q.questionId}`}
                  style={{ borderTop: `1px solid ${theme.color.border}`, paddingTop: 8 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: theme.color.text, fontWeight: 600 }}>
                      {q.pergunta || `Pergunta ${q.questionId}`}
                    </span>
                    <Badge tone={errorRateTone(q.errorRate)}>{q.errorRate}% de erro</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: theme.color.textFaint, marginTop: 2 }}>
                    {q.moduleNome} · {q.totalWrong} de {q.totalAnswered} respostas erradas
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
