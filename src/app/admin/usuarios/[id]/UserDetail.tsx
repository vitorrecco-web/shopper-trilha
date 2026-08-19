"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserProgress } from "@/lib/services/userProgress";
import { computeTrackStatus, trackStatusLabel } from "@/lib/services/trackStatus";

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
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #2a2d34",
  background: "#181a1f",
  color: "#f2f2f2",
  fontSize: 14,
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#9aa0a6", display: "block", marginBottom: 10 };

const sectionStyle: React.CSSProperties = {
  border: "1px solid #22252b",
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
};

function ModuleRow({ m, attempts }: { m: ModuleDetail; attempts: AttemptDetail[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasQuizHistory = m.has_questions || attempts.length > 0;

  return (
    <div style={{ fontSize: 13, borderTop: "1px solid #22252b", paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <b>
          {m.ordem}. {m.nome}
        </b>
        {hasQuizHistory && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid #2a2d34",
              background: "transparent",
              color: "#7F77DD",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {expanded ? "Ocultar tentativas" : `Ver tentativas da prova (${attempts.length})`}
          </button>
        )}
      </div>
      <div style={{ color: "#9aa0a6" }}>
        Material acessado: {m.material_accessed ? formatDate(m.material_accessed_at) : "não"} · Concluído:{" "}
        {m.completed ? formatDate(m.completed_at) : "não"} · Melhor nota: {m.best_score ?? "—"}
      </div>

      {expanded && (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          {attempts.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#9aa0a6", margin: 0 }}>
              Nenhuma tentativa registrada ainda para este módulo.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#9aa0a6" }}>
                    <th style={{ padding: "4px 8px" }}>Data</th>
                    <th style={{ padding: "4px 8px" }}>Acertos</th>
                    <th style={{ padding: "4px 8px" }}>Nota</th>
                    <th style={{ padding: "4px 8px" }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid #22252b" }}>
                      <td style={{ padding: "4px 8px" }}>{formatDate(a.submitted_at ?? a.started_at)}</td>
                      <td style={{ padding: "4px 8px" }}>
                        {a.correct_answers}/{a.total_questions}
                      </td>
                      <td style={{ padding: "4px 8px" }}>{a.score}</td>
                      <td style={{ padding: "4px 8px", color: a.passed ? "#4ECDC4" : "#ff8a8a" }}>
                        {a.passed ? "Aprovado" : "Reprovado"}
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
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{user.nome_completo}</h1>
      <p style={{ fontSize: 13, color: "#9aa0a6", marginBottom: 20 }}>
        Trilha: <b>{user.track_nome}</b> (não editável) · Matrícula: {user.matricula ?? "—"} · Início:{" "}
        {formatDate(user.created_at)} · Último acesso: {formatDate(user.last_login_at)}
      </p>

      {/* Progresso geral */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Progresso</h2>
          <span
            style={{
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 12,
              background: "#181a1f",
              color: "#9aa0a6",
              border: "1px solid #2a2d34",
            }}
          >
            {trackStatusLabel[computeTrackStatus(progress.percent)]}
          </span>
        </div>
        {progress.percent === null ? (
          <p style={{ fontSize: 13, color: "#9aa0a6", margin: 0 }}>
            Ainda não há módulos ativos para esta trilha.
          </p>
        ) : (
          <p style={{ fontSize: 13, margin: 0 }}>
            {progress.percent}% concluído ({progress.completedModules} de {progress.totalModules} módulos)
          </p>
        )}
      </section>

      {/* Editar dados */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Editar dados</h2>
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
          <div style={{ display: "flex", gap: 12 }}>
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
            <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>
              {saveError}
            </p>
          )}
          {saveOk && <p style={{ color: "#4ECDC4", fontSize: 13, marginBottom: 8 }}>Salvo com sucesso.</p>}

          <button
            type="submit"
            disabled={saving}
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </section>

      {/* Redefinir senha */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Redefinir senha</h2>
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
            <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>
              {resetError}
            </p>
          )}
          {resetOk && (
            <p style={{ color: "#4ECDC4", fontSize: 13, marginBottom: 8 }}>Senha redefinida com sucesso.</p>
          )}
          <button
            type="submit"
            disabled={resetting}
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
            {resetting ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </form>
      </section>

      {/* Histórico de módulos, agrupado por fase — tentativas de prova
          vinculadas a cada módulo, expansíveis inline (substitui a antiga
          tabela global de "Tentativas de prova" no fim da página). */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Módulos</h2>
        {modules.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9aa0a6", margin: 0 }}>
            Nenhum módulo ativo para esta trilha ainda.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groupModulesByPhase(modules).map((group) => (
              <div key={group.phase_id}>
                <p
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: "#7F77DD",
                    marginBottom: 6,
                  }}
                >
                  Fase {group.phase_ordem} — {group.phase_nome}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
