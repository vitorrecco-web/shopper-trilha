"use client";

import { useMemo, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/** Tipos da estrutura lida do Drive — GET /api/admin/drive/preview (Fase 4, inalterada). */
interface MappedModule {
  drive_folder_id: string;
  ordem: number;
  nome: string;
  material_type: "pdf" | "youtube";
  pdf_nome: string | null;
  video_drive_id: string | null;
  has_questions: boolean;
}
interface MappedTrack {
  drive_folder_id: string;
  nome: string;
  modules: MappedModule[];
}
interface MappedPhase {
  drive_folder_id: string;
  ordem: number;
  nome: string;
  phase_type: "common" | "specific_track";
  modules: MappedModule[];
  tracks: MappedTrack[];
}
interface MappedProgram {
  drive_folder_id: string;
  nome: string;
  phases: MappedPhase[];
}
interface StructureResult {
  ok: boolean;
  programs?: MappedProgram[];
  error?: string;
}

/** Tipos do diff — GET /api/admin/sync/preview e POST /api/admin/sync/confirm (Fase 5, estendidas com o Programa dono de cada mudança). */
interface ChangeItem {
  entity_type: "program" | "track" | "phase" | "module";
  entity_drive_id: string;
  change_type: "added" | "removed" | "renamed" | "reordered" | "updated";
  label: string;
  program_drive_folder_id: string;
}
interface SyncPreviewResult {
  ok: boolean;
  changes?: ChangeItem[];
  warnings?: string[];
  lastSync?: { status: string; startedAt: string; completedAt: string | null } | null;
  error?: string;
}
interface ConfirmResult {
  ok: boolean;
  counts?: Record<string, number>;
  warnings?: string[];
  failures?: string[];
  error?: string;
}

const changeTypeLabel: Record<ChangeItem["change_type"], string> = {
  added: "Novo",
  removed: "Removido",
  renamed: "Renomeado",
  reordered: "Reordenado",
  updated: "Atualizado",
};

const changeTypeTone: Record<ChangeItem["change_type"], "primary" | "danger" | "warning" | "neutral"> = {
  added: "primary",
  removed: "danger",
  renamed: "warning",
  reordered: "neutral",
  updated: "neutral",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(3),
};

function ModuleRow({ m }: { m: MappedModule }) {
  const hasMaterial = m.material_type === "youtube" ? Boolean(m.video_drive_id) : Boolean(m.pdf_nome);
  return (
    <div style={{ fontSize: 13, padding: "4px 0", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ color: theme.color.textFaint, minWidth: 20 }}>{m.ordem}.</span>
      <span style={{ color: theme.color.text }}>{m.nome}</span>
      <Badge tone={m.material_type === "youtube" ? "primary" : "neutral"}>
        {m.material_type === "youtube" ? "YouTube" : "PDF"}
      </Badge>
      {!hasMaterial && <Badge tone="danger">sem material</Badge>}
      {m.has_questions && <Badge tone="primary">com perguntas</Badge>}
    </div>
  );
}

function ChangeRow({ c }: { c: ChangeItem }) {
  return (
    <div style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "baseline" }}>
      <Badge tone={changeTypeTone[c.change_type]}>{changeTypeLabel[c.change_type]}</Badge>
      <span style={{ color: theme.color.text }}>{c.label}</span>
    </div>
  );
}

interface ProgramGroup {
  drive_folder_id: string;
  nome: string;
  phases: MappedPhase[];
  changes: ChangeItem[];
}

interface WarningGroup {
  key: string;
  programNome: string | null;
  items: string[];
}

/** `mapUniversidadeFromDrive` prefixa cada aviso de dentro de um Programa com `Programa "X" > ...` (trilhaMapper.ts) — usado aqui só para agrupar na UI, sem precisar de nenhum campo estruturado novo vindo da API. Um aviso sem esse prefixo (ex: pasta raiz vazia) cai no grupo "Geral". */
function groupWarnings(warnings: string[]): WarningGroup[] {
  const order: string[] = [];
  const map = new Map<string, { programNome: string | null; items: string[] }>();

  for (const w of warnings) {
    const match = /^Programa "([^"]+)" > ([\s\S]*)$/.exec(w);
    const key = match ? match[1] : "__geral__";
    const detail = match ? match[2] : w;
    if (!map.has(key)) {
      map.set(key, { programNome: match ? match[1] : null, items: [] });
      order.push(key);
    }
    map.get(key)!.items.push(detail);
  }

  return order.map((key) => ({ key, ...map.get(key)! }));
}

/** Seção colapsável de um Programa — junta "estrutura lida" e "mudanças detectadas" daquele Programa só, em vez de duas listas globais gigantes. */
function ProgramSection({
  group,
  expanded,
  onToggle,
}: {
  group: ProgramGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={boxStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              color: theme.color.textFaint,
              fontSize: 12,
            }}
          >
            ▶
          </span>
          <Badge tone="primary">Programa</Badge>
          <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>{group.nome}</b>
        </div>
        <Badge tone={group.changes.length > 0 ? "warning" : "neutral"}>
          {group.changes.length} mudança{group.changes.length === 1 ? "" : "s"}
        </Badge>
      </button>

      {expanded && (
        <div style={{ marginTop: theme.space(3) }}>
          {group.changes.length > 0 && (
            <div style={{ marginBottom: theme.space(3), display: "flex", flexDirection: "column", gap: 6 }}>
              {group.changes.map((c, i) => (
                <ChangeRow key={i} c={c} />
              ))}
            </div>
          )}

          {group.phases.length > 0 ? (
            group.phases.map((phase) => (
              <div key={phase.drive_folder_id} style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(3), marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <b style={{ fontSize: theme.font.size.sm, color: theme.color.text }}>
                    Fase {phase.ordem} — {phase.nome}
                  </b>
                  <span style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint }}>
                    {phase.phase_type === "common" ? "comum" : "por trilha"}
                  </span>
                </div>

                {phase.phase_type === "common"
                  ? phase.modules.map((m) => <ModuleRow key={m.drive_folder_id} m={m} />)
                  : phase.tracks.map((t) => (
                      <div key={t.drive_folder_id} style={{ marginBottom: 8, marginLeft: 8 }}>
                        <div style={{ fontSize: 13, color: theme.color.primaryDark, fontWeight: 600, marginBottom: 2 }}>
                          {t.nome}
                        </div>
                        <div style={{ marginLeft: 12 }}>
                          {t.modules.map((m) => (
                            <ModuleRow key={m.drive_folder_id} m={m} />
                          ))}
                        </div>
                      </div>
                    ))}
              </div>
            ))
          ) : (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Este Programa não foi encontrado nesta leitura do Drive (removido ou renomeado para fora da estrutura).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Seção colapsável de avisos de UM Programa (ou "Geral") — mesmo padrão de `ProgramSection`, para a lista de avisos não ficar uma parede de texto quando há muitos. */
function WarningSection({
  group,
  expanded,
  onToggle,
}: {
  group: WarningGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, marginBottom: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: theme.space(2),
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <b style={{ fontSize: theme.font.size.sm, color: theme.color.text }}>
            {group.programNome ?? "Geral"}
          </b>
        </div>
        <Badge tone="warning">
          {group.items.length} aviso{group.items.length === 1 ? "" : "s"}
        </Badge>
      </button>

      {expanded && (
        <ul style={{ fontSize: 12.5, color: theme.color.warning, margin: 0, padding: `0 ${theme.space(3)} ${theme.space(2)} 30px` }}>
          {group.items.map((w, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Painel único de Drive + sincronização. "Analisar alterações" busca, em
 * paralelo, a estrutura lida do Drive (GET .../drive/preview) e o diff
 * contra o banco (GET .../sync/preview) — nenhuma das duas rotas grava
 * nada. Confirmar/Cancelar continuam exatamente como estavam (POST
 * .../sync/confirm, ou só limpar a tela).
 *
 * A partir da Universidade Shopper (vários Programas), "estrutura lida"
 * e "mudanças detectadas" são agrupadas por Programa num acordeão — uma
 * trilha com muitas fases/módulos deixava de caber numa lista única.
 */
export function DriveSyncPanel() {
  const [structure, setStructure] = useState<StructureResult | null>(null);
  const [syncPreview, setSyncPreview] = useState<SyncPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set());

  async function handleAnalyze() {
    setAnalyzing(true);
    setConnectionError(null);
    setConfirmResult(null);
    setStructure(null);
    setSyncPreview(null);
    setExpanded(new Set());
    setExpandedWarnings(new Set());
    try {
      const [structRes, syncRes] = await Promise.all([
        fetch("/api/admin/drive/preview").then((r) => r.json()),
        fetch("/api/admin/sync/preview").then((r) => r.json()),
      ]);
      setStructure(structRes);
      setSyncPreview(syncRes);
    } catch {
      setConnectionError("Erro de conexão. Tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Nada foi gravado no banco durante a análise — cancelar é só limpar a tela.
  function handleCancel() {
    setStructure(null);
    setSyncPreview(null);
    setConfirmResult(null);
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/sync/confirm", { method: "POST" });
      const data = await res.json();
      setConfirmResult(data);
      setStructure(null);
      setSyncPreview(null);
    } catch {
      setConfirmResult({ ok: false, error: "Erro de conexão. Tente novamente." });
    } finally {
      setConfirming(false);
    }
  }

  function toggleProgram(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWarningGroup(key: string) {
    setExpandedWarnings((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hasAnalysis = Boolean(structure || syncPreview);
  const changes = useMemo(() => syncPreview?.changes ?? [], [syncPreview]);
  const warnings = syncPreview?.warnings ?? [];
  const warningGroups = useMemo(() => groupWarnings(warnings), [warnings]);

  // Junta "estrutura lida" (por Programa) com as mudanças de cada Programa
  // numa lista só — inclui também Programas que só aparecem nas mudanças
  // (ex: removido do Drive, então não vem mais na leitura fresca).
  const programGroups = useMemo<ProgramGroup[]>(() => {
    const byId = new Map<string, ProgramGroup>();
    for (const p of structure?.programs ?? []) {
      byId.set(p.drive_folder_id, { drive_folder_id: p.drive_folder_id, nome: p.nome, phases: p.phases, changes: [] });
    }
    for (const c of changes) {
      const id = c.program_drive_folder_id;
      if (!byId.has(id)) {
        byId.set(id, { drive_folder_id: id, nome: "Programa removido", phases: [], changes: [] });
      }
      byId.get(id)!.changes.push(c);
    }
    return [...byId.values()];
  }, [structure, changes]);

  return (
    <div>
      {!hasAnalysis && !confirmResult && (
        <Button onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? "Analisando..." : "Analisar alterações"}
        </Button>
      )}

      {connectionError && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}>
          {connectionError}
        </p>
      )}
      {structure && !structure.ok && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}>
          {structure.error}
        </p>
      )}
      {syncPreview && !syncPreview.ok && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}>
          {syncPreview.error}
        </p>
      )}

      {structure?.ok && syncPreview?.ok && (
        <>
          <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginBottom: theme.space(2) }}>
            Última sincronização: {syncPreview.lastSync ? formatDate(syncPreview.lastSync.completedAt) : "nunca"}
          </p>
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, marginBottom: theme.space(4) }}>
            <b>Mudanças encontradas ({changes.length})</b> em {programGroups.length} Programa
            {programGroups.length === 1 ? "" : "s"} — clique em um Programa para ver o detalhe.
          </p>

          {programGroups.map((group) => (
            <ProgramSection
              key={group.drive_folder_id}
              group={group}
              expanded={expanded.has(group.drive_folder_id)}
              onToggle={() => toggleProgram(group.drive_folder_id)}
            />
          ))}

          {/* Avisos preservados: módulo sem PDF, perguntas.json inválido,
              pasta fora do padrão, colisão de ordem, etc — vindos do
              mesmo /api/admin/sync/preview de antes. Agrupados por
              Programa (dropdown colapsável) em vez de uma lista única,
              que ficava enorme com muitos Programas. */}
          <div style={{ ...boxStyle, marginBottom: theme.space(5) }}>
            <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>Avisos ({warnings.length})</b>
            {warningGroups.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {warningGroups.map((group) => (
                  <WarningSection
                    key={group.key}
                    group={group}
                    expanded={expandedWarnings.has(group.key)}
                    onToggle={() => toggleWarningGroup(group.key)}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: 8 }}>Nenhum aviso.</p>
            )}
          </div>

          <div style={{ display: "flex", gap: theme.space(2) }}>
            <Button onClick={handleConfirm} disabled={confirming || changes.length === 0}>
              {confirming ? "Aplicando..." : "Confirmar e sincronizar"}
            </Button>
            <Button variant="secondary" onClick={handleCancel} disabled={confirming}>
              Cancelar
            </Button>
          </div>
        </>
      )}

      {confirmResult && (
        <div
          style={{
            border: `1px solid ${confirmResult.ok ? theme.color.primary : theme.color.danger}`,
            background: confirmResult.ok ? theme.color.primaryLight : theme.color.dangerBg,
            borderRadius: theme.radius.lg,
            padding: theme.space(4),
            marginTop: theme.space(3),
          }}
        >
          {confirmResult.ok ? (
            <>
              <b style={{ fontSize: theme.font.size.base, color: theme.color.primaryDark }}>
                Sincronização aplicada com sucesso.
              </b>
              <p style={{ fontSize: theme.font.size.sm, marginTop: 8, color: theme.color.text }}>
                {Object.entries(confirmResult.counts ?? {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            </>
          ) : (
            <>
              <b style={{ fontSize: theme.font.size.base, color: theme.color.danger }}>Sincronização com falhas.</b>
              <p style={{ fontSize: theme.font.size.sm, marginTop: 8, color: theme.color.text }}>
                {confirmResult.error}
              </p>
            </>
          )}
          {confirmResult.failures && confirmResult.failures.length > 0 && (
            <ul style={{ fontSize: 12.5, color: theme.color.danger, marginTop: 8, paddingLeft: 18 }}>
              {confirmResult.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            onClick={() => setConfirmResult(null)}
            style={{ marginTop: theme.space(3), fontSize: theme.font.size.sm }}
          >
            Analisar de novo
          </Button>
        </div>
      )}
    </div>
  );
}
