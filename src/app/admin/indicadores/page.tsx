import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getDashboardData } from "@/lib/services/dashboardService";
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

  const data = await getDashboardData();
  const totalAttempts = data.modulePerformance.reduce((sum, m) => sum + m.attempts, 0);

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1100}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Indicadores" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Indicadores</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Visão gerencial agregada — sem desempenho individual de colaboradores nesta primeira versão.
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
              {data.eligibleUsers}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Colaboradores elegíveis
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.text }}>
              {totalAttempts}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Tentativas de quiz registradas
            </div>
          </div>
        </div>

        <div style={boxStyle}>
          <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: 12, color: theme.color.text }}>
            Desempenho por módulo
          </h2>
          {data.modulePerformance.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
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
                  {data.modulePerformance.map((m) => (
                    <tr key={m.moduleId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ padding: "8px", color: theme.color.text, fontWeight: 600 }}>{m.moduleNome}</td>
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
          <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: 12, color: theme.color.text }}>
            Perguntas mais erradas
          </h2>
          {data.topWrongQuestions.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
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
