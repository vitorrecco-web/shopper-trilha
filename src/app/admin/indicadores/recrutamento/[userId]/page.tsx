import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canViewIndicadores } from "@/lib/auth/roles";
import { getCandidateDetail } from "@/lib/services/recruitmentReportService";
import type { FitDetail, FitStatus } from "@/lib/services/recruitmentAnalysis";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";
import { Collapsible } from "@/components/ui/Collapsible";
import { HBars, ScoreBar, type BarTone } from "@/components/ui/Charts";
import { fitLabel, fitTone, fmtScore } from "../fitUi";

const cardStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
};
const hint: React.CSSProperties = { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "0 0 12px" };
const bigNumber: React.CSSProperties = { fontSize: theme.font.size.xxl, fontWeight: 700 };
const cardLabel: React.CSSProperties = { fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 };

const barTone: Record<FitStatus, BarTone> = { atinge: "primary", quase: "warning", abaixo: "danger", aguardando: "neutral" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Uma linha "tirou X de mínimo Y" com barra e marcador do corte. */
function FitLine({ title, fit, cutoff, scoreKey }: { title: string; fit: FitDetail; cutoff: number; scoreKey: "logicScore" | "areaScore" }) {
  const score = fit[scoreKey];
  const gap = scoreKey === "logicScore" ? fit.logicGap : fit.areaGap;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: theme.color.textMuted }}>{title}</span>
        <span>
          <b style={{ color: score === null ? theme.color.textFaint : theme.color.text }}>{score === null ? "sem nota" : fmtScore(score)}</b>
          <span style={{ color: theme.color.textMuted }}> de mínimo {fmtScore(cutoff)}</span>
          {gap ? <span style={{ color: theme.color.danger }}> · faltam {fmtScore(gap)}</span> : null}
        </span>
      </div>
      <ScoreBar value={score} marker={cutoff} tone={barTone[fit.status]} />
    </div>
  );
}

export default async function CandidatoRecrutamentoPage({ params }: { params: { userId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!canViewIndicadores(session.role)) redirect("/app");

  const detail = await getCandidateDetail(params.userId).catch(() => null);
  if (!detail) notFound();
  const { analysis } = detail;
  const logicModules = analysis.logic?.modules ?? [];
  const totalAttempts = detail.moduleAttempts.reduce((sum, m) => sum + m.attempts.length, 0);

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1000}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Recrutamento Interno", href: "/admin/indicadores/recrutamento" },
            { label: detail.nome },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>{detail.nome}</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          {[detail.matricula, detail.cd, detail.turno].filter(Boolean).join(" · ") || "—"} ·{" "}
          <Link href={`/admin/indicadores/colaborador/${detail.userId}`} style={{ color: theme.color.primaryDark, fontWeight: 600 }}>
            histórico completo de provas
          </Link>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: theme.space(4), marginBottom: theme.space(4) }}>
          <div style={cardStyle}>
            <div style={{ ...bigNumber, color: theme.color.primaryDark }}>{fmtScore(analysis.logic?.best)}</div>
            <div style={cardLabel}>Nota em lógica — melhor tentativa de cada módulo (de 0 a 100)</div>
          </div>
          <div style={cardStyle}>
            <div style={bigNumber}>{fmtScore(analysis.logic?.avg)}</div>
            <div style={cardLabel}>Nota em lógica — média de todas as tentativas (de 0 a 100)</div>
          </div>
          <div style={cardStyle}>
            <div style={{ ...bigNumber, fontSize: theme.font.size.xl }}>
              {analysis.logicModulesDone}/{analysis.logicModulesExpected || "?"}
            </div>
            <div style={cardLabel}>
              Módulos de lógica feitos {analysis.logicComplete ? "(concluído)" : "(em andamento — ainda sem recomendação definitiva)"}
            </div>
          </div>
        </div>
        <p style={{ ...hint, marginBottom: theme.space(4) }}>
          A nota é o % de acertos nas questões (cada módulo conta pelo número de questões). A &quot;melhor tentativa&quot; usa o melhor resultado de
          cada módulo; a &quot;média&quot; considera todas as tentativas feitas.
        </p>

        <Collapsible
          title="Encaixe por vaga — nota × mínimo exigido"
          summary={analysis.ranking.length > 0 ? `melhor possibilidade: ${analysis.ranking[0].vacancy.nome}` : analysis.logicComplete ? "nenhuma vaga atingida" : "em andamento"}
          defaultOpen
        >
          <p style={hint}>
            Em cada barra o traço escuro marca a nota mínima da vaga. Verde = atinge, amarelo = até 10 pontos abaixo, vermelho = mais de 10 pontos abaixo.
          </p>
          {analysis.fits.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma vaga ativa cadastrada.</p>
          ) : (
            analysis.fits.map((f) => {
              const interested = detail.interests.some((i) => i.vacancyId === f.vacancy.id);
              return (
                <Collapsible
                  key={f.vacancy.id}
                  nested
                  title={
                    <>
                      {f.vacancy.nome}{" "}
                      {interested && <Badge tone="primary">interesse</Badge>}
                    </>
                  }
                  summary={
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <Badge tone={fitTone[f.best.status]}>melhor: {fitLabel[f.best.status]}</Badge>
                      <Badge tone={fitTone[f.avg.status]}>média: {fitLabel[f.avg.status]}</Badge>
                    </span>
                  }
                >
                  <FitLine title="Lógica — melhor tentativa" fit={f.best} cutoff={f.vacancy.logic_cutoff} scoreKey="logicScore" />
                  <FitLine title="Lógica — média de todas as tentativas" fit={f.avg} cutoff={f.vacancy.logic_cutoff} scoreKey="logicScore" />
                  {f.vacancy.area_key && f.vacancy.area_cutoff !== null && (
                    <>
                      <FitLine title={`Área ${f.vacancy.area_key} — melhor tentativa`} fit={f.best} cutoff={f.vacancy.area_cutoff} scoreKey="areaScore" />
                      <FitLine title={`Área ${f.vacancy.area_key} — média`} fit={f.avg} cutoff={f.vacancy.area_cutoff} scoreKey="areaScore" />
                    </>
                  )}
                </Collapsible>
              );
            })
          )}
          {detail.interests.length > 0 && (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, margin: "12px 0 0" }}>
              <b>Vagas de interesse:</b>{" "}
              {detail.interests.map((i) => (
                <Badge key={i.vacancyId} tone={detail.alertVacancyIds.includes(i.vacancyId) ? "warning" : "neutral"}>
                  {i.nome}
                  {!i.active ? " (encerrada)" : ""}
                  {detail.alertVacancyIds.includes(i.vacancyId) ? " — abaixo do corte" : ""}
                </Badge>
              ))}
            </p>
          )}
        </Collapsible>

        <Collapsible title="Teste de lógica por habilidade" summary={`${logicModules.length} módulo${logicModules.length === 1 ? "" : "s"}`}>
          <p style={hint}>
            Barra = melhor tentativa; o traço cinza marca a média de todas as tentativas. Pontos fortes: nota a partir de 80. A desenvolver: abaixo de 60.
          </p>
          {logicModules.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma tentativa registrada ainda.</p>
          ) : (
            <HBars
              labelWidth={230}
              rows={logicModules.map((m) => ({
                key: m.module_id,
                label: (
                  <>
                    {m.module_nome}
                    <div style={{ fontSize: 11, color: theme.color.textFaint }}>
                      {m.attempts} tentativa{m.attempts === 1 ? "" : "s"}
                    </div>
                  </>
                ),
                value: Math.round(m.best * 10) / 10,
                marker2: Math.round(m.avg * 10) / 10,
                valueLabel: `${fmtScore(Math.round(m.best * 10) / 10)} (média ${fmtScore(Math.round(m.avg * 10) / 10)})`,
                tone: m.best >= 80 ? "primary" : m.best >= 60 ? "warning" : "danger",
              }))}
            />
          )}
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, margin: "14px 0 0" }}>
            <b>Pontos fortes:</b> {analysis.strengths.length > 0 ? analysis.strengths.map((m) => m.module_nome).join(" · ") : "—"}
            <br />
            <b>A desenvolver:</b> {analysis.weaknesses.length > 0 ? analysis.weaknesses.map((m) => m.module_nome).join(" · ") : "—"}
          </p>
        </Collapsible>

        {analysis.areas.length > 0 && (
          <Collapsible title="Fases de área (afinidade)" summary={`${analysis.areas.length} área${analysis.areas.length === 1 ? "" : "s"}`}>
            <p style={hint}>Nota do candidato em cada área de vaga (melhor tentativa; o traço cinza é a média).</p>
            <HBars
              labelWidth={200}
              rows={analysis.areas.map((a) => ({
                key: a.area_key,
                label: a.area_label,
                value: a.best,
                marker2: a.avg,
                valueLabel: `${fmtScore(a.best)} (média ${fmtScore(a.avg)})`,
                tone: (a.best ?? 0) >= 80 ? "primary" : (a.best ?? 0) >= 60 ? "warning" : "danger",
              }))}
            />
          </Collapsible>
        )}

        <Collapsible
          title="Respostas questão a questão"
          summary={`${totalAttempts} tentativa${totalAttempts === 1 ? "" : "s"} em ${detail.moduleAttempts.length} módulo${detail.moduleAttempts.length === 1 ? "" : "s"}`}
        >
          <p style={hint}>Abra um módulo, depois uma tentativa, para ver o que o candidato marcou em cada questão e qual era a resposta certa.</p>
          {detail.moduleAttempts.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma tentativa registrada ainda.</p>
          ) : (
            detail.moduleAttempts.map((m) => (
              <Collapsible
                key={m.moduleId}
                nested
                title={
                  <>
                    {m.moduleNome} <span style={{ fontWeight: 400, color: theme.color.textFaint }}>· {m.areaLabel}</span>
                  </>
                }
                summary={`${m.attempts.length} tentativa${m.attempts.length === 1 ? "" : "s"} · melhor ${fmtScore(Math.max(...m.attempts.map((a) => a.score)))}`}
              >
                {m.attempts.map((a, idx) => (
                  <Collapsible
                    key={a.attemptId}
                    nested
                    title={`${idx === 0 ? "Última tentativa" : `Tentativa de ${formatDate(a.submittedAt)}`}`}
                    summary={`${formatDate(a.submittedAt)} · ${a.correctAnswers}/${a.totalQuestions} acertos · nota ${fmtScore(a.score)}`}
                  >
                    {a.questions.length === 0 ? (
                      <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Sem detalhe das questões nesta tentativa.</p>
                    ) : (
                      a.questions.map((q, i) => (
                        <div
                          key={q.id || i}
                          style={{
                            padding: 10,
                            borderRadius: theme.radius.md,
                            background: q.correct ? theme.color.primaryLight : theme.color.dangerBg,
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.color.text }}>
                            {i + 1}. {q.pergunta}
                          </div>
                          <div style={{ fontSize: 13, marginTop: 4, color: theme.color.text }}>
                            <span style={{ fontWeight: 700, color: q.correct ? theme.color.primaryDark : theme.color.danger }}>
                              {q.correct ? "✓ Acertou" : "✗ Errou"}
                            </span>{" "}
                            — marcou: <b>{q.chosenText ?? "(em branco)"}</b>
                            {!q.correct && (
                              <>
                                {" "}
                                · certa: <b>{q.correctText}</b>
                              </>
                            )}
                          </div>
                          {q.explicacao && !q.correct && (
                            <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 4 }}>{q.explicacao}</div>
                          )}
                        </div>
                      ))
                    )}
                  </Collapsible>
                ))}
              </Collapsible>
            ))
          )}
        </Collapsible>

        <Collapsible
          title="Histórico de avaliações (fotografias)"
          summary={detail.history.length > 0 ? `${detail.history.length} registro${detail.history.length === 1 ? "" : "s"}` : "nenhuma ainda"}
        >
          <p style={hint}>
            Cada linha guarda as vagas e os cortes vigentes na data — continua verdadeira mesmo que a trilha ou os cortes mudem depois.
          </p>
          {detail.history.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Ainda sem fotografia (gerada quando o teste de lógica é concluído).
            </p>
          ) : (
            detail.history.map((h) => (
              <div key={h.id} style={{ borderTop: `1px solid ${theme.color.border}`, padding: "10px 0" }}>
                <div style={{ fontSize: theme.font.size.sm, color: theme.color.text }}>
                  <b>{formatDate(h.generatedAt)}</b> — lógica {fmtScore(h.payload.logicBest)} (melhor) / {fmtScore(h.payload.logicAvg)} (média)
                  {h.payload.bestPossibility ? ` · melhor possibilidade: ${h.payload.bestPossibility}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {h.payload.fits.map((f) => (
                    <Badge key={f.vacancyId} tone={fitTone[f.best]}>
                      {f.nome} (mín. {fmtScore(f.logicCutoff)}): {fitLabel[f.best]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </Collapsible>
      </Container>
    </PageShell>
  );
}
