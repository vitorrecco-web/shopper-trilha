"use client";

import { useEffect, useRef, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModulePicker } from "../_components/ModulePicker";

interface ModuleOption {
  id: string;
  nome: string;
  ordem: number;
  programId: string | null;
  programNome: string | null;
  faseNome: string | null;
  faseOrdem: number;
  phaseType: "common" | "specific_track";
  trackNome: string | null;
  hasQuestionsFile: boolean;
  hasQuestions: boolean;
  active: boolean;
}

interface ModulosResult {
  ok: boolean;
  modules?: ModuleOption[];
  error?: string;
}

interface CarregarResult {
  ok: boolean;
  moduleNome?: string;
  perguntasJson?: unknown;
  validation?: { ok: boolean; error?: string };
  isNew?: boolean;
  error?: string;
}

interface ValidarResult {
  ok: boolean;
  valid?: boolean;
  error?: string;
  questionCount?: number;
}

interface SalvarResult {
  ok: boolean;
  error?: string;
  questionCount?: number;
  isNew?: boolean;
}

const ALT_IDS = ["a", "b", "c", "d"] as const;
/** Mesmos limites de validatePerguntas.ts (2 a 8 alternativas por pergunta) — o pool de letras cobre até o máximo. */
const ALT_ID_POOL = "abcdefghijklmnopqrstuvwxyz".split("");
const MIN_ALTERNATIVAS = 2;
const MAX_ALTERNATIVAS = 8;

interface EditorAlternativa {
  id: string;
  texto: string;
}

interface EditorPergunta {
  key: string; // chave estável para React, independente do id editável
  id: string;
  pergunta: string;
  alternativas: EditorAlternativa[];
  correta: string;
  explicacao: string;
  review_topic: string;
  review_process: string;
  review_document: string;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `p${keyCounter}-${Date.now()}`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizePergunta(raw: unknown, index: number): EditorPergunta {
  const p = (raw ?? {}) as Record<string, unknown>;
  const rawAlts: Record<string, unknown>[] =
    Array.isArray(p.alternativas) && p.alternativas.length > 0
      ? (p.alternativas as Record<string, unknown>[])
      : ALT_IDS.map(() => ({}) as Record<string, unknown>);

  const alternativas: EditorAlternativa[] = rawAlts.map((a, i) => {
    const fallbackId = ALT_ID_POOL[i] ?? `alt${i + 1}`;
    return {
      id: asString(a?.id, fallbackId) || fallbackId,
      texto: asString(a?.texto),
    };
  });

  const correta = asString(p.correta, alternativas[0]?.id ?? "a");

  return {
    key: nextKey(),
    id: asString(p.id, `q${index + 1}`) || `q${index + 1}`,
    pergunta: asString(p.pergunta),
    alternativas,
    correta: alternativas.some((a) => a.id === correta) ? correta : (alternativas[0]?.id ?? "a"),
    explicacao: asString(p.explicacao),
    review_topic: asString(p.review_topic),
    review_process: asString(p.review_process),
    review_document: asString(p.review_document),
  };
}

function toEditorPerguntas(json: unknown): EditorPergunta[] {
  if (!json || typeof json !== "object") return [];
  const perguntas = (json as Record<string, unknown>).perguntas;
  if (!Array.isArray(perguntas)) return [];
  return perguntas.map((p, i) => normalizePergunta(p, i));
}

function nextQuestionId(perguntas: EditorPergunta[]): string {
  const existing = new Set(perguntas.map((p) => p.id));
  let i = perguntas.length + 1;
  let candidate = `q${i}`;
  while (existing.has(candidate)) {
    i += 1;
    candidate = `q${i}`;
  }
  return candidate;
}

function nextAltId(alternativas: EditorAlternativa[]): string {
  const existing = new Set(alternativas.map((a) => a.id));
  for (const id of ALT_ID_POOL) {
    if (!existing.has(id)) return id;
  }
  return `alt${alternativas.length + 1}`;
}

function newQuestion(perguntas: EditorPergunta[]): EditorPergunta {
  return {
    key: nextKey(),
    id: nextQuestionId(perguntas),
    pergunta: "",
    alternativas: ALT_IDS.map((id) => ({ id, texto: "" })),
    correta: "a",
    explicacao: "",
    review_topic: "",
    review_process: "",
    review_document: "",
  };
}

/** Monta o perguntas.json final — omite campos opcionais vazios em vez de gravar string em branco. */
function buildPayload(perguntas: EditorPergunta[]) {
  return {
    perguntas: perguntas.map((p) => ({
      id: p.id,
      pergunta: p.pergunta,
      alternativas: p.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
      correta: p.correta,
      ...(p.explicacao.trim() ? { explicacao: p.explicacao.trim() } : {}),
      ...(p.review_topic.trim() ? { review_topic: p.review_topic.trim() } : {}),
      ...(p.review_process.trim() ? { review_process: p.review_process.trim() } : {}),
      ...(p.review_document.trim() ? { review_document: p.review_document.trim() } : {}),
    })),
  };
}

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

export function PerguntasEditorPanel() {
  const [modules, setModules] = useState<ModuleOption[] | null>(null);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moduleNome, setModuleNome] = useState<string | null>(null);
  const [isNewFile, setIsNewFile] = useState(false);
  const [perguntas, setPerguntas] = useState<EditorPergunta[] | null>(null);

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; error?: string; questionCount?: number } | null>(
    null
  );

  const [confirmingSave, setConfirmingSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/perguntas/modulos");
        const data: ModulosResult = await res.json();
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

  // Validação em tempo real, com debounce — mesma validatePerguntasJson do backend.
  useEffect(() => {
    if (perguntas === null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await fetch("/api/admin/perguntas/validar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(perguntas)),
        });
        const data: ValidarResult = await res.json();
        if (!res.ok || !data.ok) {
          setValidation({ ok: false, error: data.error ?? "Não foi possível validar agora." });
          return;
        }
        setValidation({ ok: Boolean(data.valid), error: data.error, questionCount: data.questionCount });
      } catch {
        setValidation({ ok: false, error: "Erro de conexão ao validar." });
      } finally {
        setValidating(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perguntas]);

  async function handleLoad(moduleId: string) {
    setSelectedModuleId(moduleId);
    setPerguntas(null);
    setModuleNome(null);
    setIsNewFile(false);
    setLoadError(null);
    setValidation(null);
    setSaveResult(null);
    setConfirmingSave(false);
    if (!moduleId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/perguntas/carregar?moduleId=${encodeURIComponent(moduleId)}`);
      const data: CarregarResult = await res.json();
      if (!res.ok || !data.ok) {
        setLoadError(data.error ?? "Não foi possível carregar o módulo agora.");
        return;
      }
      setModuleNome(data.moduleNome ?? null);
      setPerguntas(toEditorPerguntas(data.perguntasJson));
      setIsNewFile(Boolean(data.isNew));
      if (data.validation && !data.validation.ok) {
        setLoadError(`O perguntas.json atual deste módulo está inválido: ${data.validation.error}`);
      }
    } catch {
      setLoadError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function updateQuestion(key: string, patch: Partial<EditorPergunta>) {
    setPerguntas((prev) => (prev ? prev.map((p) => (p.key === key ? { ...p, ...patch } : p)) : prev));
  }

  function updateAlternativa(questionKey: string, altIndex: number, texto: string) {
    setPerguntas((prev) =>
      prev
        ? prev.map((p) =>
            p.key === questionKey
              ? {
                  ...p,
                  alternativas: p.alternativas.map((a, i) => (i === altIndex ? { ...a, texto } : a)),
                }
              : p
          )
        : prev
    );
  }

  function handleAddAlternativa(questionKey: string) {
    setPerguntas((prev) =>
      prev
        ? prev.map((p) => {
            if (p.key !== questionKey || p.alternativas.length >= MAX_ALTERNATIVAS) return p;
            return { ...p, alternativas: [...p.alternativas, { id: nextAltId(p.alternativas), texto: "" }] };
          })
        : prev
    );
  }

  function handleRemoveAlternativa(questionKey: string, altIndex: number) {
    setPerguntas((prev) =>
      prev
        ? prev.map((p) => {
            if (p.key !== questionKey || p.alternativas.length <= MIN_ALTERNATIVAS) return p;
            const removed = p.alternativas[altIndex];
            const alternativas = p.alternativas.filter((_, i) => i !== altIndex);
            const correta = removed?.id === p.correta ? (alternativas[0]?.id ?? "a") : p.correta;
            return { ...p, alternativas, correta };
          })
        : prev
    );
  }

  function handleAddQuestion() {
    setPerguntas((prev) => [...(prev ?? []), newQuestion(prev ?? [])]);
  }

  function handleRemoveQuestion(key: string) {
    setPerguntas((prev) => (prev ? prev.filter((p) => p.key !== key) : prev));
  }

  function handleDownload() {
    if (!perguntas) return;
    const payload = buildPayload(perguntas);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "perguntas.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleConfirmSave() {
    if (!perguntas || !selectedModuleId) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/admin/perguntas/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: selectedModuleId, perguntas: buildPayload(perguntas) }),
      });
      const data: SalvarResult = await res.json();
      if (!res.ok || !data.ok) {
        setSaveResult({ ok: false, message: data.error ?? "Não foi possível salvar agora." });
        return;
      }
      const count = data.questionCount ?? perguntas.length;
      setSaveResult({
        ok: true,
        message: data.isNew
          ? `perguntas.json criado no Drive com sucesso (${count} pergunta${count === 1 ? "" : "s"}). Já vale para o próximo quiz respondido.`
          : `Salvo no Drive com sucesso (${count} pergunta${count === 1 ? "" : "s"}). Já vale para o próximo quiz respondido.`,
      });
      setIsNewFile(false);
      setModules((prev) =>
        prev ? prev.map((m) => (m.id === selectedModuleId ? { ...m, hasQuestionsFile: true, hasQuestions: true } : m)) : prev
      );
    } catch {
      setSaveResult({ ok: false, message: "Erro de conexão ao salvar." });
    } finally {
      setSaving(false);
      setConfirmingSave(false);
    }
  }

  const canPublish = Boolean(perguntas && perguntas.length > 0 && validation?.ok);

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
          <>
            <ModulePicker
              modules={modules ?? []}
              selectedId={selectedModuleId}
              disabled={loading}
              onSelect={(m) => handleLoad(m.id)}
              renderBadges={(m) => (
                <>
                  {!m.hasQuestionsFile && <Badge tone="neutral">sem arquivo</Badge>}
                  {m.hasQuestionsFile && !m.hasQuestions && <Badge tone="warning">inválido</Badge>}
                  {!m.active && <Badge tone="neutral">inativo</Badge>}
                </>
              )}
            />
          </>
        )}
      </div>

      {loading && (
        <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Carregando perguntas...</p>
      )}

      {loadError && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm, marginBottom: 12 }}>
          {loadError}
        </p>
      )}

      {perguntas !== null && (
        <>
          <div
            style={{
              ...boxStyle,
              position: "sticky",
              top: 66,
              zIndex: 5,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>
                  {moduleNome ?? "Módulo"} · {perguntas.length} pergunta{perguntas.length === 1 ? "" : "s"}
                </b>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {isNewFile && <Badge tone="neutral">Novo — sem perguntas.json no Drive ainda</Badge>}
                  {validating ? (
                    <Badge tone="neutral">Validando...</Badge>
                  ) : validation?.ok ? (
                    <Badge tone="primary">JSON válido</Badge>
                  ) : validation && !validation.ok ? (
                    <Badge tone="danger">Inválido: {validation.error}</Badge>
                  ) : (
                    <Badge tone="neutral">—</Badge>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={handleDownload} disabled={!canPublish}>
                  Baixar backup (.json)
                </Button>
                <Button onClick={() => setConfirmingSave(true)} disabled={!canPublish || saving || confirmingSave}>
                  {saving ? "Salvando..." : isNewFile ? "Criar no Drive" : "Salvar no Drive"}
                </Button>
              </div>
            </div>

            {confirmingSave && (
              <div
                style={{
                  marginTop: 12,
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
                  {isNewFile
                    ? "Isso cria o perguntas.json deste módulo direto na pasta dele no Drive — vale imediatamente para quem responder o quiz. Confirmar?"
                    : "Isso sobrescreve o perguntas.json atual deste módulo direto no Drive — vale imediatamente para quem responder o quiz. Confirmar?"}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={handleConfirmSave} disabled={saving}>
                    {saving ? "Salvando..." : "Confirmar"}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingSave(false)} disabled={saving}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {saveResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: theme.radius.md,
                  background: saveResult.ok ? theme.color.primaryLight : theme.color.dangerBg,
                  color: saveResult.ok ? theme.color.primaryDark : theme.color.danger,
                  fontSize: 13,
                }}
              >
                {saveResult.message}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: theme.space(3) }}>
            {perguntas.map((p, index) => (
              <div key={p.key} style={boxStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <b style={{ fontSize: theme.font.size.sm, color: theme.color.text }}>Pergunta {index + 1}</b>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
                      ID:{" "}
                      <input
                        value={p.id}
                        onChange={(e) => updateQuestion(p.key, { id: e.target.value })}
                        style={{ ...inputStyle, width: 90, display: "inline-block" }}
                      />
                    </label>
                    <Button variant="danger" onClick={() => handleRemoveQuestion(p.key)}>
                      Remover
                    </Button>
                  </div>
                </div>

                <label style={labelStyle}>Enunciado</label>
                <textarea
                  value={p.pergunta}
                  onChange={(e) => updateQuestion(p.key, { pergunta: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }}
                />

                <label style={labelStyle}>
                  Alternativas (selecione a correta) — {p.alternativas.length} de {MAX_ALTERNATIVAS}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                  {p.alternativas.map((alt, altIndex) => (
                    <div key={alt.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name={`correta-${p.key}`}
                        checked={p.correta === alt.id}
                        onChange={() => updateQuestion(p.key, { correta: alt.id })}
                        aria-label={`Alternativa ${alt.id} é a correta`}
                      />
                      <span style={{ fontSize: 12, color: theme.color.textFaint, minWidth: 14 }}>
                        {alt.id.toUpperCase()}
                      </span>
                      <input
                        value={alt.texto}
                        onChange={(e) => updateAlternativa(p.key, altIndex, e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder={`Texto da alternativa ${alt.id.toUpperCase()}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAlternativa(p.key, altIndex)}
                        disabled={p.alternativas.length <= MIN_ALTERNATIVAS}
                        aria-label={`Remover alternativa ${alt.id.toUpperCase()}`}
                        title={
                          p.alternativas.length <= MIN_ALTERNATIVAS
                            ? `Uma pergunta precisa de pelo menos ${MIN_ALTERNATIVAS} alternativas`
                            : "Remover alternativa"
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          color: p.alternativas.length <= MIN_ALTERNATIVAS ? theme.color.textFaint : theme.color.danger,
                          cursor: p.alternativas.length <= MIN_ALTERNATIVAS ? "default" : "pointer",
                          fontSize: 16,
                          lineHeight: 1,
                          padding: "4px 6px",
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleAddAlternativa(p.key)}
                  disabled={p.alternativas.length >= MAX_ALTERNATIVAS}
                  style={{ marginBottom: 12, fontSize: theme.font.size.xs, padding: "4px 10px" }}
                >
                  + Adicionar alternativa
                </Button>

                <label style={labelStyle}>Explicação (opcional)</label>
                <textarea
                  value={p.explicacao}
                  onChange={(e) => updateQuestion(p.key, { explicacao: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 10,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Revisão · tópico (opcional)</label>
                    <input
                      value={p.review_topic}
                      onChange={(e) => updateQuestion(p.key, { review_topic: e.target.value })}
                      style={inputStyle}
                      placeholder="ex: produto avariado descarte"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Revisão · processo (opcional)</label>
                    <input
                      value={p.review_process}
                      onChange={(e) => updateQuestion(p.key, { review_process: e.target.value })}
                      style={inputStyle}
                      placeholder="ex: PICKING"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Revisão · documento (opcional)</label>
                    <input
                      value={p.review_document}
                      onChange={(e) => updateQuestion(p.key, { review_document: e.target.value })}
                      style={inputStyle}
                      placeholder="ex: POP PICKING"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="secondary" onClick={handleAddQuestion} style={{ marginTop: theme.space(2) }}>
            + Adicionar pergunta
          </Button>
        </>
      )}
    </div>
  );
}
