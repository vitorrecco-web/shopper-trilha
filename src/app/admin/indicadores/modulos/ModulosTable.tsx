"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import type { ModulePerformance } from "@/lib/services/dashboardService";

function passRateTone(passRate: number): "primary" | "warning" | "danger" {
  if (passRate >= 70) return "primary";
  if (passRate >= 40) return "warning";
  return "danger";
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function ModulosTable({ modules }: { modules: ModulePerformance[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return modules;
    return modules.filter((m) => normalize(m.moduleNome).includes(term));
  }, [modules, search]);

  const fieldStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.border}`,
    background: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.font.size.sm,
    width: "100%",
    maxWidth: 320,
  };

  return (
    <div>
      <input
        placeholder="Buscar por nome do módulo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...fieldStyle, marginBottom: theme.space(4) }}
      />

      <div
        style={{
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          background: theme.color.surface,
          boxShadow: theme.shadow.sm,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
          <thead>
            <tr style={{ background: theme.color.bg, textAlign: "left" }}>
              {["Módulo", "Tentativas", "Colaboradores", "Nota média", "Taxa de aprovação"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", color: theme.color.textMuted, fontWeight: 600, fontSize: theme.font.size.xs }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.moduleId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                  <Link
                    href={`/admin/indicadores/modulo/${m.moduleId}`}
                    style={{ color: theme.color.primaryDark, textDecoration: "none" }}
                  >
                    {m.moduleNome}
                  </Link>
                </td>
                <td style={{ padding: "12px 14px" }}>{m.attempts}</td>
                <td style={{ padding: "12px 14px" }}>{m.uniqueUsers}</td>
                <td style={{ padding: "12px 14px" }}>{m.avgScore}%</td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={passRateTone(m.passRate)}>{m.passRate}%</Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: theme.color.textFaint }}>
                  Nenhum módulo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
