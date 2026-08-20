"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UserProgress } from "@/lib/services/userProgress";
import type { TrackStatus } from "@/lib/services/trackStatus";
import { trackStatusLabel } from "@/lib/services/trackStatus";
import { theme } from "@/lib/ui/theme";
import { Badge } from "@/components/ui/Badge";

export interface UserRow {
  id: string;
  nome_completo: string;
  matricula: string | null;
  login: string;
  track_id: string | null;
  track_nome: string;
  cd: string | null;
  turno: string | null;
  status: "active" | "inactive";
  last_login_at: string | null;
  progress: UserProgress;
  trackStatus: TrackStatus;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatProgress(p: UserProgress): string {
  if (p.percent === null) return "—";
  return `${p.percent}% (${p.completedModules}/${p.totalModules})`;
}

const trackStatusTone: Record<TrackStatus, "neutral" | "warning" | "primary"> = {
  sem_modulos: "neutral",
  nao_iniciado: "warning",
  em_andamento: "neutral",
  concluida: "primary",
};

/**
 * Colunas conforme §13 do PROJECT_CONTEXT: Nome, Matrícula, Trilha, CD,
 * Turno, Progresso, Status, Último acesso. Ativar/Inativar direto na
 * linha, sem precisar entrar no detalhe (ação principal listada em §13).
 * "Status da trilha" (Fase 10, tarefa 5) é calculado — nunca lido de
 * uma flag salva (§12).
 */
export function UsersTable({ initialUsers, tracks }: { initialUsers: UserRow[]; tracks: { id: string; nome: string }[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (trackFilter && u.track_id !== trackFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.nome_completo.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        (u.matricula ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, trackFilter, statusFilter]);

  async function toggleStatus(user: UserRow) {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    setPendingId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível alterar o status.");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setPendingId(null);
    }
  }

  const fieldStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.border}`,
    background: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.font.size.sm,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: theme.space(2), flexWrap: "wrap", marginBottom: theme.space(4) }}>
        <input
          placeholder="Buscar por nome, login ou matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...fieldStyle, width: "100%", maxWidth: 320 }}
        />
        <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} style={fieldStyle}>
          <option value="">Todas as trilhas</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={fieldStyle}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {error && (
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
          {error}
        </p>
      )}

      <div
        className="table-scroll"
        style={{
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          background: theme.color.surface,
          boxShadow: theme.shadow.sm,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.size.sm, minWidth: 820 }}>
          <thead>
            <tr style={{ background: theme.color.bg, textAlign: "left" }}>
              {[
                "Nome",
                "Matrícula",
                "Trilha",
                "CD",
                "Turno",
                "Progresso",
                "Status da trilha",
                "Conta",
                "Último acesso",
                "",
              ].map((h) => (
                <th
                  key={h}
                  style={{ padding: "12px 14px", color: theme.color.textMuted, fontWeight: 600, fontSize: theme.font.size.xs }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: "12px 14px" }}>
                  <Link href={`/admin/usuarios/${u.id}`} style={{ color: theme.color.primaryDark, textDecoration: "none", fontWeight: 600 }}>
                    {u.nome_completo}
                  </Link>
                </td>
                <td style={{ padding: "12px 14px", color: theme.color.textMuted }}>{u.matricula ?? "—"}</td>
                <td style={{ padding: "12px 14px" }}>{u.track_nome}</td>
                <td style={{ padding: "12px 14px", color: theme.color.textMuted }}>{u.cd ?? "—"}</td>
                <td style={{ padding: "12px 14px", color: theme.color.textMuted }}>{u.turno ?? "—"}</td>
                <td style={{ padding: "12px 14px" }}>{formatProgress(u.progress)}</td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={trackStatusTone[u.trackStatus]}>{trackStatusLabel[u.trackStatus]}</Badge>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={u.status === "active" ? "primary" : "danger"}>
                    {u.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td style={{ padding: "12px 14px", color: theme.color.textMuted }}>{formatDate(u.last_login_at)}</td>
                <td style={{ padding: "12px 14px" }}>
                  <button
                    onClick={() => toggleStatus(u)}
                    disabled={pendingId === u.id}
                    style={{
                      padding: "6px 12px",
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.color.border}`,
                      background: theme.color.surface,
                      color: theme.color.text,
                      fontSize: theme.font.size.xs,
                      fontWeight: 600,
                      cursor: pendingId === u.id ? "default" : "pointer",
                      opacity: pendingId === u.id ? 0.6 : 1,
                    }}
                  >
                    {u.status === "active" ? "Inativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 20, textAlign: "center", color: theme.color.textFaint }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
