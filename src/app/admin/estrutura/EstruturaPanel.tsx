"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface TreeModule {
  id: string;
  ordem: number;
  nome: string;
  hasMaterial: boolean;
  hasQuestions: boolean;
}
interface TreeTrack {
  id: string;
  nome: string;
  modules: TreeModule[];
}
interface TreePhase {
  id: string;
  ordem: number;
  nome: string;
  phaseType: "common" | "specific_track";
  modules: TreeModule[];
  tracks: TreeTrack[];
}
interface TreeProgram {
  id: string;
  nome: string;
  phases: TreePhase[];
}

type Kind = "programa" | "fase" | "funcao" | "modulo";

type FormState =
  | { type: "create-program" }
  | { type: "create-phase"; programId: string }
  | { type: "create-track"; phaseId: string }
  | { type: "create-module"; phaseId: string; trackId: string | null }
  | { type: "rename"; kind: Kind; id: string; current: string }
  | { type: "remove"; kind: Kind; id: string; label: string };

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(3),
  marginBottom: theme.space(3),
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  padding: "8px 10px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const removeMessages: Record<Kind, string> = {
  programa:
    "Isso manda a pasta do Programa (com todas as fases, funções e módulos) para a lixeira do Drive e tira o Programa das trilhas. Alunos matriculados nele perdem o acesso.",
  fase: "Isso manda a pasta da fase (com todos os módulos e funções dela) para a lixeira do Drive e tira a fase das trilhas.",
  funcao: "Isso manda a pasta da Função (com todos os módulos dela) para a lixeira do Drive e tira a Função das trilhas.",
  modulo: "Isso manda a pasta do módulo (material e perguntas) para a lixeira do Drive e tira o módulo das trilhas.",
};

function TextButton({
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        padding: "2px 4px",
        cursor: disabled ? "default" : "pointer",
        fontSize: theme.font.size.xs,
        fontWeight: 600,
        color: danger ? theme.color.danger : theme.color.primaryDark,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function InlineInput({
  placeholder,
  initial = "",
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  initial?: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        style={inputStyle}
      />
      <Button type="submit" disabled={busy || !value.trim()}>
        {busy ? "Salvando..." : submitLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
        Cancelar
      </Button>
    </form>
  );
}

function ConfirmRemove({
  kind,
  label,
  busy,
  onConfirm,
  onCancel,
}: {
  kind: Kind;
  label: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        margin: "8px 0",
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
        <b>Remover &quot;{label}&quot;?</b> {removeMessages[kind]}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Removendo..." : "Remover"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function EstruturaPanel() {
  const [programs, setPrograms] = useState<TreeProgram[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/estrutura");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoadError(data.error ?? "Não foi possível carregar a estrutura agora.");
        return;
      }
      setLoadError(null);
      setPrograms(data.programs ?? []);
    } catch {
      setLoadError("Erro de conexão.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function open(f: FormState, ensureExpanded?: string) {
    setNotice(null);
    setForm(f);
    if (ensureExpanded) setExpanded((prev) => new Set(prev).add(ensureExpanded));
  }

  async function send(method: "POST" | "PATCH" | "DELETE", path: string, body: unknown, successMessage: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNotice({ ok: false, message: data.error ?? "Não foi possível concluir a ação." });
        return;
      }
      setForm(null);
      setNotice({ ok: true, message: successMessage });
      await load();
    } catch {
      setNotice({ ok: false, message: "Erro de conexão. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  const isForm = (pred: (f: FormState) => boolean) => (form && pred(form) ? form : null);

  function renameForm(kind: Kind, id: string) {
    const f = isForm((x) => x.type === "rename" && x.kind === kind && x.id === id);
    if (!f || f.type !== "rename") return null;
    return (
      <InlineInput
        placeholder="Novo nome"
        initial={f.current}
        submitLabel="Renomear"
        busy={busy}
        onCancel={() => setForm(null)}
        onSubmit={(nome) => send("PATCH", `/api/admin/estrutura/${kind}/${id}`, { nome }, "Renomeado (pasta do Drive e trilhas).")}
      />
    );
  }

  function removeForm(kind: Kind, id: string) {
    const f = isForm((x) => x.type === "remove" && x.kind === kind && x.id === id);
    if (!f || f.type !== "remove") return null;
    return (
      <ConfirmRemove
        kind={kind}
        label={f.label}
        busy={busy}
        onCancel={() => setForm(null)}
        onConfirm={() => send("DELETE", `/api/admin/estrutura/${kind}/${id}`, undefined, "Removido (pasta na lixeira do Drive).")}
      />
    );
  }

  function renderModuleRow(m: TreeModule) {
    return (
      <div key={m.id} style={{ padding: "6px 0", borderTop: `1px solid ${theme.color.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: theme.color.text }}>
            <span style={{ color: theme.color.textFaint }}>{m.ordem}.</span> {m.nome}{" "}
            {!m.hasMaterial && <Badge tone="warning">sem material</Badge>}{" "}
            {m.hasQuestions && <Badge tone="primary">com perguntas</Badge>}
          </span>
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Link href="/admin/conteudo" style={{ fontSize: theme.font.size.xs, fontWeight: 600, color: theme.color.primaryDark }}>
              Conteúdo
            </Link>
            <TextButton onClick={() => open({ type: "rename", kind: "modulo", id: m.id, current: m.nome })}>Renomear</TextButton>
            <TextButton danger onClick={() => open({ type: "remove", kind: "modulo", id: m.id, label: m.nome })}>
              Remover
            </TextButton>
          </span>
        </div>
        {renameForm("modulo", m.id)}
        {removeForm("modulo", m.id)}
      </div>
    );
  }

  function moduleCreateForm(phaseId: string, trackId: string | null) {
    const f = isForm((x) => x.type === "create-module" && x.phaseId === phaseId && x.trackId === trackId);
    if (!f) return null;
    return (
      <InlineInput
        placeholder="Título do módulo (ex: Tempo e velocidade)"
        submitLabel="Criar módulo"
        busy={busy}
        onCancel={() => setForm(null)}
        onSubmit={(titulo) =>
          send("POST", "/api/admin/estrutura/modulos", { phaseId, trackId, titulo }, "Módulo criado. Agora adicione o material em Conteúdo dos módulos.")
        }
      />
    );
  }

  return (
    <div>
      {notice && (
        <div
          role={notice.ok ? "status" : "alert"}
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: theme.radius.md,
            background: notice.ok ? theme.color.primaryLight : theme.color.dangerBg,
            color: notice.ok ? theme.color.primaryDark : theme.color.danger,
            fontSize: 13,
          }}
        >
          {notice.message}
        </div>
      )}

      <div style={{ marginBottom: theme.space(4) }}>
        {form?.type === "create-program" ? (
          <InlineInput
            placeholder="Nome do Programa (ex: Trilha de Logística)"
            submitLabel="Criar Programa"
            busy={busy}
            onCancel={() => setForm(null)}
            onSubmit={(nome) => send("POST", "/api/admin/estrutura/programas", { nome }, "Programa criado.")}
          />
        ) : (
          <Button onClick={() => open({ type: "create-program" })}>+ Novo Programa</Button>
        )}
      </div>

      {loadError && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}>
          {loadError}
        </p>
      )}
      {programs === null && !loadError && (
        <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Carregando estrutura...</p>
      )}
      {programs && programs.length === 0 && (
        <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Nenhum Programa ainda.</p>
      )}

      {programs?.map((program) => {
        const open_ = expanded.has(program.id);
        return (
          <div key={program.id} style={boxStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => toggle(program.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ display: "inline-block", transform: open_ ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: theme.color.textFaint, fontSize: 12 }}>
                  ▶
                </span>
                <Badge tone="primary">Programa</Badge>
                <b style={{ fontSize: theme.font.size.base, color: theme.color.text }}>{program.nome}</b>
                <Badge tone="neutral">
                  {program.phases.length} fase{program.phases.length === 1 ? "" : "s"}
                </Badge>
              </button>
              <span style={{ display: "flex", gap: 4 }}>
                <TextButton onClick={() => open({ type: "create-phase", programId: program.id }, program.id)}>+ Fase</TextButton>
                <TextButton onClick={() => open({ type: "rename", kind: "programa", id: program.id, current: program.nome })}>Renomear</TextButton>
                <TextButton danger onClick={() => open({ type: "remove", kind: "programa", id: program.id, label: program.nome })}>
                  Remover
                </TextButton>
              </span>
            </div>
            {renameForm("programa", program.id)}
            {removeForm("programa", program.id)}
            {isForm((x) => x.type === "create-phase" && x.programId === program.id) && (
              <InlineInput
                placeholder="Nome da fase (ex: Conhecimento técnico) — o número é automático"
                submitLabel="Criar fase"
                busy={busy}
                onCancel={() => setForm(null)}
                onSubmit={(assunto) => send("POST", "/api/admin/estrutura/fases", { programId: program.id, assunto }, "Fase criada.")}
              />
            )}

            {open_ && (
              <div style={{ marginTop: theme.space(3) }}>
                {program.phases.length === 0 && (
                  <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
                    Nenhuma fase ainda — use &quot;+ Fase&quot;.
                  </p>
                )}
                {program.phases.map((phase) => (
                  <div
                    key={phase.id}
                    style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(3), marginBottom: 8 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b style={{ fontSize: theme.font.size.sm, color: theme.color.text }}>
                        Fase {phase.ordem} — {phase.nome}{" "}
                        <span style={{ fontWeight: 400, color: theme.color.textFaint }}>
                          {phase.phaseType === "specific_track" ? "por função" : "comum"}
                        </span>
                      </b>
                      <span style={{ display: "flex", gap: 4 }}>
                        {phase.tracks.length === 0 && (
                          <TextButton onClick={() => open({ type: "create-module", phaseId: phase.id, trackId: null })}>+ Módulo</TextButton>
                        )}
                        {phase.modules.length === 0 && (
                          <TextButton onClick={() => open({ type: "create-track", phaseId: phase.id })}>+ Função</TextButton>
                        )}
                        <TextButton onClick={() => open({ type: "rename", kind: "fase", id: phase.id, current: phase.nome })}>Renomear</TextButton>
                        <TextButton danger onClick={() => open({ type: "remove", kind: "fase", id: phase.id, label: `Fase ${phase.ordem} — ${phase.nome}` })}>
                          Remover
                        </TextButton>
                      </span>
                    </div>
                    {renameForm("fase", phase.id)}
                    {removeForm("fase", phase.id)}
                    {isForm((x) => x.type === "create-track" && x.phaseId === phase.id) && (
                      <InlineInput
                        placeholder="Nome da Função (ex: Supervisor de Picking)"
                        submitLabel="Criar Função"
                        busy={busy}
                        onCancel={() => setForm(null)}
                        onSubmit={(nome) => send("POST", "/api/admin/estrutura/funcoes", { phaseId: phase.id, nome }, "Função criada.")}
                      />
                    )}
                    {moduleCreateForm(phase.id, null)}

                    {phase.modules.map((m) => (
                      renderModuleRow(m)
                    ))}

                    {phase.tracks.map((track) => (
                      <div key={track.id} style={{ marginTop: 8, marginLeft: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: theme.color.primaryDark }}>{track.nome}</span>
                          <span style={{ display: "flex", gap: 4 }}>
                            <TextButton onClick={() => open({ type: "create-module", phaseId: phase.id, trackId: track.id })}>+ Módulo</TextButton>
                            <TextButton onClick={() => open({ type: "rename", kind: "funcao", id: track.id, current: track.nome })}>Renomear</TextButton>
                            <TextButton danger onClick={() => open({ type: "remove", kind: "funcao", id: track.id, label: track.nome })}>
                              Remover
                            </TextButton>
                          </span>
                        </div>
                        {renameForm("funcao", track.id)}
                        {removeForm("funcao", track.id)}
                        {moduleCreateForm(phase.id, track.id)}
                        <div style={{ marginLeft: 12 }}>
                          {track.modules.map((m) => (
                            renderModuleRow(m)
                          ))}
                        </div>
                      </div>
                    ))}

                    {phase.modules.length === 0 && phase.tracks.length === 0 && (
                      <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, margin: "8px 0 0" }}>
                        Fase vazia — adicione módulos (&quot;+ Módulo&quot;) ou, se for dividida por Função, crie as Funções primeiro.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
