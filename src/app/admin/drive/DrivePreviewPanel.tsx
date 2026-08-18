"use client";

import { useState } from "react";

interface MappedModule {
  drive_folder_id: string;
  ordem: number;
  nome: string;
  pdf_nome: string | null;
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

interface PreviewResult {
  ok: boolean;
  phases?: MappedPhase[];
  warnings?: string[];
  error?: string;
}

function ModuleRow({ m }: { m: MappedModule }) {
  return (
    <div style={{ fontSize: 13, padding: "4px 0", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ color: "#9aa0a6", minWidth: 20 }}>{m.ordem}.</span>
      <span>{m.nome}</span>
      {!m.pdf_nome && <span style={{ color: "#ff8a8a", fontSize: 11 }}>sem PDF</span>}
      {m.has_questions && <span style={{ color: "#4ECDC4", fontSize: 11 }}>com perguntas</span>}
    </div>
  );
}

export function DrivePreviewPanel() {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/drive/preview");
      const data = (await res.json()) as PreviewResult;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Erro de conexão. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={loadPreview}
        disabled={loading}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: "#4ECDC4",
          color: "#0f1115",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        {loading ? "Lendo o Drive..." : "Ler estrutura do Drive"}
      </button>

      {result && !result.ok && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
          {result.error}
        </p>
      )}

      {result?.ok && (
        <>
          {result.phases?.map((phase) => (
            <div
              key={phase.drive_folder_id}
              style={{ border: "1px solid #22252b", borderRadius: 10, padding: 16, marginBottom: 12 }}
            >
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

          <div style={{ border: "1px solid #22252b", borderRadius: 10, padding: 16 }}>
            <b style={{ fontSize: 14 }}>Avisos ({result.warnings?.length ?? 0})</b>
            {result.warnings && result.warnings.length > 0 ? (
              <ul style={{ fontSize: 12.5, color: "#e0b34d", marginTop: 8, paddingLeft: 18 }}>
                {result.warnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "#9aa0a6", marginTop: 8 }}>Nenhum aviso.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
