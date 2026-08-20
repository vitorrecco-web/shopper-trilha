"use client";

import { useState } from "react";
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
interface StructureResult {
  ok: boolean;
  phases?: MappedPhase[];
  error?: string;
}

/** Tipos do diff — GET /api/admin/sync/preview e POST /api/admin/sync/confirm (Fase 5, inalteradas). */
interface ChangeItem {
  entity_type: "track" | "phase" | "module";
  entity_drive_id: string;
  change_type: "added" | "removed" | "renamed" | "reordered" | "updated";
  label: string;
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

/**
 * Painel único de Drive + sincronização. "Analisar alterações" busca, em
 * paralelo, a estrutura lida do Drive (GET .../drive/preview) e o diff
 * contra o banco (GET .../sync/preview) — nenhuma das duas rotas grava
 * nada. Confirmar/Cancelar continuam exatamente como estavam (POST
 * .../sync/confirm, ou só limpar a tela). Nenhuma regra de
 * sincronização foi alterada aqui, só a apresentação em uma tela só.
 */
export function DriveSyncPanel() {
  const [structure, setStructure] = useState<StructureResult | null>(null);
  const [syncPreview, setSyncPreview] = useState<SyncPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  async function handleAnalyze() {
    setAnalyzing(true);
    setConnectionError(null);
    setConfirmResult(null);
    setStructure(null);
    setSyncPreview(null);
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

  const hasAnalysis = Boolean(structure || syncPreview);
  const changes = syncPreview?.changes ?? [];
  const warnings = syncPreview?.warnings ?? [];

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

      {/* Estrutura lida do Drive agora (visualização preservada) */}
      {structure?.ok && (
        <>
          <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginBottom: 8, marginTop: 4 }}>
            Estrutura lida do Drive agora:
          </p>
          {structure.phases?.map((phase) => (
            <div key={phase.drive_folder_id} style={boxStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>
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
          ))}
        </>
      )}

      {/* Diff contra o banco + avisos + ação de confirmar/cancelar */}
      {syncPreview?.ok && (
        <>
          <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginBottom: theme.space(4) }}>
            Última sincronização: {syncPreview.lastSync ? formatDate(syncPreview.lastSync.completedAt) : "nunca"}
          </p>

          <div style={boxStyle}>
            <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>
              Mudanças detectadas ({changes.length})
            </b>
            {changes.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {changes.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "baseline" }}>
                    <Badge tone={changeTypeTone[c.change_type]}>{changeTypeLabel[c.change_type]}</Badge>
                    <span style={{ color: theme.color.text }}>{c.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: 8 }}>
                Nenhuma mudança — o banco já reflete o Drive.
              </p>
            )}
          </div>

          {/* Avisos preservados: módulo sem PDF, perguntas.json inválido,
              pasta fora do padrão, colisão de ordem, etc — vindos do
              mesmo /api/admin/sync/preview de antes. */}
          <div style={{ ...boxStyle, marginBottom: theme.space(5) }}>
            <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>Avisos ({warnings.length})</b>
            {warnings.length > 0 ? (
              <ul style={{ fontSize: 12.5, color: theme.color.warning, marginTop: 8, paddingLeft: 18 }}>
                {warnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {w}
                  </li>
                ))}
              </ul>
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
