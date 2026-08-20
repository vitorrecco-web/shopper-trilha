"use client";

import { useState } from "react";
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
  track_nome: string;
  cd: string | null;
  turno: string | null;
  status: "active" | "inactive";
  created_at: string;
  last_login_at: string | null;
}

interface ModuleDetail {
  module_id: string;
  nome: string;
  ordem: number;
  phase_id: string;
  phase_nome: string;
  phase_ordem: number;
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
  const groups: { phase_id: string; phase_nome: string; phase_ordem: number; modules: ModuleDetail[] }[] = [];
  for (const m of modules) {
    const last = groups[groups.length - 1];
    if (last && last.phase_id === m.phase_id) {
      last.modules.push(m);
    } else {
      groups.push({ phase_id: m.phase_id, phase_nome: m.phase_nome, phase_ordem: m.phase_ordem, modules: [m] });
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

export function UserDetail({
  user,
  progress,
  modules,
  attempts,
}: {
  user: UserInfo;
  progress: UserProgress;
  modules: ModuleDetail[];
  attempts: AttemptDetail[];
}) {
  const router = useRouter();

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
        Trilha: <b style={{ color: theme.color.text }}>{user.track_nome}</b> (não editável) · Matrícula:{" "}
        {user.matricula ?? "—"} · Início: {formatDate(user.created_at)} · Último acesso:{" "}
        {formatDate(user.last_login_at)}
      </p>

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
                  Fase {group.phase_ordem} — {group.phase_nome}
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
