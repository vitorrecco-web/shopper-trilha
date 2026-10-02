"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import { Collapsible } from "@/components/ui/Collapsible";
import { HBars, StackedBar, ColumnChart, type ColumnBin } from "@/components/ui/Charts";
import type { RecruitmentReport } from "@/lib/services/recruitmentReportService";
import { fmtScore, type FitStatus } from "./fitUi";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const statCardStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
};
const fieldStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  color: theme.color.text,
  fontSize: theme.font.size.sm,
};
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: theme.font.size.xs, color: theme.color.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: theme.font.size.sm, color: theme.color.text, verticalAlign: "top" };
const hint: React.CSSProperties = { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "0 0 12px" };

/** Faixas de nota para o histograma. */
const BINS: Array<{ label: string; from: number; to: number; tone: ColumnBin["tone"] }> = [
  { label: "0-20", from: 0, to: 20, tone: "danger" },
  { label: "20-40", from: 20, to: 40, tone: "danger" },
  { label: "40-60", from: 40, to: 60, tone: "warning" },
  { label: "60-80", from: 60, to: 80, tone: "primary" },
  { label: "80-100", from: 80, to: 100.01, tone: "primary" },
];

function histogram(values: number[]): ColumnBin[] {
  return BINS.map((b) => ({
    key: b.label,
    label: b.label,
    tone: b.tone,
    count: values.filter((v) => v >= b.from && v < b.to).length,
  }));
}

export function RecrutamentoReport({ report }: { report: RecruitmentReport }) {
  const [search, setSearch] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [status, setStatus] = useState<"" | FitStatus>("");
  const [onlyComplete, setOnlyComplete] = useState(false);
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return report.candidates
      .filter((c) => (onlyComplete ? c.logicComplete : true))
      .filter((c) => (onlyAlerts ? c.alertNames.length > 0 : true))
      .filter((c) => (term ? normalize(`${c.nome} ${c.matricula ?? ""} ${c.cd ?? ""}`).includes(term) : true))
      .filter((c) => {
        if (!vacancyId && !status) return true;
        if (vacancyId && status) return c.fitByVacancy[vacancyId] === status;
        if (vacancyId) return vacancyId in c.fitByVacancy;
        return Object.values(c.fitByVacancy).includes(status as FitStatus);
      })
      .sort((a, b) => (b.areaScores.logica?.best ?? b.bestScore ?? -1) - (a.areaScores.logica?.best ?? a.bestScore ?? -1));
  }, [report.candidates, search, vacancyId, status, onlyComplete, onlyAlerts]);

  const completed = report.candidates.filter((c) => c.logicComplete);
  const bestHist = histogram(completed.map((c) => c.bestScore).filter((v): v is number => v !== null));
  const avgHist = histogram(completed.map((c) => c.avgScore).filter((v): v is number => v !== null));
  const alertsCount = report.candidates.filter((c) => c.alertNames.length > 0).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: theme.space(4), marginBottom: theme.space(5) }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>{report.totals.candidates}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "4px 0 8px" }}>Candidatos na trilha</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, borderTop: `1px solid ${theme.color.border}`, paddingTop: 8 }}>
            <b style={{ color: theme.color.text }}>Interessados por vaga:</b>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {report.interestSummary.perVacancy.map((v) => (
                <Badge key={v.id} tone={v.interested > 0 ? "primary" : "neutral"}>
                  {v.nome}: {v.interested}
                </Badge>
              ))}
              <Badge tone="neutral">sem interesse: {report.interestSummary.none}</Badge>
            </div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>
            {report.totals.completed}
            <span style={{ fontSize: theme.font.size.md, color: theme.color.textFaint }}> / {report.totals.candidates}</span>
          </div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Concluíram o teste de lógica</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.primaryDark }}>{fmtScore(report.totals.avgBestScore)}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Nota média em lógica (melhor tentativa de cada módulo)</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>{fmtScore(report.totals.avgAvgScore)}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Nota média em lógica (média de todas as tentativas)</div>
        </div>
      </div>

      <Collapsible
        title="Interesse × aptidão por vaga"
        summary={alertsCount > 0 ? `${alertsCount} candidato${alertsCount === 1 ? "" : "s"} em alerta` : "nenhum alerta"}
      >
        <p style={hint}>
          Para cada vaga: quantos candidatos têm interesse nela e, desses, quantos já atingem a nota de corte (melhor tentativa).
        </p>
        {report.interestSummary.perVacancy.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma vaga ativa cadastrada.</p>
        ) : (
          <HBars
            labelWidth={170}
            rows={report.interestSummary.perVacancy.map((v) => ({
              key: v.id,
              label: v.nome,
              value: v.interested === 0 ? null : Math.round((v.interestedMeeting / v.interested) * 100),
              valueLabel: v.interested === 0 ? "sem interessados" : `${v.interestedMeeting} de ${v.interested} atingem`,
              tone: v.interested === 0 ? "neutral" : v.interestedMeeting === v.interested ? "primary" : v.interestedMeeting === 0 ? "danger" : "warning",
            }))}
          />
        )}
      </Collapsible>

      <Collapsible
        title="Encaixe por vaga"
        summary={`${report.totals.completed} candidato${report.totals.completed === 1 ? "" : "s"} com lógica concluída`}
      >
        <p style={hint}>
          Candidatos com o teste de lógica concluído, nas duas leituras. &quot;Quase&quot; = até 10 pontos abaixo do corte.
        </p>
        {report.tallies.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma vaga ativa cadastrada.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {report.tallies.map((t) => {
              const seg = (r: typeof t.best) => [
                { key: "a", label: "Atinge", value: r.atinge, tone: "primary" as const },
                { key: "q", label: "Quase", value: r.quase, tone: "warning" as const },
                { key: "b", label: "Abaixo", value: r.abaixo, tone: "danger" as const },
              ];
              return (
                <div key={t.id}>
                  <div style={{ fontSize: theme.font.size.sm, fontWeight: 600, color: theme.color.text, marginBottom: 6 }}>{t.nome}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 4 }}>Melhor tentativa</div>
                      <StackedBar segments={seg(t.best)} />
                    </div>
                    <div>
                      <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 4 }}>Média de todas as tentativas</div>
                      <StackedBar segments={seg(t.avg)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Distribuição das notas em lógica" summary="quantos candidatos em cada faixa">
        <p style={hint}>Só candidatos que concluíram o teste de lógica ({completed.length}).</p>
        {completed.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Ninguém concluiu o teste de lógica ainda.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            <div>
              <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 8 }}>Melhor tentativa</div>
              <ColumnChart bins={bestHist} />
            </div>
            <div>
              <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 8 }}>Média de todas as tentativas</div>
              <ColumnChart bins={avgHist} />
            </div>
          </div>
        )}
      </Collapsible>

      <Collapsible
        title="Candidatos"
        summary={`${filtered.length} de ${report.candidates.length}`}
        defaultOpen
      >
        <div style={{ display: "flex", gap: theme.space(3), flexWrap: "wrap", alignItems: "center", marginBottom: theme.space(3) }}>
          <input placeholder="Buscar por nome, matrícula ou CD..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...fieldStyle, width: "100%", maxWidth: 280 }} />
          <select value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} style={fieldStyle}>
            <option value="">Todas as vagas</option>
            {report.vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | FitStatus)} style={fieldStyle}>
            <option value="">Qualquer encaixe</option>
            <option value="atinge">Atinge</option>
            <option value="quase">Quase</option>
            <option value="abaixo">Abaixo</option>
            <option value="aguardando">Aguardando</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
            <input type="checkbox" checked={onlyComplete} onChange={(e) => setOnlyComplete(e.target.checked)} /> Só quem concluiu
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
            <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} /> Só interesse × aptidão em alerta
          </label>
        </div>
        <p style={hint}>
          Nota de cada área = melhor tentativa; a média de todas as tentativas aparece em cinza embaixo. Clique no candidato para ver as
          respostas questão a questão.
        </p>

        <div style={{ overflowX: "auto", border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 + report.areas.length * 90 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.color.border}`, background: theme.color.bg }}>
                <th style={th}>Candidato</th>
                <th style={th}>Vagas de interesse</th>
                <th style={th}>Andamento</th>
                {report.areas.map((a) => (
                  <th key={a.key} style={th}>
                    {a.label}
                  </th>
                ))}
                <th style={th}>Melhor possibilidade</th>
                <th style={th}>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5 + report.areas.length} style={{ ...td, color: theme.color.textMuted }}>
                    Nenhum candidato para esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.userId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                  <td style={td}>
                    <Link href={`/admin/indicadores/recrutamento/${c.userId}`} style={{ color: theme.color.primaryDark, fontWeight: 600, textDecoration: "none" }}>
                      {c.nome}
                    </Link>
                    <div style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint }}>
                      {[c.matricula, c.cd, c.turno].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td style={td}>{c.interestNames.length > 0 ? c.interestNames.join(", ") : <span style={{ color: theme.color.textFaint }}>—</span>}</td>
                  <td style={td}>
                    {c.logicComplete ? (
                      <Badge tone="primary">Concluído</Badge>
                    ) : (
                      <Badge tone="neutral">
                        {c.logicDone}/{c.logicExpected || "?"} módulos
                      </Badge>
                    )}
                  </td>
                  {report.areas.map((a) => {
                    const sc = c.areaScores[a.key];
                    return (
                      <td key={a.key} style={td}>
                        {sc ? (
                          <>
                            <b>{fmtScore(sc.best)}</b>
                            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint }}>média {fmtScore(sc.avg)}</div>
                          </>
                        ) : (
                          <span style={{ color: theme.color.textFaint }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={td}>{c.bestPossibility ?? <span style={{ color: theme.color.textFaint }}>{c.logicComplete ? "nenhuma atinge" : "—"}</span>}</td>
                  <td style={td}>
                    {c.alertNames.length > 0 ? (
                      <Badge tone="warning">Quer {c.alertNames.join(", ")}, abaixo do corte</Badge>
                    ) : (
                      <span style={{ color: theme.color.textFaint }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>
    </div>
  );
}
