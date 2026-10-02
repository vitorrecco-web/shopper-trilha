"use client";

import { useMemo, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";

/**
 * Seletor de módulo em acordeão de 2 níveis — Programa (colapsável, igual
 * à tela de Drive/Sincronização) -> Fase/Função -> módulos — compartilhado
 * pelo Editor de Perguntas e por Admin > Conteúdo. A busca filtra por
 * Programa, fase, função ou nome e expande os Programas com resultado.
 */

export interface PickerModule {
  id: string;
  nome: string;
  ordem: number;
  programId: string | null;
  programNome: string | null;
  faseNome: string | null;
  faseOrdem: number;
  phaseType: "common" | "specific_track";
  trackNome: string | null;
}

/** Remove acentos/caixa para busca — usa \p{Diacritic} (ES2018+) em vez de uma faixa de código manual. */
function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function faseLabelFor(m: PickerModule): string {
  return m.phaseType === "common"
    ? m.faseNome ?? "Sem fase"
    : `${m.faseNome ?? "Sem fase"} · ${m.trackNome ?? "Sem trilha"}`;
}

interface FaseGroup<T> {
  label: string;
  items: T[];
}

interface ProgramGroup<T> {
  programId: string;
  programNome: string;
  faseGroups: FaseGroup<T>[];
  count: number;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export function ModulePicker<T extends PickerModule>({
  modules,
  selectedId,
  disabled = false,
  onSelect,
  renderBadges,
}: {
  modules: T[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (m: T) => void;
  renderBadges?: (m: T) => React.ReactNode;
}) {
  const [filter, setFilter] = useState("");
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());

  const programGroups = useMemo<ProgramGroup<T>[]>(() => {
    const term = normalizeSearch(filter.trim());
    const filtered = term
      ? modules.filter((m) =>
          normalizeSearch(`${m.programNome ?? ""} ${m.faseNome ?? ""} ${m.trackNome ?? ""} ${m.nome}`).includes(term)
        )
      : modules;

    const programOrder: string[] = [];
    const programs = new Map<string, { nome: string; faseOrder: string[]; faseMap: Map<string, T[]> }>();

    for (const m of filtered) {
      const pid = m.programId ?? "sem-programa";
      if (!programs.has(pid)) {
        programs.set(pid, { nome: m.programNome ?? "Sem Programa", faseOrder: [], faseMap: new Map() });
        programOrder.push(pid);
      }
      const prog = programs.get(pid)!;
      const faseLabel = faseLabelFor(m);
      if (!prog.faseMap.has(faseLabel)) {
        prog.faseMap.set(faseLabel, []);
        prog.faseOrder.push(faseLabel);
      }
      prog.faseMap.get(faseLabel)!.push(m);
    }

    return programOrder.map((pid) => {
      const prog = programs.get(pid)!;
      const faseGroups = prog.faseOrder.map((label) => ({ label, items: prog.faseMap.get(label)! }));
      return {
        programId: pid,
        programNome: prog.nome,
        faseGroups,
        count: faseGroups.reduce((sum, g) => sum + g.items.length, 0),
      };
    });
  }, [modules, filter]);

  const isSearching = filter.trim().length > 0;

  function toggleProgram(programId: string) {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) next.delete(programId);
      else next.add(programId);
      return next;
    });
  }

  function handleSelect(m: T) {
    if (m.programId) {
      setExpandedPrograms((prev) => new Set(prev).add(m.programId!));
    }
    onSelect(m);
  }

  return (
    <>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Buscar por Programa, fase, trilha ou nome do módulo..."
        style={{ ...inputStyle, marginBottom: 10, maxWidth: 480 }}
      />
      {programGroups.length === 0 ? (
        <p style={{ padding: 12, fontSize: 13, color: theme.color.textMuted, margin: 0 }}>
          {modules.length === 0 ? "Nenhum módulo cadastrado." : "Nenhum módulo encontrado para essa busca."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {programGroups.map((group) => {
            const expanded = isSearching || expandedPrograms.has(group.programId);
            return (
              <div
                key={group.programId}
                style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}
              >
                <button
                  type="button"
                  onClick={() => toggleProgram(group.programId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: theme.color.infoBg,
                    border: "none",
                    padding: "8px 10px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s",
                        color: theme.color.textFaint,
                        fontSize: 11,
                      }}
                    >
                      ▶
                    </span>
                    <b style={{ fontSize: 13, color: theme.color.infoText }}>{group.programNome}</b>
                  </span>
                  <Badge tone="neutral">
                    {group.count} módulo{group.count === 1 ? "" : "s"}
                  </Badge>
                </button>

                {expanded && (
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {group.faseGroups.map((fase) => (
                      <div key={fase.label}>
                        <div
                          style={{
                            background: theme.color.bg,
                            color: theme.color.textMuted,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                            padding: "5px 10px",
                            borderTop: `1px solid ${theme.color.border}`,
                          }}
                        >
                          {fase.label}
                        </div>
                        {fase.items.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelect(m)}
                            disabled={disabled}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              fontSize: 13,
                              fontFamily: "inherit",
                              border: "none",
                              borderTop: `1px solid ${theme.color.border}`,
                              background: m.id === selectedId ? theme.color.primaryLight : "transparent",
                              color: theme.color.text,
                              cursor: disabled ? "default" : "pointer",
                            }}
                          >
                            <span>{m.nome}</span>
                            <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>{renderBadges?.(m)}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
