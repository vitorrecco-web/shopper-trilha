import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canViewIndicadores } from "@/lib/auth/roles";
import { getDashboardOverview } from "@/lib/services/dashboardService";
import { trackStatusLabel } from "@/lib/services/trackStatus";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";
import { Collapsible } from "@/components/ui/Collapsible";
import { HBars, type BarTone } from "@/components/ui/Charts";

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

const linkStyle: React.CSSProperties = { color: theme.color.primaryDark, textDecoration: "none", fontWeight: 600 };
const emptyStyle: React.CSSProperties = { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 };

/** Nota mínima de aprovação do quiz (mesmo valor de PASS_RATIO em quizService). */
const PASS_MARK = 70;

function scoreTone(score: number): BarTone {
  if (score >= PASS_MARK) return "primary";
  if (score >= 40) return "warning";
  return "danger";
}

function errorTone(errorRate: number): BarTone {
  if (errorRate >= 60) return "danger";
  if (errorRate >= 30) return "warning";
  return "neutral";
}

export default async function IndicadoresPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!canViewIndicadores(session.role)) redirect("/app");

  const data = await getDashboardOverview();

  const stuck = data.attentionColaboradores.filter((c) => c.modulesFailingOnly > 0).length;

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1100}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Indicadores" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Indicadores</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Visão geral. Cada seção abaixo é um dropdown: clique para abrir. Cada uma mostra só os 5 que mais precisam de
          atenção — use &quot;Ver todos&quot; para a lista completa, com busca e filtros.
        </p>

        <div style={{ ...boxStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>Recrutamento Interno</h2>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: "4px 0 0" }}>
              Aptidão dos candidatos por vaga: nota do teste de lógica, afinidade por área e interesse × aptidão.
            </p>
          </div>
          <Link href="/admin/indicadores/recrutamento" style={linkStyle}>
            Abrir análise →
          </Link>
        </div>

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
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Taxa média de conclusão</div>
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
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.text }}>{data.eligibleUsers}</div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Colaboradores elegíveis</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.text }}>{data.totalAttempts}</div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Tentativas de quiz registradas</div>
          </div>
        </div>

        <Collapsible
          title="Colaboradores que precisam de atenção"
          summary={
            data.attentionColaboradores.length === 0
              ? "ninguém travado"
              : `${data.attentionColaboradores.length} listado${data.attentionColaboradores.length === 1 ? "" : "s"}${stuck > 0 ? ` · ${stuck} travado${stuck === 1 ? "" : "s"}` : ""}`
          }
        >
          {data.attentionColaboradores.length === 0 ? (
            <p style={emptyStyle}>Ninguém travado em nenhum módulo agora — bom sinal.</p>
          ) : (
            <>
              <p style={{ ...emptyStyle, marginBottom: 12 }}>Barra = % da trilha concluída.</p>
              <HBars
                labelWidth={260}
                rows={data.attentionColaboradores.map((c) => ({
                  key: c.userId,
                  label: (
                    <>
                      <Link href={`/admin/indicadores/colaborador/${c.userId}`} style={linkStyle}>
                        {c.nomeCompleto}
                      </Link>
                      <div style={{ fontSize: 11, color: theme.color.textFaint }}>
                        {c.programasNomes.length > 0 ? c.programasNomes.join(", ") : "—"} · {trackStatusLabel[c.trackStatus]}
                      </div>
                      {c.modulesFailingOnly > 0 && (
                        <Badge tone="danger">
                          {c.modulesFailingOnly} módulo{c.modulesFailingOnly === 1 ? "" : "s"} sem passar
                        </Badge>
                      )}
                    </>
                  ),
                  value: c.completionPercent,
                  valueLabel: c.completionPercent !== null ? `${c.completionPercent}%` : "—",
                  tone: c.modulesFailingOnly > 0 ? "danger" : "primary",
                }))}
              />
            </>
          )}
          <p style={{ margin: "14px 0 0" }}>
            <Link href="/admin/indicadores/colaboradores" style={linkStyle}>
              Ver todos →
            </Link>
          </p>
        </Collapsible>

        <Collapsible
          title="Módulos que precisam de atenção"
          summary={data.attentionModules.length === 0 ? "sem tentativas ainda" : `${data.attentionModules.length} listado${data.attentionModules.length === 1 ? "" : "s"}`}
        >
          {data.attentionModules.length === 0 ? (
            <p style={emptyStyle}>Nenhuma tentativa de quiz registrada ainda.</p>
          ) : (
            <>
              <p style={{ ...emptyStyle, marginBottom: 12 }}>
                Barra = nota média dos colaboradores no módulo; o traço escuro marca a nota mínima de aprovação ({PASS_MARK}).
              </p>
              <HBars
                labelWidth={260}
                rows={data.attentionModules.map((m) => ({
                  key: m.moduleId,
                  label: (
                    <>
                      <Link href={`/admin/indicadores/modulo/${m.moduleId}`} style={linkStyle}>
                        {m.moduleNome}
                      </Link>
                      <div style={{ fontSize: 11, color: theme.color.textFaint }}>
                        {m.attempts} tentativa{m.attempts === 1 ? "" : "s"} · {m.uniqueUsers} colaborador{m.uniqueUsers === 1 ? "" : "es"}
                      </div>
                    </>
                  ),
                  value: m.avgScore,
                  marker: PASS_MARK,
                  valueLabel: `${m.avgScore}% · aprov. ${m.passRate}%`,
                  tone: scoreTone(m.avgScore),
                }))}
              />
            </>
          )}
          <p style={{ margin: "14px 0 0" }}>
            <Link href="/admin/indicadores/modulos" style={linkStyle}>
              Ver todos →
            </Link>
          </p>
        </Collapsible>

        <Collapsible
          title="Perguntas mais erradas"
          summary={data.topWrongQuestions.length === 0 ? "sem erros ainda" : `${data.topWrongQuestions.length} listada${data.topWrongQuestions.length === 1 ? "" : "s"}`}
        >
          {data.topWrongQuestions.length === 0 ? (
            <p style={emptyStyle}>Nenhum erro registrado ainda.</p>
          ) : (
            <>
              <p style={{ ...emptyStyle, marginBottom: 12 }}>Barra = % de respostas erradas naquela pergunta.</p>
              <HBars
                labelWidth={380}
                rows={data.topWrongQuestions.map((q) => ({
                  key: `${q.moduleId}::${q.questionId}`,
                  label: (
                    <>
                      <span style={{ fontWeight: 600 }}>{q.pergunta || `Pergunta ${q.questionId}`}</span>
                      <div style={{ fontSize: 11, color: theme.color.textFaint }}>
                        {q.moduleNome} · {q.totalWrong} de {q.totalAnswered} respostas erradas
                      </div>
                    </>
                  ),
                  value: q.errorRate,
                  valueLabel: `${q.errorRate}%`,
                  tone: errorTone(q.errorRate),
                }))}
              />
            </>
          )}
          <p style={{ margin: "14px 0 0" }}>
            <Link href="/admin/indicadores/perguntas" style={linkStyle}>
              Ver todas →
            </Link>
          </p>
        </Collapsible>
      </Container>
    </PageShell>
  );
}
