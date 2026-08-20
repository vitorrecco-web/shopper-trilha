"use client";

import { useState } from "react";

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

const changeTypeColor: Record<ChangeItem["change_type"], string> = {
  added: "#4ECDC4",
  removed: "#ff8a8a",
  renamed: "#e0b34d",
  reordered: "#7F77DD",
  updated: "#9aa0a6",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const primaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  background: "#4ECDC4",
  color: "#0f1115",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid #2a2d34",
  background: "transparent",
  color: "#f2f2f2",
  fontSize: 14,
  cursor: "pointer",
};

const boxStyle: React.CSSProperties = {
  border: "1px solid #22252b",
  borderRadius: 10,
  padding: 16,
  marginBottom: 12,
};

function ModuleRow({ m }: { m: MappedModule }) {
  const hasMaterial = m.material_type === "youtube" ? Boolean(m.video_drive_id) : Boolean(m.pdf_nome);
  return (
    <div style={{ fontSize: 13, padding: "4px 0", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ color: "#9aa0a6", minWidth: 20 }}>{m.ordem}.</span>
      <span>{m.nome}</span>
      {m.material_type === "youtube" ? (
        <span style={{ color: "#4ECDC4", fontSize: 11 }}>YouTube</span>
      ) : (
        <span style={{ color: "#9aa0a6", fontSize: 11 }}>PDF</span>
      )}
      {!hasMaterial && <span style={{ color: "#ff8a8a", fontSize: 11 }}>sem material</span>}
      {m.has_questions && <span style={{ color: "#4ECDC4", fontSize: 11 }}>com perguntas</span>}
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
        <button onClick={handleAnalyze} disabled={analyzing} style={primaryBtn}>
          {analyzing ? "Analisando..." : "Analisar alterações"}
        </button>
      )}

      {connectionError && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
          {connectionError}
        </p>
      )}
      {structure && !structure.ok && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
          {structure.error}
        </p>
      )}
      {syncPreview && !syncPreview.ok && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
          {syncPreview.error}
        </p>
      )}

      {/* Estrutura lida do Drive agora (visualização preservada) */}
      {structure?.ok && (
        <>
          <p style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 8, marginTop: 4 }}>
            Estrutura lida do Drive agora:
          </p>
          {structure.phases?.map((phase) => (
            <div key={phase.drive_folder_id} style={boxStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>
                  Fase {phase.ordem} — {phase.nome}
                </b>
                <span style={{ fontSize: 11, color: "#9aa0a6" }}>
                  {phase.phase_type === "common" ? "comum" : "por trilha"}
                </span>
              </div>

              {phase.phase_type === "common"
                ? phase.modules.map((m) => <ModuleRow key={m.drive_folder_id} m={m} />)
                : phase.tracks.map((t) => (
                    <div key={t.drive_folder_id} style={{ marginBottom: 8, marginLeft: 8 }}>
                      <div style={{ fontSize: 13, color: "#4ECDC4", marginBottom: 2 }}>{t.nome}</div>
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
          <p style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 16 }}>
            Última sincronização: {syncPreview.lastSync ? formatDate(syncPreview.lastSync.completedAt) : "nunca"}
          </p>

          <div style={boxStyle}>
            <b style={{ fontSize: 14 }}>Mudanças detectadas ({changes.length})</b>
            {changes.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {changes.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: changeTypeColor[c.change_type],
                        border: `1px solid ${changeTypeColor[c.change_type]}`,
                        borderRadius: 999,
                        padding: "1px 8px",
                        minWidth: 72,
                        textAlign: "center",
                      }}
                    >
                      {changeTypeLabel[c.change_type]}
                    </span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#9aa0a6", marginTop: 8 }}>
                Nenhuma mudança — o banco já reflete o Drive.
              </p>
            )}
          </div>

          {/* Avisos preservados: módulo sem PDF, perguntas.json inválido,
              pasta fora do padrão, colisão de ordem, etc — vindos do
              mesmo /api/admin/sync/preview de antes. */}
          <div style={{ ...boxStyle, marginBottom: 20 }}>
            <b style={{ fontSize: 14 }}>Avisos ({warnings.length})</b>
            {warnings.length > 0 ? (
              <ul style={{ fontSize: 12.5, color: "#e0b34d", marginTop: 8, paddingLeft: 18 }}>
                {warnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "#9aa0a6", marginTop: 8 }}>Nenhum aviso.</p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleConfirm} disabled={confirming || changes.length === 0} style={primaryBtn}>
              {confirming ? "Aplicando..." : "Confirmar e sincronizar"}
            </button>
            <button onClick={handleCancel} disabled={confirming} style={secondaryBtn}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {confirmResult && (
        <div
          style={{
            border: `1px solid ${confirmResult.ok ? "#0f3d33" : "#3d1f1f"}`,
            background: confirmResult.ok ? "#0f1a17" : "#1a1212",
            borderRadius: 10,
            padding: 16,
            marginTop: 12,
          }}
        >
          {confirmResult.ok ? (
            <>
              <b style={{ fontSize: 14, color: "#4ECDC4" }}>Sincronização aplicada com sucesso.</b>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                {Object.entries(confirmResult.counts ?? {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            </>
          ) : (
            <>
              <b style={{ fontSize: 14, color: "#ff8a8a" }}>Sincronização com falhas.</b>
              <p style={{ fontSize: 13, marginTop: 8 }}>{confirmResult.error}</p>
            </>
          )}
          {confirmResult.failures && confirmResult.failures.length > 0 && (
            <ul style={{ fontSize: 12.5, color: "#ff8a8a", marginTop: 8, paddingLeft: 18 }}>
              {confirmResult.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <button onClick={() => setConfirmResult(null)} style={{ ...secondaryBtn, marginTop: 12, fontSize: 13 }}>
            Analisar de novo
          </button>
        </div>
      )}
    </div>
  );
}
