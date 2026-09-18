"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import { trackStatusLabel, type TrackStatus } from "@/lib/services/trackStatus";
import type { ColaboradorPerformance } from "@/lib/services/dashboardService";

const trackStatusTone: Record<TrackStatus, "neutral" | "warning" | "primary"> = {
  sem_modulos: "neutral",
  nao_iniciado: "warning",
  em_andamento: "neutral",
  concluida: "primary",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function ColaboradoresTable({ colaboradores }: { colaboradores: ColaboradorPerformance[] }) {
  const [search, setSearch] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return colaboradores
      .filter((c) => (onlyAttention ? c.modulesFailingOnly > 0 : true))
      .filter((c) => (term ? normalize(`${c.nomeCompleto} ${c.trackNome ?? ""}`).includes(term) : true));
  }, [colaboradores, search, onlyAttention]);

  const fieldStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.border}`,
    background: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.font.size.sm,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: theme.space(3), flexWrap: "wrap", alignItems: "center", marginBottom: theme.space(4) }}>
        <input
          placeholder="Buscar por nome ou trilha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...fieldStyle, width: "100%", maxWidth: 320 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
          <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
          Só quem está travado em algum módulo
        </label>
      </div>

      <div
        className="table-scroll"
        style={{
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          background: theme.color.surface,
          boxShadow: theme.shadow.sm,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.size.sm, minWidth: 760 }}>
          <thead>
            <tr style={{ background: theme.color.bg, textAlign: "left" }}>
              {["Colaborador", "Trilha", "Situação", "Conclusão", "Tentativas de quiz", "Nota média", "Módulos travados"].map(
                (h) => (
                  <th key={h} style={{ padding: "12px 14px", color: theme.color.textMuted, fontWeight: 600, fontSize: theme.font.size.xs }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.userId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                  <Link
                    href={`/admin/indicadores/colaborador/${c.userId}`}
                    style={{ color: theme.color.primaryDark, textDecoration: "none" }}
                  >
                    {c.nomeCompleto}
                  </Link>
                </td>
                <td style={{ padding: "12px 14px" }}>{c.trackNome ?? "—"}</td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={trackStatusTone[c.trackStatus]}>{trackStatusLabel[c.trackStatus]}</Badge>
                </td>
                <td style={{ padding: "12px 14px" }}>{c.completionPercent !== null ? `${c.completionPercent}%` : "—"}</td>
                <td style={{ padding: "12px 14px" }}>{c.quizAttempts}</td>
                <td style={{ padding: "12px 14px" }}>{c.quizAvgScore !== null ? `${c.quizAvgScore}%` : "—"}</td>
                <td style={{ padding: "12px 14px" }}>
                  {c.modulesFailingOnly > 0 ? (
                    <Badge tone="danger">{c.modulesFailingOnly}</Badge>
                  ) : (
                    <span style={{ color: theme.color.textFaint }}>0</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center", color: theme.color.textFaint }}>
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
