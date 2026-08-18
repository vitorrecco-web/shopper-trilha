"use client";

import { useState } from "react";

interface ChangeItem {
  entity_type: "track" | "phase" | "module";
  entity_drive_id: string;
  change_type: "added" | "removed" | "renamed" | "reordered" | "updated";
  label: string;
}

interface PreviewResult {
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

export function SyncPanel() {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleAnalyze() {
    setLoadingPreview(true);
    setConfirmResult(null);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/sync/preview");
      const data = (await res.json()) as PreviewResult;
      setPreview(data);
    } catch {
      setPreview({ ok: false, error: "Erro de conexão. Tente novamente." });
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleCancel() {
    // Nada foi gravado no banco na prévia — cancelar é só limpar a tela.
    setPreview(null);
    setConfirmResult(null);
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/sync/confirm", { method: "POST" });
      const data = (await res.json()) as ConfirmResult;
      setConfirmResult(data);
      setPreview(null);
    } catch {
      setConfirmResult({ ok: false, error: "Erro de conexão. Tente novamente." });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div>
      {!preview && !confirmResult && (
        <button
          onClick={handleAnalyze}
          disabled={loadingPreview}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#4ECDC4",
            color: "#0f1115",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {loadingPreview ? "Analisando..." : "Analisar (ler o Drive)"}
        </button>
      )}

      {preview && !preview.ok && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
          {preview.error}
        </p>
      )}

      {preview?.ok && (
        <>
          <p style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 16 }}>
            Última sincronização: {preview.lastSync ? formatDate(preview.lastSync.completedAt) : "nunca"}
          </p>

          <div style={{ border: "1px solid #22252b", borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <b style={{ fontSize: 14 }}>Mudanças detectadas ({preview.changes?.length ?? 0})</b>
            {preview.changes && preview.changes.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {preview.changes.map((c, i) => (
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

          <div style={{ border: "1px solid #22252b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <b style={{ fontSize: 14 }}>Avisos ({preview.warnings?.length ?? 0})</b>
            {preview.warnings && preview.warnings.length > 0 ? (
              <ul style={{ fontSize: 12.5, color: "#e0b34d", marginTop: 8, paddingLeft: 18 }}>
                {preview.warnings.map((w, i) => (
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
            <button
              onClick={handleConfirm}
              disabled={confirming || (preview.changes?.length ?? 0) === 0}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#4ECDC4",
                color: "#0f1115",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {confirming ? "Aplicando..." : "Confirmar e aplicar"}
            </button>
            <button
              onClick={handleCancel}
              disabled={confirming}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #2a2d34",
                background: "transparent",
                color: "#f2f2f2",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
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
          <button
            onClick={() => setConfirmResult(null)}
            style={{
              marginTop: 12,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #2a2d34",
              background: "transparent",
              color: "#f2f2f2",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Analisar de novo
          </button>
        </div>
      )}
    </div>
  );
}
