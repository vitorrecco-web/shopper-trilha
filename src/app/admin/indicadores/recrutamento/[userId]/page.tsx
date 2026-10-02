import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canViewIndicadores } from "@/lib/auth/roles";
import { getCandidateDetail } from "@/lib/services/recruitmentReportService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";
import { fitLabel, fitTone, fmtScore } from "../fitUi";

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(4),
};
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: theme.font.size.xs, color: theme.color.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: theme.font.size.sm, color: theme.color.text, verticalAlign: "top" };
const h2: React.CSSProperties = { fontSize: theme.font.size.md, margin: "0 0 10px", color: theme.color.text };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function CandidatoRecrutamentoPage({ params }: { params: { userId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!canViewIndicadores(session.role)) redirect("/app");

  const detail = await getCandidateDetail(params.userId).catch(() => null);
  if (!detail) notFound();
  const { analysis } = detail;

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: theme.space(4), marginBottom: theme.space(4) }}>
          <div style={boxStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.primaryDark }}>{fmtScore(analysis.logic?.best)}</div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Teste de lógica — melhor tentativa</div>
          </div>
          <div style={boxStyle}>
            <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>{fmtScore(analysis.logic?.avg)}</div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Teste de lógica — média de todas as tentativas</div>
          </div>
          <div style={boxStyle}>
            <div style={{ fontSize: theme.font.size.xl, fontWeight: 700 }}>
              {analysis.logicModulesDone}/{analysis.logicModulesExpected || "?"}
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
              Módulos de lógica feitos {analysis.logicComplete ? "(concluído)" : "(em andamento — sem recomendação definitiva)"}
            </div>
          </div>
        </div>

        <div style={boxStyle}>
          <h2 style={h2}>Vagas de interesse × encaixe</h2>
          {detail.interests.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>O candidato ainda não informou vagas de interesse.</p>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {detail.interests.map((i) => {
                const alert = detail.alertVacancyIds.includes(i.vacancyId);
                return (
                  <Badge key={i.vacancyId} tone={alert ? "warning" : "neutral"}>
                    {i.nome}
                    {!i.active ? " (encerrada)" : ""}
                    {alert ? " — abaixo do corte" : ""}
                  </Badge>
                );
              })}
            </div>
          )}
          {analysis.ranking.length > 0 && (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, margin: "12px 0 0" }}>
              <b>Melhor possibilidade:</b> {analysis.ranking.map((r) => r.vacancy.nome).join(", ")}
            </p>
          )}
        </div>

        <div style={boxStyle}>
          <h2 style={h2}>Encaixe por vaga (cortes atuais)</h2>
          {analysis.fits.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma vaga ativa cadastrada.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                    <th style={th}>Vaga</th>
                    <th style={th}>Corte lógica</th>
                    <th style={th}>Área / corte</th>
                    <th style={th}>Melhor tentativa</th>
                    <th style={th}>Média de todas</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.fits.map((f) => (
                    <tr key={f.vacancy.id} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ ...td, fontWeight: 600 }}>{f.vacancy.nome}</td>
                      <td style={td}>{fmtScore(f.vacancy.logic_cutoff)}</td>
                      <td style={td}>
                        {f.vacancy.area_key ? `${f.vacancy.area_key}${f.vacancy.area_cutoff !== null ? ` · ${fmtScore(f.vacancy.area_cutoff)}` : ""}` : "—"}
                      </td>
                      <td style={td}>
                        <Badge tone={fitTone[f.best.status]}>{fitLabel[f.best.status]}</Badge>
                        {f.best.logicGap ? <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}> faltam {fmtScore(f.best.logicGap)} (lógica)</span> : null}
                      </td>
                      <td style={td}>
                        <Badge tone={fitTone[f.avg.status]}>{fitLabel[f.avg.status]}</Badge>
                        {f.avg.logicGap ? <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}> faltam {fmtScore(f.avg.logicGap)} (lógica)</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={boxStyle}>
          <h2 style={h2}>Teste de lógica por habilidade</h2>
          {analysis.logic === null ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma tentativa registrada ainda.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                    <th style={th}>Módulo</th>
                    <th style={th}>Tentativas</th>
                    <th style={th}>Melhor</th>
                    <th style={th}>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.logic.modules.map((m) => (
                    <tr key={m.module_id} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={td}>{m.module_nome}</td>
                      <td style={td}>{m.attempts}</td>
                      <td style={td}>{fmtScore(Math.round(m.best * 10) / 10)}</td>
                      <td style={td}>{fmtScore(Math.round(m.avg * 10) / 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, margin: "12px 0 0" }}>
            <b>Pontos fortes:</b> {analysis.strengths.length > 0 ? analysis.strengths.map((m) => m.module_nome).join(" · ") : "—"}
            <br />
            <b>A desenvolver:</b> {analysis.weaknesses.length > 0 ? analysis.weaknesses.map((m) => m.module_nome).join(" · ") : "—"}
          </p>
        </div>

        {analysis.areas.length > 0 && (
          <div style={boxStyle}>
            <h2 style={h2}>Fases de área (afinidade)</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                    <th style={th}>Área</th>
                    <th style={th}>Módulos</th>
                    <th style={th}>Nota (melhor)</th>
                    <th style={th}>Nota (média)</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.areas.map((a) => (
                    <tr key={a.area_key} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ ...td, fontWeight: 600 }}>{a.area_label}</td>
                      <td style={td}>{a.modules.map((m) => m.module_nome).join(" · ")}</td>
                      <td style={td}>{fmtScore(a.best)}</td>
                      <td style={td}>{fmtScore(a.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={boxStyle}>
          <h2 style={h2}>Histórico de avaliações (fotografias)</h2>
          <p style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "0 0 10px" }}>
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
                      {f.nome} (corte {fmtScore(f.logicCutoff)}): {fitLabel[f.best]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Container>
    </PageShell>
  );
}
