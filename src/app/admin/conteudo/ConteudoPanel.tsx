"use client";

import { useEffect, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModulePicker, type PickerModule } from "../_components/ModulePicker";

interface ModuleOption extends PickerModule {
  materialType: "pdf" | "youtube";
  hasMaterial: boolean;
  videoExternalId: string | null;
  active: boolean;
}

type Kind = "pdf" | "pptx" | "youtube";

const MAX_MB: Record<"pdf" | "pptx", number> = { pdf: 25, pptx: 50 };

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(4),
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: theme.font.size.xs,
  color: theme.color.textMuted,
  marginBottom: 4,
  fontWeight: 600,
};

const kindLabels: Record<Kind, string> = {
  pdf: "Enviar PDF",
  pptx: "Enviar PowerPoint",
  youtube: "Link do YouTube",
};

/** O PDF/PowerPoint vai direto do navegador para o Drive (XHR, para ter barra de progresso). */
function putFile(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.id) resolve({ id: data.id });
          else reject(new Error("O Drive não confirmou o arquivo enviado."));
        } catch {
          reject(new Error("Resposta inesperada do Drive ao enviar o arquivo."));
        }
      } else {
        reject(new Error(`O Drive recusou o envio (código ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de conexão durante o envio do arquivo."));
    xhr.send(file);
  });
}

export function ConteudoPanel() {
  const [modules, setModules] = useState<ModuleOption[] | null>(null);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const [kind, setKind] = useState<Kind>("pdf");
  const [titulo, setTitulo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/perguntas/modulos");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setModulesError(data.error ?? "Não foi possível listar os módulos agora.");
          return;
        }
        setModules(data.modules ?? []);
      } catch {
        if (!cancelled) setModulesError("Erro de conexão.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = modules?.find((m) => m.id === selectedId) ?? null;

  function handleSelect(m: ModuleOption) {
    setSelectedId(m.id);
    setTitulo(m.hasMaterial ? m.nome : "");
    setFile(null);
    setUrl("");
    setConfirming(false);
    setResult(null);
    setProgress(0);
    setPhase(null);
  }

  function handleKindChange(next: Kind) {
    setKind(next);
    setFile(null);
    setConfirming(false);
    setResult(null);
  }

  const canSubmit =
    !busy && Boolean(selected) && titulo.trim().length > 0 && (kind === "youtube" ? url.trim().length > 0 : Boolean(file));

  function describeCurrent(m: ModuleOption): string {
    if (!m.hasMaterial) return "Sem material ainda.";
    if (m.materialType === "youtube") {
      return `Vídeo do YouTube${m.videoExternalId ? ` (youtu.be/${m.videoExternalId})` : ""} — "${m.nome}"`;
    }
    return `PDF — "${m.nome}"`;
  }

  function onSubmitClick() {
    if (!selected) return;
    if (selected.hasMaterial && !confirming) {
      setConfirming(true);
      return;
    }
    void handleSubmit();
  }

  async function post(path: string, body: unknown): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function handleSubmit() {
    if (!selected) return;
    setBusy(true);
    setConfirming(false);
    setResult(null);
    setProgress(0);

    try {
      let nomeFinal = titulo.trim();

      if (kind === "youtube") {
        setPhase("Salvando o vídeo...");
        const data = await post("/api/admin/conteudo/youtube", { moduleId: selected.id, url: url.trim(), titulo });
        if (!data.ok) throw new Error(data.error ?? "Não foi possível salvar o vídeo.");
        nomeFinal = String(data.nome ?? nomeFinal);
        setModules((prev) =>
          prev
            ? prev.map((m) =>
                m.id === selected.id
                  ? { ...m, nome: nomeFinal, hasMaterial: true, materialType: "youtube", videoExternalId: String(data.videoId ?? "") }
                  : m
              )
            : prev
        );
      } else {
        const f = file!;
        const k = kind as "pdf" | "pptx";

        if (f.size > MAX_MB[k] * 1024 * 1024) throw new Error(`Arquivo acima do limite de ${MAX_MB[k]} MB.`);
        if (k === "pdf") {
          const head = new TextDecoder().decode(await f.slice(0, 5).arrayBuffer());
          if (head !== "%PDF-") throw new Error("Esse arquivo não parece ser um PDF válido.");
        }

        setPhase("Preparando o envio...");
        const start = await post("/api/admin/conteudo/iniciar-upload", {
          moduleId: selected.id,
          kind: k,
          fileName: f.name,
          sizeBytes: f.size,
        });
        if (!start.ok) throw new Error(start.error ?? "Não foi possível iniciar o envio.");

        setPhase("Enviando para o Drive...");
        const uploaded = await putFile(String(start.uploadUrl), f, String(start.contentType), setProgress);

        setPhase(k === "pptx" ? "Convertendo a apresentação em PDF..." : "Finalizando...");
        const fin = await post("/api/admin/conteudo/finalizar", {
          moduleId: selected.id,
          kind: k,
          fileId: uploaded.id,
          titulo,
        });
        if (!fin.ok) throw new Error(fin.error ?? "Não foi possível concluir o envio.");
        nomeFinal = String(fin.nome ?? nomeFinal);
        setModules((prev) =>
          prev
            ? prev.map((m) =>
                m.id === selected.id
                  ? { ...m, nome: nomeFinal, hasMaterial: true, materialType: "pdf", videoExternalId: null }
                  : m
              )
            : prev
        );
      }

      setTitulo(nomeFinal);
      setFile(null);
      setUrl("");
      setResult({
        ok: true,
        message: `Material salvo no módulo "${nomeFinal}". Já vale para os alunos; o material anterior (se havia) foi para a lixeira do Drive.`,
      });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Não foi possível salvar o material." });
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  return (
    <div>
      <div style={boxStyle}>
        <label style={labelStyle}>Módulo</label>
        {modulesError && (
          <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm, marginBottom: 8 }}>
            {modulesError}
          </p>
        )}
        {modules === null && !modulesError ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Carregando módulos...</p>
        ) : (
          <ModulePicker
            modules={modules ?? []}
            selectedId={selectedId}
            disabled={busy}
            onSelect={handleSelect}
            renderBadges={(m) => (
              <>
                {!m.hasMaterial && <Badge tone="warning">sem material</Badge>}
                {m.hasMaterial && <Badge tone={m.materialType === "youtube" ? "primary" : "neutral"}>{m.materialType === "youtube" ? "Vídeo" : "PDF"}</Badge>}
                {!m.active && <Badge tone="neutral">inativo</Badge>}
              </>
            )}
          />
        )}
      </div>

      {selected && (
        <div style={boxStyle}>
          <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>{selected.nome}</b>
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: "4px 0 14px" }}>
            Material atual: {describeCurrent(selected)}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {(["pdf", "pptx", "youtube"] as Kind[]).map((k) => (
              <Button
                key={k}
                type="button"
                variant={kind === k ? "primary" : "secondary"}
                onClick={() => handleKindChange(k)}
                disabled={busy}
              >
                {kindLabels[k]}
              </Button>
            ))}
          </div>

          <label style={labelStyle}>
            Título do material * <span style={{ fontWeight: 400 }}>(é o nome do módulo que o aluno vê)</span>
          </label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            disabled={busy}
            style={{ ...inputStyle, marginBottom: 12 }}
            placeholder="ex: Tempo e velocidade"
          />

          {kind === "youtube" ? (
            <>
              <label style={labelStyle}>Link do vídeo *</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                style={{ ...inputStyle, marginBottom: 12 }}
                placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
              />
            </>
          ) : (
            <>
              <label style={labelStyle}>
                {kind === "pdf" ? "Arquivo PDF *" : "Arquivo PowerPoint (.pptx) *"}{" "}
                <span style={{ fontWeight: 400 }}>(até {MAX_MB[kind]} MB)</span>
              </label>
              <input
                key={kind}
                type="file"
                accept={kind === "pdf" ? "application/pdf,.pdf" : ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"}
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ marginBottom: 12, fontSize: 13 }}
              />
              {kind === "pptx" && (
                <p style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "0 0 12px" }}>
                  A apresentação é convertida em PDF e o aluno vê só o PDF. Animações e vídeos embutidos não são
                  mantidos.
                </p>
              )}
            </>
          )}

          {busy && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: "0 0 6px" }}>
                {phase}
                {phase === "Enviando para o Drive..." ? ` ${progress}%` : ""}
              </p>
              <div style={{ height: 6, background: theme.color.border, borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: phase === "Enviando para o Drive..." ? `${progress}%` : "100%",
                    background: theme.color.primary,
                    transition: "width 0.2s",
                    opacity: phase === "Enviando para o Drive..." ? 1 : 0.5,
                  }}
                />
              </div>
            </div>
          )}

          {confirming && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: theme.radius.md,
                background: theme.color.warningBg,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, color: theme.color.text }}>
                Isso substitui o material atual deste módulo (ele vai para a lixeira do Drive) e vale imediatamente
                para os alunos. Confirmar?
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => void handleSubmit()} disabled={busy}>
                  Confirmar
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {!confirming && (
            <Button onClick={onSubmitClick} disabled={!canSubmit}>
              {busy ? "Enviando..." : selected.hasMaterial ? "Substituir material" : "Salvar material"}
            </Button>
          )}

          {result && (
            <div
              role={result.ok ? "status" : "alert"}
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: theme.radius.md,
                background: result.ok ? theme.color.primaryLight : theme.color.dangerBg,
                color: result.ok ? theme.color.primaryDark : theme.color.danger,
                fontSize: 13,
              }}
            >
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
