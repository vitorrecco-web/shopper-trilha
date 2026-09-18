"use client";

import { useMemo, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import type { WrongQuestionStat } from "@/lib/services/dashboardService";

function errorRateTone(errorRate: number): "danger" | "warning" | "neutral" {
  if (errorRate >= 60) return "danger";
  if (errorRate >= 30) return "warning";
  return "neutral";
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function PerguntasErradasTable({ questions }: { questions: WrongQuestionStat[] }) {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const modules = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of questions) seen.set(q.moduleId, q.moduleNome);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [questions]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return questions.filter((q) => {
      if (moduleFilter && q.moduleId !== moduleFilter) return false;
      if (!term) return true;
      return normalize(`${q.pergunta} ${q.moduleNome}`).includes(term);
    });
  }, [questions, search, moduleFilter]);

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
      <div style={{ display: "flex", gap: theme.space(2), flexWrap: "wrap", marginBottom: theme.space(4) }}>
        <input
          placeholder="Buscar por texto da pergunta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...fieldStyle, width: "100%", maxWidth: 320 }}
        />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={fieldStyle}>
          <option value="">Todos os módulos</option>
          {modules.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          background: theme.color.surface,
          boxShadow: theme.shadow.sm,
          padding: theme.space(4),
        }}
      >
        {filtered.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
            Nenhuma pergunta encontrada.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((q) => (
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
    </div>
  );
}
