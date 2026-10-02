"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import type { RecruitmentReport } from "@/lib/services/recruitmentReportService";
import { fitLabel, fitTone, fmtScore, type FitStatus } from "./fitUi";

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
const boxStyle: React.CSSProperties = { ...statCardStyle, marginBottom: theme.space(4) };
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
      .sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
  }, [report.candidates, search, vacancyId, status, onlyComplete, onlyAlerts]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: theme.space(4), marginBottom: theme.space(5) }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>{report.totals.candidates}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Candidatos na trilha</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>{report.totals.completed}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Concluíram o teste de lógica</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700, color: theme.color.primaryDark }}>{fmtScore(report.totals.avgBestScore)}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Nota média (melhor tentativa)</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: theme.font.size.xxl, fontWeight: 700 }}>{fmtScore(report.totals.avgAvgScore)}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Nota média (todas as tentativas)</div>
        </div>
      </div>

      <div style={boxStyle}>
        <h2 style={{ fontSize: theme.font.size.md, margin: "0 0 4px", color: theme.color.text }}>Encaixe por vaga</h2>
        <p style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "0 0 12px" }}>
          Candidatos com o teste de lógica concluído, nas duas leituras. &quot;Quase&quot; = até 10 pontos abaixo do corte.
        </p>
        {report.tallies.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma vaga ativa cadastrada.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <th style={th}>Vaga</th>
                  <th style={th}>Melhor tentativa (atinge / quase / abaixo)</th>
                  <th style={th}>Média de todas (atinge / quase / abaixo)</th>
                </tr>
              </thead>
              <tbody>
                {report.tallies.map((t) => (
                  <tr key={t.id} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{t.nome}</td>
                    <td style={td}>
                      <Badge tone="primary">{t.best.atinge}</Badge> <Badge tone="warning">{t.best.quase}</Badge> <Badge tone="danger">{t.best.abaixo}</Badge>
                    </td>
                    <td style={td}>
                      <Badge tone="primary">{t.avg.atinge}</Badge> <Badge tone="warning">{t.avg.quase}</Badge> <Badge tone="danger">{t.avg.abaixo}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: theme.space(3), flexWrap: "wrap", alignItems: "center", marginBottom: theme.space(4) }}>
        <input placeholder="Buscar por nome, matrícula ou CD..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...fieldStyle, width: "100%", maxWidth: 300 }} />
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

      <div style={{ ...statCardStyle, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
              <th style={th}>Candidato</th>
              <th style={th}>Vagas de interesse</th>
              <th style={th}>Andamento</th>
              <th style={th}>Nota (melhor)</th>
              <th style={th}>Nota (média)</th>
              <th style={th}>Melhor possibilidade</th>
              <th style={th}>Alerta</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, color: theme.color.textMuted }}>
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
                <td style={td}>{fmtScore(c.bestScore)}</td>
                <td style={td}>{fmtScore(c.avgScore)}</td>
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
      <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginTop: 8 }}>
        Legenda de encaixe: <Badge tone={fitTone.atinge}>{fitLabel.atinge}</Badge> <Badge tone={fitTone.quase}>{fitLabel.quase}</Badge>{" "}
        <Badge tone={fitTone.abaixo}>{fitLabel.abaixo}</Badge> <Badge tone={fitTone.aguardando}>{fitLabel.aguardando}</Badge> — no detalhe de cada
        candidato.
      </p>
    </div>
  );
}
