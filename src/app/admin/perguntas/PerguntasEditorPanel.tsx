"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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

/** Remove acentos/caixa para busca — usa \p{Diacritic} (ES2018+) em vez de uma faixa de código manual. */
function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizePergunta(raw: unknown, index: number): EditorPergunta {
  const p = (raw ?? {}) as Record<string, unknown>;
  const rawAlts = Array.isArray(p.alternativas) ? (p.alternativas as Record<string, unknown>[]) : [];

  const alternativas: EditorAlternativa[] = ALT_IDS.map((id, i) => ({
    id: asString(rawAlts[i]?.id, id) || id,
    texto: asString(rawAlts[i]?.texto),
  }));

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

function faseLabelFor(m: ModuleOption): string {
  return m.phaseType === "common"
    ? m.faseNome ?? "Sem fase"
    : `${m.faseNome ?? "Sem fase"} · ${m.trackNome ?? "Sem trilha"}`;
}

interface FaseGroup {
  label: string;
  items: ModuleOption[];
}

interface ProgramGroup {
  programId: string;
  programNome: string;
  faseGroups: FaseGroup[];
  count: number;
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
  const [moduleFilter, setModuleFilter] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());

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

  // Acordeão de 2 níveis: Programa (colapsável, igual à tela de
  // Drive/Sincronização) -> Fase/Trilha -> módulos, na ordem real da
  // trilha (já vem ordenada assim da API). Com todos os módulos agora
  // listados (não só os que já têm perguntas.json), uma lista plana ficaria
  // enorme e poluída — colapsar por Programa resolve isso. A busca filtra
  // por Programa, fase, trilha ou nome e expande automaticamente os
  // Programas com resultado.
  const programGroups = useMemo<ProgramGroup[]>(() => {
    if (!modules) return [];
    const term = normalizeSearch(moduleFilter.trim());
    const filtered = term
      ? modules.filter((m) =>
          normalizeSearch(`${m.programNome ?? ""} ${m.faseNome ?? ""} ${m.trackNome ?? ""} ${m.nome}`).includes(term)
        )
      : modules;

    const programOrder: string[] = [];
    const programs = new Map<string, { nome: string; faseOrder: string[]; faseMap: Map<string, ModuleOption[]> }>();

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
  }, [modules, moduleFilter]);

  const isSearching = moduleFilter.trim().length > 0;

  function toggleProgram(programId: string) {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) next.delete(programId);
      else next.add(programId);
      return next;
    });
  }

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

  async function handleLoad(moduleId: string, programId: string | null) {
    setSelectedModuleId(moduleId);
    setPerguntas(null);
    setModuleNome(null);
    setIsNewFile(false);
    setLoadError(null);
    setValidation(null);
    setSaveResult(null);
    setConfirmingSave(false);
    if (programId) {
      setExpandedPrograms((prev) => new Set(prev).add(programId));
    }
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
            <input
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              placeholder="Buscar por Programa, fase, trilha ou nome do módulo..."
              style={{ ...inputStyle, marginBottom: 10, maxWidth: 480 }}
            />
            {programGroups.length === 0 ? (
              <p style={{ padding: 12, fontSize: 13, color: theme.color.textMuted, margin: 0 }}>
                {modules && modules.length === 0
                  ? "Nenhum módulo cadastrado."
                  : "Nenhum módulo encontrado para essa busca."}
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
                                  onClick={() => handleLoad(m.id, m.programId)}
                                  disabled={loading}
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
                                    background: m.id === selectedModuleId ? theme.color.primaryLight : "transparent",
                                    color: theme.color.text,
                                    cursor: loading ? "default" : "pointer",
                                  }}
                                >
                                  <span>{m.nome}</span>
                                  <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    {!m.hasQuestionsFile && <Badge tone="neutral">sem arquivo</Badge>}
                                    {m.hasQuestionsFile && !m.hasQuestions && <Badge tone="warning">inválido</Badge>}
                                    {!m.active && <Badge tone="neutral">inativo</Badge>}
                                  </span>
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

                <label style={labelStyle}>Alternativas (selecione a correta)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
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
                    </div>
                  ))}
                </div>

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
