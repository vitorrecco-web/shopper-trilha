"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserProgress } from "@/lib/services/userProgress";
import { computeTrackStatus, trackStatusLabel } from "@/lib/services/trackStatus";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface UserInfo {
  id: string;
  nome_completo: string;
  matricula: string | null;
  login: string;
  cd: string | null;
  turno: string | null;
  status: "active" | "inactive";
  created_at: string;
  last_login_at: string | null;
}

interface EnrollmentInfo {
  id: string;
  program_id: string;
  program_nome: string;
  track_nome: string | null;
}

interface ModuleDetail {
  module_id: string;
  nome: string;
  ordem: number;
  phase_id: string;
  phase_nome: string;
  phase_ordem: number;
  program_nome: string;
  has_questions: boolean;
  unlocked_at: string | null;
  material_accessed: boolean;
  material_accessed_at: string | null;
  completed: boolean;
  completed_at: string | null;
  best_score: number | null;
}

interface AttemptDetail {
  id: string;
  module_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  passed: boolean;
  started_at: string;
  submitted_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * A lista `modules` já chega do servidor ordenada por fase (ordem),
 * depois módulo (ordem) — ver buildOrderedModules em trilhaView.ts. Aqui
 * só agrupamos os itens consecutivos da mesma fase para exibição; não
 * reordena nada de novo.
 */
function groupModulesByPhase(modules: ModuleDetail[]) {
  const groups: {
    phase_id: string;
    phase_nome: string;
    phase_ordem: number;
    program_nome: string;
    modules: ModuleDetail[];
  }[] = [];
  for (const m of modules) {
    const last = groups[groups.length - 1];
    if (last && last.phase_id === m.phase_id) {
      last.modules.push(m);
    } else {
      groups.push({
        phase_id: m.phase_id,
        phase_nome: m.phase_nome,
        phase_ordem: m.phase_ordem,
        program_nome: m.program_nome,
        modules: [m],
      });
    }
  }
  return groups;
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "9px 12px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  color: theme.color.text,
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: theme.font.size.xs,
  color: theme.color.textMuted,
  display: "block",
  marginBottom: theme.space(3),
};

const sectionStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(4),
};

function ModuleRow({ m, attempts }: { m: ModuleDetail; attempts: AttemptDetail[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasQuizHistory = m.has_questions || attempts.length > 0;

  return (
    <div style={{ fontSize: 13, borderTop: `1px solid ${theme.color.border}`, paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <b style={{ color: theme.color.text }}>
          {m.ordem}. {m.nome}
        </b>
        {hasQuizHistory && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              padding: "3px 10px",
              borderRadius: theme.radius.pill,
              border: `1px solid ${theme.color.border}`,
              background: theme.color.surface,
              color: theme.color.primaryDark,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {expanded ? "Ocultar tentativas" : `Ver tentativas da prova (${attempts.length})`}
          </button>
        )}
      </div>
      <div style={{ color: theme.color.textMuted }}>
        Material acessado: {m.material_accessed ? formatDate(m.material_accessed_at) : "não"} · Concluído:{" "}
        {m.completed ? formatDate(m.completed_at) : "não"} · Melhor nota: {m.best_score ?? "—"}
      </div>

      {expanded && (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          {attempts.length === 0 ? (
            <p style={{ fontSize: 12.5, color: theme.color.textFaint, margin: 0 }}>
              Nenhuma tentativa registrada ainda para este módulo.
            </p>
          ) : (
            <div className="table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: theme.color.textMuted }}>
                    <th style={{ padding: "4px 8px" }}>Data</th>
                    <th style={{ padding: "4px 8px" }}>Acertos</th>
                    <th style={{ padding: "4px 8px" }}>Nota</th>
                    <th style={{ padding: "4px 8px" }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ padding: "4px 8px" }}>{formatDate(a.submitted_at ?? a.started_at)}</td>
                      <td style={{ padding: "4px 8px" }}>
                        {a.correct_answers}/{a.total_questions}
                      </td>
                      <td style={{ padding: "4px 8px" }}>{a.score}</td>
                      <td style={{ padding: "4px 8px" }}>
                        <Badge tone={a.passed ? "primary" : "danger"}>{a.passed ? "Aprovado" : "Reprovado"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TrackOption {
  id: string;
  nome: string;
}

/** Form de "+ Adicionar trilha" — mesmo padrão Programa→Função do cadastro, só que para um usuário já existente. */
function AddEnrollmentForm({
  userId,
  allPrograms,
  excludeProgramIds,
  onAdded,
  onCancel,
}: {
  userId: string;
  allPrograms: { id: string; nome: string }[];
  excludeProgramIds: string[];
  onAdded: () => void;
  onCancel: () => void;
}) {
  const availablePrograms = allPrograms.filter((p) => !excludeProgramIds.includes(p.id));
  const [programId, setProgramId] = useState(availablePrograms[0]?.id ?? "");
  const [trackId, setTrackId] = useState("");
  const [tracks, setTracks] = useState<TrackOption[] | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) {
      setTracks([]);
      return;
    }
    let cancelled = false;
    setLoadingTracks(true);
    fetch(`/api/admin/tracks?programId=${encodeURIComponent(programId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTracks(data.ok ? (data.tracks as TrackOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTracks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: programId, track_id: trackId || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível adicionar a trilha.");
        return;
      }
      onAdded();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (availablePrograms.length === 0) {
    return (
      <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
        Este colaborador já está matriculado em todos os Programas ativos.
      </p>
    );
  }

  return (
    <div style={{ border: `1px dashed ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(3) }}>
      <label style={{ ...labelStyle, marginBottom: 8 }}>
        Programa
        <select style={inputStyle} value={programId} onChange={(e) => { setProgramId(e.target.value); setTrackId(""); }}>
          {availablePrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      {loadingTracks && (
        <p style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 8 }}>Carregando funções...</p>
      )}
      {!loadingTracks && tracks && tracks.length > 0 && (
        <label style={{ ...labelStyle, marginBottom: 8 }}>
          Função
          <select style={inputStyle} value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            <option value="">Selecione...</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginBottom: 8 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button type="button" onClick={handleAdd} disabled={saving || !programId}>
          {saving ? "Adicionando..." : "Adicionar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function UserDetail({
  user,
  enrollments,
  allPrograms,
  progress,
  modules,
  attempts,
}: {
  user: UserInfo;
  enrollments: EnrollmentInfo[];
  allPrograms: { id: string; nome: string }[];
  progress: UserProgress;
  modules: ModuleDetail[];
  attempts: AttemptDetail[];
}) {
  const router = useRouter();

  const [showAddTrilha, setShowAddTrilha] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemoveEnrollment(enrollmentId: string) {
    setRemovingId(enrollmentId);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/enrollments/${enrollmentId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setRemoveError(data.error ?? "Não foi possível remover a trilha.");
        return;
      }
      router.refresh();
    } catch {
      setRemoveError("Erro de conexão. Tente novamente.");
    } finally {
      setRemovingId(null);
    }
  }

  const [form, setForm] = useState({
    nome_completo: user.nome_completo,
    cd: user.cd ?? "",
    turno: user.turno ?? "",
    login: user.login,
    status: user.status,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveOk(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_completo: form.nome_completo,
          cd: form.cd || null,
          turno: form.turno || null,
          login: form.login,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setSaveOk(true);
      router.refresh();
    } catch {
      setSaveError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true);
    setResetError(null);
    setResetOk(false);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResetError(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }
      setResetOk(true);
      setNewPassword("");
    } catch {
      setResetError("Erro de conexão. Tente novamente.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4, color: theme.color.text }}>
        {user.nome_completo}
      </h1>
      <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginBottom: theme.space(5) }}>
        Matrícula: {user.matricula ?? "—"} · Início: {formatDate(user.created_at)} · Último acesso:{" "}
        {formatDate(user.last_login_at)}
      </p>

      {/* Trilhas (matrículas) — um usuário pode ter mais de uma ao mesmo
          tempo. Uma matrícula existente nunca é editada em si (§11.4) —
          só adicionada (trilha nova) ou removida (soft-delete). */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.space(3) }}>
          <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>Trilhas</h2>
          {!showAddTrilha && (
            <Button type="button" variant="secondary" onClick={() => setShowAddTrilha(true)}>
              + Adicionar trilha
            </Button>
          )}
        </div>

        {removeError && (
          <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm, marginBottom: theme.space(3) }}>
            {removeError}
          </p>
        )}

        {enrollments.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
            Nenhuma trilha atribuída ainda.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: showAddTrilha ? theme.space(3) : 0 }}>
            {enrollments.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${theme.color.border}`,
                  borderRadius: theme.radius.md,
                  padding: "8px 12px",
                }}
              >
                <span style={{ fontSize: theme.font.size.sm, color: theme.color.text }}>
                  <b>{e.program_nome}</b>
                  {e.track_nome && <span style={{ color: theme.color.textMuted }}> · {e.track_nome}</span>}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => handleRemoveEnrollment(e.id)}
                  disabled={removingId === e.id}
                >
                  {removingId === e.id ? "Removendo..." : "Remover"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {showAddTrilha && (
          <AddEnrollmentForm
            userId={user.id}
            allPrograms={allPrograms}
            excludeProgramIds={enrollments.map((e) => e.program_id)}
            onAdded={() => {
              setShowAddTrilha(false);
              router.refresh();
            }}
            onCancel={() => setShowAddTrilha(false)}
          />
        )}
      </section>

      {/* Progresso geral */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>Progresso</h2>
          <Badge
            tone={
              computeTrackStatus(progress.percent) === "concluida"
                ? "primary"
                : computeTrackStatus(progress.percent) === "nao_iniciado"
                  ? "warning"
                  : "neutral"
            }
          >
            {trackStatusLabel[computeTrackStatus(progress.percent)]}
          </Badge>
        </div>
        {progress.percent === null ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
            Ainda não há módulos ativos para esta trilha.
          </p>
        ) : (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.text, margin: 0 }}>
            {progress.percent}% concluído ({progress.completedModules} de {progress.totalModules} módulos)
          </p>
        )}
      </section>

      {/* Editar dados */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: theme.space(3), color: theme.color.text }}>
          Editar dados
        </h2>
        <form onSubmit={handleSave}>
          <label style={labelStyle}>
            Nome completo
            <input
              style={inputStyle}
              value={form.nome_completo}
              onChange={(e) => update("nome_completo", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Login
            <input style={inputStyle} value={form.login} onChange={(e) => update("login", e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: theme.space(3) }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              CD/Galpão
              <input style={inputStyle} value={form.cd} onChange={(e) => update("cd", e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              Turno
              <input style={inputStyle} value={form.turno} onChange={(e) => update("turno", e.target.value)} />
            </label>
          </div>
          <label style={labelStyle}>
            Status
            <select
              style={inputStyle}
              value={form.status}
              onChange={(e) => update("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          {saveError && (
            <p
              role="alert"
              style={{
                color: theme.color.danger,
                background: theme.color.dangerBg,
                borderRadius: theme.radius.sm,
                padding: "8px 12px",
                fontSize: theme.font.size.sm,
                marginBottom: theme.space(3),
              }}
            >
              {saveError}
            </p>
          )}
          {saveOk && (
            <p style={{ color: theme.color.primaryDark, fontSize: theme.font.size.sm, marginBottom: theme.space(3) }}>
              Salvo com sucesso.
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </section>

      {/* Redefinir senha */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: theme.space(3), color: theme.color.text }}>
          Redefinir senha
        </h2>
        <form onSubmit={handleResetPassword}>
          <label style={labelStyle}>
            Nova senha
            <input
              type="text"
              minLength={6}
              required
              style={inputStyle}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {resetError && (
            <p
              role="alert"
              style={{
                color: theme.color.danger,
                background: theme.color.dangerBg,
                borderRadius: theme.radius.sm,
                padding: "8px 12px",
                fontSize: theme.font.size.sm,
                marginBottom: theme.space(3),
              }}
            >
              {resetError}
            </p>
          )}
          {resetOk && (
            <p style={{ color: theme.color.primaryDark, fontSize: theme.font.size.sm, marginBottom: theme.space(3) }}>
              Senha redefinida com sucesso.
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={resetting}>
            {resetting ? "Redefinindo..." : "Redefinir senha"}
          </Button>
        </form>
      </section>

      {/* Histórico de módulos, agrupado por fase — tentativas de prova
          vinculadas a cada módulo, expansíveis inline (substitui a antiga
          tabela global de "Tentativas de prova" no fim da página). */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: theme.space(3), color: theme.color.text }}>
          Módulos
        </h2>
        {modules.length === 0 ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
            Nenhum módulo ativo para esta trilha ainda.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.space(4) }}>
            {groupModulesByPhase(modules).map((group) => (
              <div key={group.phase_id}>
                <p
                  style={{
                    fontSize: theme.font.size.xs,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: theme.color.primaryDark,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  {group.program_nome} · Fase {group.phase_ordem} — {group.phase_nome}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: theme.space(2) }}>
                  {group.modules.map((m) => (
                    <ModuleRow
                      key={m.module_id}
                      m={m}
                      attempts={attempts.filter((a) => a.module_id === m.module_id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
