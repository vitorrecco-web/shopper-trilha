"use client";

import { useCallback, useEffect, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Vacancy {
  id: string;
  nome: string;
  logic_cutoff: number;
  area_key: string | null;
  area_cutoff: number | null;
  active: boolean;
}
interface Config {
  programId: string | null;
  programs: Array<{ id: string; nome: string }>;
  phases: Array<{ id: string; ordem: number; nome: string; areaKey: string | null; areaLabel: string | null }>;
  areas: Array<{ key: string; label: string }>;
  vacancies: Vacancy[];
}

type AreaChoice = "none" | "logica" | "area";

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(4),
};
const inputStyle: React.CSSProperties = {
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
const h2Style: React.CSSProperties = { fontSize: theme.font.size.md, margin: "0 0 4px", color: theme.color.text };
const hintStyle: React.CSSProperties = { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "0 0 12px" };

function PhaseRow({
  phase,
  areas,
  busy,
  onSave,
}: {
  phase: Config["phases"][number];
  areas: Config["areas"];
  busy: boolean;
  onSave: (phaseId: string, kind: "logica" | "area" | null, label?: string) => void;
}) {
  const initialChoice: AreaChoice = phase.areaKey === null ? "none" : phase.areaKey === "logica" ? "logica" : "area";
  const [choice, setChoice] = useState<AreaChoice>(initialChoice);
  const [label, setLabel] = useState(initialChoice === "area" ? (phase.areaLabel ?? "") : "");
  const listId = `areas-${phase.id}`;

  const unchanged =
    choice === initialChoice && (choice !== "area" || label.trim() === (phase.areaLabel ?? ""));

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${theme.color.border}` }}>
      <span style={{ flex: "1 1 220px", fontSize: 13, color: theme.color.text }}>
        <b>Fase {phase.ordem}</b> — {phase.nome}{" "}
        {phase.areaKey === null && <Badge tone="warning">sem etiqueta (fora da análise)</Badge>}
      </span>
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value as AreaChoice)}
        disabled={busy}
        style={{ ...inputStyle, minWidth: 190 }}
      >
        <option value="none">Sem etiqueta</option>
        <option value="logica">Teste de lógica</option>
        <option value="area">Área de vaga…</option>
      </select>
      {choice === "area" && (
        <>
          <input
            list={listId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome da área (ex: RC, Logística)"
            disabled={busy}
            style={{ ...inputStyle, minWidth: 200 }}
          />
          <datalist id={listId}>
            {areas.map((a) => (
              <option key={a.key} value={a.label} />
            ))}
          </datalist>
        </>
      )}
      <Button
        variant="secondary"
        disabled={busy || unchanged || (choice === "area" && !label.trim())}
        onClick={() => onSave(phase.id, choice === "none" ? null : choice, choice === "area" ? label.trim() : undefined)}
      >
        Salvar
      </Button>
    </div>
  );
}

function VacancyRow({
  vacancy,
  areas,
  busy,
  onSave,
}: {
  vacancy: Vacancy;
  areas: Config["areas"];
  busy: boolean;
  onSave: (id: string, patch: Partial<Vacancy>) => void;
}) {
  const [nome, setNome] = useState(vacancy.nome);
  const [logic, setLogic] = useState(String(vacancy.logic_cutoff));
  const [areaKey, setAreaKey] = useState(vacancy.area_key ?? "");
  const [areaCutoff, setAreaCutoff] = useState(vacancy.area_cutoff === null ? "" : String(vacancy.area_cutoff));

  const knownArea = areas.some((a) => a.key === areaKey);
  const changed =
    nome.trim() !== vacancy.nome ||
    Number(logic) !== vacancy.logic_cutoff ||
    (areaKey || null) !== vacancy.area_key ||
    (areaKey ? (areaCutoff === "" ? null : Number(areaCutoff)) : null) !== vacancy.area_cutoff;

  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${theme.color.border}`, opacity: vacancy.active ? 1 : 0.65 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 160px" }}>
          <label style={labelStyle}>Vaga</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={busy} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div style={{ width: 120 }}>
          <label style={labelStyle}>Corte lógica (0-100)</label>
          <input type="number" min={0} max={100} value={logic} onChange={(e) => setLogic(e.target.value)} disabled={busy} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Área de afinidade</label>
          <select value={areaKey} onChange={(e) => setAreaKey(e.target.value)} disabled={busy} style={{ ...inputStyle, width: "100%" }}>
            <option value="">(sem área)</option>
            {!knownArea && areaKey && <option value={areaKey}>{areaKey} (sem fase etiquetada)</option>}
            {areas.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 120 }}>
          <label style={labelStyle}>Corte da área (opc.)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={areaCutoff}
            onChange={(e) => setAreaCutoff(e.target.value)}
            disabled={busy || !areaKey}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <Button
          variant="secondary"
          disabled={busy || !changed || !nome.trim() || logic === ""}
          onClick={() =>
            onSave(vacancy.id, {
              nome: nome.trim(),
              logic_cutoff: Number(logic),
              area_key: areaKey || null,
              area_cutoff: areaKey && areaCutoff !== "" ? Number(areaCutoff) : null,
            })
          }
        >
          Salvar
        </Button>
        <Button variant={vacancy.active ? "danger" : "secondary"} disabled={busy} onClick={() => onSave(vacancy.id, { active: !vacancy.active })}>
          {vacancy.active ? "Encerrar vaga" : "Reativar"}
        </Button>
      </div>
      {!vacancy.active && <p style={{ ...hintStyle, margin: "6px 0 0" }}>Vaga encerrada — o candidato não a vê mais, mas o histórico fica.</p>}
    </div>
  );
}

export function RecrutamentoConfigPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const [programChoice, setProgramChoice] = useState("");
  const [newVaga, setNewVaga] = useState({ nome: "", logic: "", areaKey: "", areaCutoff: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/recrutamento");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoadError(data.error ?? "Não foi possível carregar a configuração agora.");
        return;
      }
      setLoadError(null);
      setConfig(data.config);
      setProgramChoice(data.config.programId ?? "");
    } catch {
      setLoadError("Erro de conexão.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(method: string, path: string, body: unknown, okMessage: string): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNotice({ ok: false, message: data.error ?? "Não foi possível salvar." });
        return false;
      }
      setNotice({ ok: true, message: okMessage });
      await load();
      return true;
    } catch {
      setNotice({ ok: false, message: "Erro de conexão. Tente novamente." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateVaga(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send(
      "POST",
      "/api/admin/recrutamento/vagas",
      {
        nome: newVaga.nome.trim(),
        logic_cutoff: Number(newVaga.logic),
        area_key: newVaga.areaKey || null,
        area_cutoff: newVaga.areaKey && newVaga.areaCutoff !== "" ? Number(newVaga.areaCutoff) : null,
      },
      "Vaga criada."
    );
    if (ok) setNewVaga({ nome: "", logic: "", areaKey: "", areaCutoff: "" });
  }

  if (loadError) {
    return (
      <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm }}>
        {loadError}
      </p>
    );
  }
  if (!config) return <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Carregando...</p>;

  const activeVacancies = config.vacancies.filter((v) => v.active);
  const inactiveVacancies = config.vacancies.filter((v) => !v.active);

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

      <section style={boxStyle}>
        <h2 style={h2Style}>1. Programa de Recrutamento</h2>
        <p style={hintStyle}>
          Os módulos deste Programa viram o diagnóstico: o próximo módulo abre ao enviar o quiz (mesmo reprovando) e as
          tentativas alimentam a análise.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={programChoice} onChange={(e) => setProgramChoice(e.target.value)} disabled={busy} style={{ ...inputStyle, minWidth: 260 }}>
            <option value="">(nenhum)</option>
            {config.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <Button
            disabled={busy || programChoice === (config.programId ?? "")}
            onClick={() => send("PUT", "/api/admin/recrutamento/programa", { programId: programChoice || null }, "Programa de Recrutamento salvo.")}
          >
            Salvar
          </Button>
        </div>
      </section>

      <section style={boxStyle}>
        <h2 style={h2Style}>2. Área de cada fase</h2>
        <p style={hintStyle}>
          Etiquete o <b>Teste de lógica</b> e cada fase de <b>área de vaga</b> (ex: RC, Logística, Compras). Fases sem
          etiqueta ficam fora da análise. Ao trocar os módulos de uma área, as vagas continuam ligadas pela área.
        </p>
        {!config.programId ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Escolha o Programa acima primeiro.</p>
        ) : config.phases.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Este Programa ainda não tem fases.</p>
        ) : (
          config.phases.map((phase) => (
            <PhaseRow
              key={`${phase.id}:${phase.areaKey ?? ""}:${phase.areaLabel ?? ""}`}
              phase={phase}
              areas={config.areas}
              busy={busy}
              onSave={(phaseId, kind, label) =>
                void send("PUT", `/api/admin/recrutamento/fases/${phaseId}`, { kind, label }, "Área da fase salva (o histórico existente foi incluído).")
              }
            />
          ))
        )}
      </section>

      <section style={boxStyle}>
        <h2 style={h2Style}>3. Vagas e notas de corte</h2>
        <p style={hintStyle}>
          O <b>corte de lógica</b> vale para a nota geral do teste de lógica. A <b>área de afinidade</b> (opcional) liga a
          vaga a uma área etiquetada: a nota do candidato nela vira indicador de afinidade (e, se houver, um corte
          próprio).
        </p>

        <form
          onSubmit={handleCreateVaga}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${theme.color.border}` }}
        >
          <div style={{ flex: "1 1 160px" }}>
            <label style={labelStyle}>Nova vaga *</label>
            <input value={newVaga.nome} onChange={(e) => setNewVaga((v) => ({ ...v, nome: e.target.value }))} disabled={busy} placeholder="ex: TEC" style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>Corte lógica *</label>
            <input type="number" min={0} max={100} value={newVaga.logic} onChange={(e) => setNewVaga((v) => ({ ...v, logic: e.target.value }))} disabled={busy} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={labelStyle}>Área de afinidade</label>
            <select value={newVaga.areaKey} onChange={(e) => setNewVaga((v) => ({ ...v, areaKey: e.target.value }))} disabled={busy} style={{ ...inputStyle, width: "100%" }}>
              <option value="">(sem área)</option>
              {config.areas.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>Corte da área</label>
            <input type="number" min={0} max={100} value={newVaga.areaCutoff} onChange={(e) => setNewVaga((v) => ({ ...v, areaCutoff: e.target.value }))} disabled={busy || !newVaga.areaKey} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <Button type="submit" disabled={busy || !newVaga.nome.trim() || newVaga.logic === ""}>
            + Criar vaga
          </Button>
        </form>

        {activeVacancies.length === 0 && <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>Nenhuma vaga ativa ainda.</p>}
        {activeVacancies.map((v) => (
          <VacancyRow
            key={`${v.id}:${v.nome}:${v.logic_cutoff}:${v.area_key}:${v.area_cutoff}:${v.active}`}
            vacancy={v}
            areas={config.areas}
            busy={busy}
            onSave={(id, patch) => void send("PATCH", `/api/admin/recrutamento/vagas/${id}`, patch, "Vaga salva.")}
          />
        ))}

        {inactiveVacancies.length > 0 && (
          <>
            <p style={{ ...hintStyle, marginTop: 16 }}>Vagas encerradas</p>
            {inactiveVacancies.map((v) => (
              <VacancyRow
                key={`${v.id}:${v.nome}:${v.logic_cutoff}:${v.area_key}:${v.area_cutoff}:${v.active}`}
                vacancy={v}
                areas={config.areas}
                busy={busy}
                onSave={(id, patch) => void send("PATCH", `/api/admin/recrutamento/vagas/${id}`, patch, "Vaga salva.")}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
